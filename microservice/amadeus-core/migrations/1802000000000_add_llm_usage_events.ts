import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Passive token/usage telemetry for LLM sizing measurement (tok.md Fase 2 / owo.md
 * LANJUTAN C). Numeric + hash columns only — never prompt content, MT message
 * content, or tool results (privacy rule in tok.md line ~174).
 * Writes are gated by env LLM_USAGE_TELEMETRY=on (default off) and must never affect
 * agent behavior — see src/telemetry/llmUsage.ts.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('llm_usage_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    request_id: { type: 'text', notNull: false },
    agent_id: { type: 'uuid', notNull: false },
    thread_id: { type: 'text', notNull: false },
    step_index: { type: 'integer', notNull: false },
    call_site: { type: 'text', notNull: true },
    model_slug: { type: 'text', notNull: true },
    model_kind: { type: 'text', notNull: true }, // 'text' | 'vision'
    provider: { type: 'text', notNull: false },
    quantization: { type: 'text', notNull: false },
    runtime_mode: { type: 'text', notNull: true, default: 'openrouter' }, // 'openrouter' | 'netra_onprem'
    thinking_enabled: { type: 'boolean', notNull: false },
    scenario: { type: 'text', notNull: false }, // S1..S5 label for this measurement exercise, null in normal ops
    prompt_tokens: { type: 'integer', notNull: false },
    completion_tokens: { type: 'integer', notNull: false },
    total_tokens: { type: 'integer', notNull: false },
    reasoning_tokens: { type: 'integer', notNull: false },
    image_count: { type: 'integer', notNull: false },
    image_tokens: { type: 'integer', notNull: false },
    tool_calls_count: { type: 'integer', notNull: false },
    tools_attached_count: { type: 'integer', notNull: false },
    tool_result_tokens: { type: 'integer', notNull: false },
    latency_ms: { type: 'integer', notNull: false },
    finish_reason: { type: 'text', notNull: false },
    stream: { type: 'boolean', notNull: false },
    estimated: { type: 'boolean', notNull: false, default: false },
  });

  pgm.createIndex('llm_usage_events', ['request_id']);
  pgm.createIndex('llm_usage_events', ['agent_id', 'created_at']);
  pgm.createIndex('llm_usage_events', ['scenario']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('llm_usage_events');
}
