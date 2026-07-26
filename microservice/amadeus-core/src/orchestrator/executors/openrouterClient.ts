/**
 * Klien OpenRouter — OpenAI-compatible wrapper untuk openrouter.ai, sebuah
 * router terpadu di atas banyak provider model (dipakai di sini terutama
 * untuk model Qwen).
 *
 * Endpoint OpenAI-compatible tunggal (bukan multi-region seperti provider
 * sebelumnya):
 *   https://openrouter.ai/api/v1
 *
 * Model yang dipakai:
 *   - OPENROUTER_VL_MODEL  : qwen/qwen3-vl-235b-a22b-instruct (multimodal, vision + text)
 *   - OPENROUTER_LLM_MODEL : qwen/qwen-plus (text-only, cost-efficient)
 *
 * API key diambil dari env OPENROUTER_API_KEY.
 */

import { env } from '../../config/env.js';

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Bila di-set, minta model kembalikan JSON valid (best-effort). */
  responseJson?: boolean;
}

export interface OpenRouterChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenRouterApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'OpenRouterApiError';
  }
}

/**
 * Kirim chat completion ke OpenRouter. OpenAI-compatible endpoint.
 */
export async function openrouterChat(req: OpenRouterChatRequest): Promise<OpenRouterChatResponse> {
  if (!env.OPENROUTER_API_KEY) {
    throw new OpenRouterApiError(500, 'OPENROUTER_API_KEY wajib di-set');
  }

  const url = `${env.OPENROUTER_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
  };

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.1,
  };
  if (req.max_tokens) body.max_tokens = req.max_tokens;
  if (req.responseJson) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.OPENROUTER_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new OpenRouterApiError(
      0,
      `Gagal menghubungi OpenRouter: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new OpenRouterApiError(res.status, `OpenRouter API ${res.status}`, txt.slice(0, 500));
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: OpenRouterChatResponse['usage'];
  };
  const content = json.choices?.[0]?.message?.content ?? '';
  return {
    content,
    model: json.model ?? req.model,
    usage: json.usage,
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
