/**
 * Klien Netra Runtime — OpenAI-compatible wrapper untuk Netra Runtime,
 * endpoint inference OpenAI-compatible (dipakai di sini untuk model DeepSeek
 * text + vision).
 *
 * Endpoint OpenAI-compatible tunggal:
 *   https://api.netraruntime.com/v1
 *
 * Model yang dipakai:
 *   - NETRA_VL_MODEL  : deepseek/deepseek-v4.1-flash (multimodal, vision + text)
 *   - NETRA_LLM_MODEL : deepseek/deepseek-v4-flash-0731 (text-only, cost-efficient)
 *
 * API key diambil dari env NETRA_API_KEY.
 */

import { env } from '../../config/env.js';
import {
  logLlmUsageEvent,
  measurementBodyOverrides,
  netraSamplingParams,
  extractReasoning,
} from '../../telemetry/llmUsage.js';

interface NetraChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export interface NetraChatRequest {
  model: string;
  messages: NetraChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Bila di-set, minta model kembalikan JSON valid (best-effort). */
  responseJson?: boolean;
  /** Telemetry tag (owo.md/tok.md sizing exercise) — e.g. 'chatTitle', 'autofill', 'docExam'. */
  callSite?: string;
  modelKind?: 'text' | 'vision';
  agentId?: string;
  threadId?: string;
}

export interface NetraChatResponse {
  content: string;
  /** Reasoning kept on a SEPARATE channel — never concatenated into `content`. */
  reasoning?: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  provider?: string;
}

export class NetraApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'NetraApiError';
  }
}

/**
 * Kirim chat completion ke Netra Runtime. OpenAI-compatible endpoint.
 */
export async function netraChat(req: NetraChatRequest): Promise<NetraChatResponse> {
  if (!env.NETRA_API_KEY) {
    throw new NetraApiError(500, 'NETRA_API_KEY wajib di-set');
  }

  const url = `${env.NETRA_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.NETRA_API_KEY}`,
  };

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.1,
    ...netraSamplingParams(),
    ...measurementBodyOverrides(),
  };
  if (req.max_tokens) body.max_tokens = req.max_tokens;
  if (req.responseJson) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.NETRA_TIMEOUT_MS);
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new NetraApiError(
      0,
      `Gagal menghubungi Netra: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new NetraApiError(res.status, `Netra API ${res.status}`, txt.slice(0, 500));
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    model?: string;
    usage?: NetraChatResponse['usage'];
    provider?: string;
  };
  const message = json.choices?.[0]?.message;
  const content = message?.content ?? '';
  // Reasoning stays on its own channel; never folded into user-visible content.
  const reasoning = extractReasoning(message);

  if (req.callSite) {
    void logLlmUsageEvent({
      callSite: req.callSite,
      modelSlug: json.model ?? req.model,
      modelKind: req.modelKind ?? 'text',
      // Netra returns no `provider` field — write the literal 'netra' so rows
      // stay distinguishable from pre-migration OpenRouter rows.
      provider: json.provider ?? 'netra',
      agentId: req.agentId,
      threadId: req.threadId,
      thinkingEnabled: env.LLM_MEASUREMENT_REASONING ? env.LLM_MEASUREMENT_REASONING === 'on' : undefined,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      totalTokens: json.usage?.total_tokens,
      reasoningTokens: json.usage?.completion_tokens_details?.reasoning_tokens,
      latencyMs: Date.now() - startedAt,
      finishReason: json.choices?.[0]?.finish_reason,
      stream: false,
    });
  }

  return {
    content,
    reasoning: reasoning || undefined,
    model: json.model ?? req.model,
    usage: json.usage,
    provider: json.provider,
  };
}

/**
 * Parse JSON dari respons LLM dengan toleransi (model kadang bungkus dengan
 * ```json ... ``` atau teks penjelasan sebelum/sesudah).
 */
export function parseJsonLoose<T = unknown>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Respons LLM tidak mengandung JSON object');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
