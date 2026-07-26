/**
 * Klien DashScope — OpenAI-compatible wrapper untuk Alibaba Cloud DashScope API.
 *
 * DashScope menyediakan endpoint OpenAI-compatible di:
 *   https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *
 * Model yang dipakai:
 *   - DASHSCOPE_VL_MODEL  : qwen-vl-max (multimodal, vision + text)
 *   - DASHSCOPE_LLM_MODEL : qwen-plus   (text-only, cost-efficient)
 *
 * API key diambil dari env DASHSCOPE_API_KEY.
 */

import { env } from '../../config/env.js';

export interface DashScopeChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export interface DashScopeChatRequest {
  model: string;
  messages: DashScopeChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Bila di-set, minta model kembalikan JSON valid (best-effort). */
  responseJson?: boolean;
}

export interface DashScopeChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class DashScopeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'DashScopeApiError';
  }
}

/**
 * Kirim chat completion ke DashScope. OpenAI-compatible endpoint.
 */
export async function dashscopeChat(req: DashScopeChatRequest): Promise<DashScopeChatResponse> {
  if (!env.DASHSCOPE_BASE_URL) {
    throw new DashScopeApiError(500, 'DASHSCOPE_BASE_URL belum dikonfigurasi');
  }
  if (!env.DASHSCOPE_API_KEY) {
    throw new DashScopeApiError(500, 'DASHSCOPE_API_KEY wajib di-set');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
  };

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.1,
  };
  if (req.max_tokens) body.max_tokens = req.max_tokens;
  if (req.responseJson) body.response_format = { type: 'json_object' };

  const url = `${env.DASHSCOPE_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.DASHSCOPE_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new DashScopeApiError(
      0,
      `Gagal menghubungi DashScope: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new DashScopeApiError(res.status, `DashScope API ${res.status}`, txt.slice(0, 500));
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: DashScopeChatResponse['usage'];
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
