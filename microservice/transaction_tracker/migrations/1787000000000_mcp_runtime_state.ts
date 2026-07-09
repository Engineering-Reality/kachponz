import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('mcp_runtime_state', {
    tool_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'tools',
      onDelete: 'CASCADE',
    },
    method: { type: 'varchar', notNull: true },
    port: { type: 'integer', notNull: false },
    pid: { type: 'integer', notNull: false },
    status: { type: 'varchar', notNull: true, default: 'stopped' },
    last_error: { type: 'text', notNull: false },
    started_at: { type: 'timestamptz', notNull: false },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('mcp_runtime_state', 'chk_mcp_runtime_state_method', {
    check: "method IN ('sse','stdio')",
  });

  pgm.addConstraint('mcp_runtime_state', 'chk_mcp_runtime_state_status', {
    check: "status IN ('starting','running','crashed','stopped')",
  });

  pgm.createIndex('mcp_runtime_state', 'status', {
    where: "status IN ('starting','running')",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('mcp_runtime_state');
}
