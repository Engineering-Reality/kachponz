import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * agent_recipes: zero-or-one generalized Recipe Executor (Loop Mode) config
 * per agent (creatoroop.md). `agent_id` as primary key both enforces the
 * zero-or-one invariant and gives an upsert target. FK into `agents` mirrors
 * 1793000000000_add_users.ts's pattern of referencing that pre-existing table
 * (created outside migration history, via migrate_supabase.ts).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('agent_recipes', {
    agent_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'agents(agent_id)',
      onDelete: 'CASCADE',
    },
    recipe: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('agent_recipes');
}
