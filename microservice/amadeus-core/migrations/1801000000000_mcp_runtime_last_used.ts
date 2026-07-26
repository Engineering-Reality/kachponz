import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationBuilder } from 'node-pg-migrate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('mcp_runtime_state', {
    last_used_at: { type: 'timestamptz', notNull: false },
  });

  // Re-applies fn_reserve_mcp_port.sql (now also stamping last_used_at on a
  // fresh spawn) and installs the new fn_touch_mcp_runtime.sql — both are
  // CREATE OR REPLACE, safe to run again on top of migration 1788000000000.
  for (const file of ['fn_reserve_mcp_port.sql', 'fn_touch_mcp_runtime.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '../db/functions', file), 'utf8');
    pgm.sql(sql);
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP FUNCTION IF EXISTS fn_touch_mcp_runtime;');
  pgm.dropColumn('mcp_runtime_state', 'last_used_at');
  // fn_reserve_mcp_port itself is left installed (owned by migration
  // 1788000000000); rolling back this migration alone will leave it
  // referencing the now-dropped last_used_at column until 1788000000000 is
  // also rolled back, or this migration is re-applied.
}
