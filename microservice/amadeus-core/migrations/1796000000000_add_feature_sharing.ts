import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Feature Sharing (built from microservice/feature_sharing/README.md — no
 * legacy Python implementation to port).
 *
 * Correction (2026-07-15): an earlier version of this migration assumed
 * `agent_logs` already existed in this DB, "created via migrate_supabase.ts
 * like `agents`". That's wrong — migrate_supabase.ts only creates companies/
 * roles/user_companies/tools/agents; `agent_logs` never existed here, only
 * in the legacy Supabase-backed microservice/agent_backend (see routes/
 * agent_logs.py) and database/agent_logs_rows.sql. This migration now
 * creates it fresh, matching that legacy column shape faithfully, so a
 * future prompt can wire real server-side chat persistence (today the
 * playground only keeps chat history in browser localStorage — nothing
 * writes to this table yet). Thread-share endpoints are correct against
 * this schema but will have nothing to find until that persistence exists.
 *
 * `share_editor_with` already exists on `agents` (used by fn_update_agent.sql
 * / routes/agents.ts) — only the three new sharing fields are added here.
 *
 * `agent_logs` (threads) gets `is_public`/`public_hash` mirrored at the row
 * level per the README's thread JSON example; `share_visitor_with`/
 * `share_editor_with` for threads live inside `chat_history` (as
 * `chat_history[0].share_info`, matching the real array-wrapped shape seen
 * in database/agent_logs_rows.sql — NOT a bare object as the README's
 * schema sketch implies), so no separate columns for those two.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    'agent_logs',
    {
      agent_log_id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
      date: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      agent_id: {
        type: 'uuid',
        notNull: true,
        references: 'agents(agent_id)',
        onDelete: 'CASCADE',
      },
      input_token: { type: 'integer', notNull: true, default: 0 },
      output_token: { type: 'integer', notNull: true, default: 0 },
      embedding_token: { type: 'integer', notNull: true, default: 0 },
      pricing: { type: 'numeric(10,4)', notNull: true, default: 0 },
      chat_history: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
      model_protocol: { type: 'text' },
      model_temperature: { type: 'numeric(3,2)' },
      media_input: { type: 'boolean', notNull: true, default: false },
      media_output: { type: 'boolean', notNull: true, default: false },
      use_memory: { type: 'boolean', notNull: true, default: false },
      use_tool: { type: 'boolean', notNull: true, default: false },
    },
    { ifNotExists: true },
  );
  pgm.createIndex('agent_logs', 'agent_id', { ifNotExists: true });

  pgm.addColumns(
    'agents',
    {
      share_visitor_with: { type: 'text[]', notNull: true, default: pgm.func("'{}'") },
      public_hash: { type: 'text' },
      is_public: { type: 'boolean', notNull: true, default: false },
    },
    { ifNotExists: true },
  );
  pgm.addConstraint('agents', 'uq_agents_public_hash', {
    unique: 'public_hash',
  });

  pgm.addColumns(
    'agent_logs',
    {
      public_hash: { type: 'text' },
      is_public: { type: 'boolean', notNull: true, default: false },
    },
    { ifNotExists: true },
  );
  pgm.addConstraint('agent_logs', 'uq_agent_logs_public_hash', {
    unique: 'public_hash',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('agent_logs', 'uq_agent_logs_public_hash', { ifExists: true });
  pgm.dropConstraint('agents', 'uq_agents_public_hash', { ifExists: true });
  pgm.dropColumns('agents', ['share_visitor_with', 'public_hash', 'is_public'], { ifExists: true });

  pgm.dropTable('agent_logs', { ifExists: true });
}
