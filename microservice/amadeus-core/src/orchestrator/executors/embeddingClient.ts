/**
 * Klien embedding untuk RAG — DashScope `text-embedding-v3`.
 *
 * ============================================================================
 * ⚠️  CATATAN COMPLIANCE (sama seperti qwenClient.ts, WAJIB DIBACA)
 * ============================================================================
 *
 * Netra Runtime (api.netraruntime.com, on_prem mode) TIDAK menyediakan
 * endpoint embeddings — dicek langsung ke API live-nya (2026-07-15):
 * `GET /v1/models` hanya mengembalikan 3 model chat (Qwen VLM,
 * gemma-4-26b-a4b, qwen3.6-35b), dan `POST /v1/embeddings` ke ketiganya
 * menolak dengan "this model only supports /v1/chat/completions". Tidak ada
 * jalur on-prem untuk embeddings saat ini.
 *
 * Fallback yang dipakai di sini — DashScope `text-embedding-v3` — dikonfirmasi
 * ke Jandy (2026-07-15) sebagai pilihan cloud/dev-prototyping SAJA, dengan
 * compliance concern PERSIS SAMA seperti QWEN_MODE=cloud di qwenClient.ts
 * (POJK 11/2022, POJK 4/2023, SWIFT CSP, kebijakan CISO Mandiri — lihat
 * komentar lengkap di sana). Reuse QWEN_MODE/QWEN_BASE_URL/QWEN_API_KEY
 * karena DashScope compatible-mode melayani /chat/completions DAN
 * /embeddings dari base URL + key yang sama.
 *
 * SEBELUM production dengan data nasabah asli: perlu model embedding
 * open-weight yang di-deploy on-prem (mis. Qwen3-Embedding via
 * Ollama/vLLM) sebelum RAG bisa dipakai dengan dokumen LC nasabah sungguhan.
 * Sampai saat itu, endpoint ini HANYA untuk dev/prototyping dengan data
 * sintetis, sama seperti qwenChat() mode cloud.
 * ============================================================================
 */

import { env } from '../../config/env.js';

export class EmbeddingApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'EmbeddingApiError';
  }
}

/** Embed a single text string. Returns a vector of length env.EMBEDDING_DIM. */
export async function embedText(text: string): Promise<number[]> {
  const vectors = await embedTexts([text]);
  const vector = vectors[0];
  if (!vector) {
    throw new EmbeddingApiError(502, 'Embedding API tidak mengembalikan vektor');
  }
  return vector;
}

/** Batch embed — DashScope's /embeddings endpoint accepts an array input. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!env.QWEN_BASE_URL) {
    throw new EmbeddingApiError(500, 'QWEN_BASE_URL belum dikonfigurasi');
  }
  if (env.QWEN_MODE === 'cloud' && !env.QWEN_API_KEY) {
    throw new EmbeddingApiError(500, 'QWEN_API_KEY wajib untuk mode cloud');
  }
  if (env.QWEN_MODE === 'on_prem') {
    throw new EmbeddingApiError(
      501,
      'Tidak ada endpoint embeddings on-prem saat ini (Netra Runtime hanya chat completions) — ' +
        'deploy model embedding open-weight dulu sebelum switch QWEN_MODE=on_prem untuk RAG.',
    );
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.QWEN_API_KEY) {
    headers.Authorization = `Bearer ${env.QWEN_API_KEY}`;
  }

  const url = `${env.QWEN_BASE_URL.replace(/\/$/, '')}/embeddings`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.QWEN_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: env.EMBEDDING_MODEL, input: texts }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new EmbeddingApiError(
      0,
      `Gagal menghubungi embedding API: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new EmbeddingApiError(res.status, `Embedding API ${res.status}`, txt.slice(0, 500));
  }

  const json = (await res.json()) as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  const sorted = (json.data ?? []).slice().sort((a, b) => a.index - b.index);
  if (sorted.length !== texts.length) {
    throw new EmbeddingApiError(502, 'Jumlah embedding tidak sesuai jumlah input');
  }
  for (const item of sorted) {
    if (item.embedding.length !== env.EMBEDDING_DIM) {
      throw new EmbeddingApiError(
        502,
        `Dimensi embedding (${item.embedding.length}) tidak cocok dengan EMBEDDING_DIM (${env.EMBEDDING_DIM})`,
      );
    }
  }
  return sorted.map((item) => item.embedding);
}
