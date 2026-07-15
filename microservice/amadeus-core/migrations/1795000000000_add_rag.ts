import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationBuilder } from 'node-pg-migrate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Text-only RAG (pgvector), ported from legacy Python microservice/rag/.
 * embedding is vector(1024) — dimension returned by DashScope's
 * text-embedding-v3 (confirmed live against the API, see embeddingClient.ts),
 * NOT the 768-dim CLIP embedding the old EmbedderService produced; that
 * class of in-process torch/transformers model is explicitly not ported.
 * `rerank_documents` recreates the Supabase RPC function the legacy code
 * called — it never existed as source in this repo, only in the old DB.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('vector', { ifNotExists: true });

  pgm.createTable('rag_documents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: false,
      references: 'users(user_id)',
      onDelete: 'SET NULL',
    },
    file_id: { type: 'text', notNull: true },
    content: { type: 'text', notNull: true },
    embedding: { type: 'vector(1024)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // Used by update_file/remove_file to find/replace all chunks for a file.
  pgm.createIndex('rag_documents', 'file_id');

  // HNSW, not ivfflat (feature.md's original sketch): ivfflat's `lists`
  // parameter needs to roughly match expected row count — with a fixed
  // lists=100 and a near-empty table (e.g. right after a fresh deploy, or a
  // company with only a handful of documents), k-means over a handful of
  // rows produces near-empty clusters, and the default single-probe query
  // lands on an empty one, silently returning ZERO rows even though there's
  // no WHERE clause. Reproduced locally: 1 row in the table, ivfflat index
  // present → rerank_documents returns []; same query with the index
  // dropped (seq scan) → correctly returns the row. HNSW has no such
  // training-data-size requirement and is correct at any table size, which
  // is what this table's expected shape actually looks like (per-agent
  // corpora, not a single huge shared collection).
  pgm.sql(`
    CREATE INDEX rag_documents_embedding_hnsw_idx
      ON rag_documents
      USING hnsw (embedding vector_cosine_ops);
  `);

  const sql = fs.readFileSync(path.join(__dirname, '../db/functions/fn_rerank_documents.sql'), 'utf8');
  pgm.sql(sql);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS rerank_documents;');
  pgm.dropTable('rag_documents');
  pgm.dropExtension('vector', { ifExists: true });
}
