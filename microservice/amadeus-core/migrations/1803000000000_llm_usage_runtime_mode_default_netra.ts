import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Provider migration OpenRouter/Qwen → Netra Runtime: new llm_usage_events rows
 * are now Netra calls by default, so flip the runtime_mode column default from
 * 'openrouter' (set in 1802000000000_add_llm_usage_events.ts) to 'netra'.
 * Historical rows keep whatever they were written with — only the column DEFAULT
 * changes, so pre/post-migration rows stay distinguishable.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('llm_usage_events', 'runtime_mode', { default: 'netra' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('llm_usage_events', 'runtime_mode', { default: 'openrouter' });
}
