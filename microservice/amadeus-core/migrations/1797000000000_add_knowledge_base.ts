import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationBuilder } from 'node-pg-migrate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * AML/CFT knowledge base (apu.md) — company-owned KB entities (SDN list,
 * high-risk country list, sanctioned bank list) attachable to N agents via
 * a junction table, plus the outbox table for the screening-result email
 * worker.
 *
 * `kb_documents.embedding` stays in the schema (vector(1024), matching
 * `rag_documents` in 1795000000000_add_rag.ts) but is intentionally left
 * NULL for now: the only working embedding path in this repo is DashScope
 * cloud (see embeddingClient.ts), which is dev/prototyping-only per POJK
 * 11/2022 / POJK 4/2023 / SWIFT CSP compliance concerns already flagged
 * there — unacceptable for query-time embedding of real counterparty names
 * extracted from live transaction messages. Retrieval instead uses Postgres
 * full-text search (see kb_documents_fts_idx below); the embedding column
 * is forward-compatible for when an on-prem embedding model ships.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('knowledge_bases', {
    kb_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    company_id: {
      type: 'uuid',
      notNull: true,
      references: 'companies(company_id)',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('knowledge_bases', 'company_id');

  pgm.createTable('kb_documents', {
    doc_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    kb_id: {
      type: 'uuid',
      notNull: true,
      references: 'knowledge_bases(kb_id)',
      onDelete: 'CASCADE',
    },
    filename: { type: 'text', notNull: true },
    file_type: { type: 'text', notNull: true, check: "file_type IN ('pdf', 'image', 'txt')" },
    raw_text: { type: 'text' },
    // See file header: NULL until an on-prem embedding model is available.
    embedding: { type: 'vector(1024)' },
    status: {
      type: 'text',
      notNull: true,
      default: 'processing',
      check: "status IN ('processing', 'ready', 'failed')",
    },
    uploaded_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('kb_documents', 'kb_id');

  // Full-text search over raw_text. 'simple' config (no stemming) — entries
  // are proper nouns (sanctioned entity/bank/country names), and stemming
  // an English/Indonesian dictionary onto e.g. Arabic-transliterated names
  // would only reduce match precision.
  pgm.sql(`
    CREATE INDEX kb_documents_fts_idx
      ON kb_documents
      USING gin (to_tsvector('simple', coalesce(raw_text, '')));
  `);

  pgm.createTable('agent_knowledge_bases', {
    agent_id: {
      type: 'uuid',
      notNull: true,
      references: 'agents(agent_id)',
      onDelete: 'CASCADE',
    },
    kb_id: {
      type: 'uuid',
      notNull: true,
      references: 'knowledge_bases(kb_id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('agent_knowledge_bases', 'agent_knowledge_bases_pkey', {
    primaryKey: ['agent_id', 'kb_id'],
  });

  pgm.createTable('alert_outbox', {
    alert_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    transaction_ref: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'sent', 'failed')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    sent_at: { type: 'timestamptz' },
  });
  pgm.createIndex('alert_outbox', 'status');

  const sql = fs.readFileSync(
    path.join(__dirname, '../db/functions/fn_set_agent_knowledge_bases.sql'),
    'utf8',
  );
  pgm.sql(sql);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS fn_set_agent_knowledge_bases;');
  pgm.dropTable('alert_outbox');
  pgm.dropTable('agent_knowledge_bases');
  pgm.dropTable('kb_documents');
  pgm.dropTable('knowledge_bases');
}
