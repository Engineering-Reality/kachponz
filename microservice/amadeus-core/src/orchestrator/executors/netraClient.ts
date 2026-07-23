/**
 * Klien Netra — abstrak untuk cloud (Netra Cloud) DAN on-prem (Ollama/vLLM).
 *
 * ============================================================================
 * ⚠️  CATATAN COMPLIANCE (WAJIB DIBACA SEBELUM PRODUCTION)
 * ============================================================================
 *
 * Mode `cloud` memanggil `api.netraruntime.com` (server Netra). Ini berarti:
 *   - Payload request (termasuk isi dokumen LC bila dikirim sebagai context)
 *     KELUAR dari jaringan bank Mandiri ke server pihak ketiga di luar negeri.
 *   - Ini KEMUNGKINAN BESAR MELANGGAR:
 *       * POJK 11/2022 (Penyelenggaraan TI Bank Umum) — kewajiban on-shore
 *         data nasabah tanpa persetujuan & kontrol tambahan.
 *       * POJK 4/2023 (Perlindungan Konsumen Sektor Jasa Keuangan) — kewajiban
 *         perlindungan data pribadi.
 *       * SWIFT CSP Advisory Controls — segregasi jaringan SWIFT.
 *       * Kebijakan CISO internal Mandiri (blok cloud pihak ketiga; alasan
 *         yang sama untuk Supabase & OpenAI di codebase Amadeus lama).
 *
 * Mode ini HANYA untuk:
 *   - Development / prototyping dengan DATA SINTETIS (bukan LC nasabah asli).
 *   - Demo internal ke leadership dengan data yang sudah di-mask/di-anonimkan.
 *
 * SEBELUM production dengan trafik nasabah asli: SWITCH ke `on_prem` mode
 * dengan deploy model open-weight (mis. Qwen3-VL, Qwen2.5-VL — Apache 2.0) di
 * infrastruktur GPU internal Mandiri (Ollama / vLLM), lalu set:
 *   NETRA_MODE=on_prem
 *   NETRA_BASE_URL=http://netra-inference.internal:8000/v1
 *
 * API-nya sama (OpenAI-compatible) → nol refactor kode aplikasi.
 *
 * Roadmap terdokumentasi di docs/executor_migration.md.
 * ============================================================================
 */

import { env } from '../../config/env.js';

export interface NetraChatMessage {
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
}

export interface NetraChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
 * Kirim chat completion ke Netra. OpenAI-compatible endpoint di kedua mode.
 * Cloud: Netra Cloud API. On-prem: langsung endpoint Ollama/vLLM.
 */
export async function netraChat(req: NetraChatRequest): Promise<NetraChatResponse> {
  if (!env.NETRA_BASE_URL) {
    throw new NetraApiError(500, 'NETRA_BASE_URL belum dikonfigurasi');
  }
  // API key wajib untuk cloud, opsional untuk on-prem (bergantung setup).
  if (env.NETRA_MODE === 'cloud' && !env.NETRA_API_KEY) {
    throw new NetraApiError(500, 'NETRA_API_KEY wajib untuk mode cloud');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (env.NETRA_API_KEY) {
    headers.Authorization = `Bearer ${env.NETRA_API_KEY}`;
  }

  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.1,
  };
  if (req.max_tokens) body.max_tokens = req.max_tokens;
  if (req.responseJson) body.response_format = { type: 'json_object' };

  const url = `${env.NETRA_BASE_URL.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.NETRA_TIMEOUT_MS);

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
      `Gagal menghubungi Netra (${env.NETRA_MODE}): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new NetraApiError(res.status, `Netra API ${res.status}`, txt.slice(0, 500));
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: NetraChatResponse['usage'];
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
