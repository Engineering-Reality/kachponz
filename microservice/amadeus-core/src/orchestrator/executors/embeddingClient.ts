/**
 * Klien embedding untuk RAG — OpenRouter `qwen/qwen3-embedding-4b`.
 *
 * Reuses OPENROUTER_BASE_URL/OPENROUTER_API_KEY — OpenRouter serves both
 * /chat/completions and /embeddings under the same base URL. The model's
 * native output is wider than EMBEDDING_DIM, so the request includes a
 * `dimensions` field to truncate it (confirmed live: qwen/qwen3-embedding-4b
 * + dimensions:1024 returns exactly a 1024-length vector).
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

/** Batch embed — OpenRouter /embeddings endpoint accepts an array input. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!env.OPENROUTER_BASE_URL) {
    throw new EmbeddingApiError(500, 'OPENROUTER_BASE_URL belum dikonfigurasi');
  }
  if (!env.OPENROUTER_API_KEY) {
    throw new EmbeddingApiError(500, 'OPENROUTER_API_KEY wajib di-set');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
  };

  const url = `${env.OPENROUTER_BASE_URL.replace(/\/$/, '')}/embeddings`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.OPENROUTER_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: env.EMBEDDING_MODEL, input: texts, dimensions: env.EMBEDDING_DIM }),
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
