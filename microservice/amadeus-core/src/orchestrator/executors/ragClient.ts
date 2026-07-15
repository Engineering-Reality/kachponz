/**
 * RAG retrieval + generation — port of legacy Python
 * microservice/rag/service/rag/_rag_utils.py's retrieval_with_rerank() /
 * generate_response(). Generation goes through qwenChat() (never a
 * different/local model — see Part A.3 of feature.md), embeddings through
 * embeddingClient.ts. No torch/transformers involved anywhere in this file.
 */

import { qwenChat } from './qwenClient.js';
import { embedText, embedTexts } from './embeddingClient.js';
import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';

export interface RetrievedDoc {
  file_id: string;
  content: string;
  similarity: number;
}

/**
 * Fixed-size chunking with overlap — intentionally simple (feature.md
 * Non-goals: no semantic/recursive chunker in this PR). Splits on
 * `chunkSize` characters with `overlap` characters repeated between
 * consecutive chunks so a sentence spanning a boundary isn't lost.
 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const normalized = text.trim();
  if (normalized.length === 0) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  const step = chunkSize - overlap;
  for (let start = 0; start < normalized.length; start += step) {
    chunks.push(normalized.slice(start, start + chunkSize));
    if (start + chunkSize >= normalized.length) break;
  }
  return chunks;
}

/** Chunk, embed, and insert a file's text content into rag_documents. */
export async function ingestFile(
  fileId: string,
  userId: string | null,
  text: string,
): Promise<number> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  const embeddings = await embedTexts(chunks);
  for (let i = 0; i < chunks.length; i++) {
    await query(
      `INSERT INTO rag_documents (user_id, file_id, content, embedding) VALUES ($1, $2, $3, $4::vector)`,
      [userId, fileId, chunks[i], JSON.stringify(embeddings[i])],
    );
  }
  return chunks.length;
}

export async function deleteFileChunks(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  await query(`DELETE FROM rag_documents WHERE file_id = ANY($1)`, [fileIds]);
}

export async function retrievalWithRerank(userQuery: string, topK = 5): Promise<RetrievedDoc[]> {
  const queryEmbedding = await embedText(userQuery);
  const result = await query<RetrievedDoc>(
    `SELECT * FROM rerank_documents($1::vector, $2)`,
    [JSON.stringify(queryEmbedding), topK],
  );
  return result.rows;
}

export async function generateRagResponse(
  userQuery: string,
  retrievedContext: RetrievedDoc[],
): Promise<string> {
  const formattedContext = retrievedContext
    .map(
      (doc, i) =>
        `Document ${i + 1} (ID: ${doc.file_id}, Relevance: ${doc.similarity.toFixed(4)}):\n${doc.content}`,
    )
    .join('\n\n');
  const prompt = `Berdasarkan konteks yang diambil berikut, jawab pertanyaan ini.\n\nPertanyaan: ${userQuery}\n\nKonteks:\n${formattedContext}\n\nJawaban:`;
  const result = await qwenChat({
    model: env.QWEN_LLM_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });
  return result.content;
}
