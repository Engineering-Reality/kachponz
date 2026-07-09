import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('mcp_runtime_state', {
    entry_mtime: { type: 'bigint', notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('mcp_runtime_state', 'entry_mtime');
}
