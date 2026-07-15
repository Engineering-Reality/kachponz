import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationBuilder } from 'node-pg-migrate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FUNCTION_FILES = [
  'fn_complete_step.sql',
  'fn_fail_step.sql',
  'fn_update_agent.sql',
  'fn_reserve_mcp_port.sql',
  'fn_release_mcp_runtime.sql',
];

export async function up(pgm: MigrationBuilder): Promise<void> {
  for (const file of FUNCTION_FILES) {
    const sql = fs.readFileSync(path.join(__dirname, '../db/functions', file), 'utf8');
    pgm.sql(sql);
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS fn_complete_step;
    DROP FUNCTION IF EXISTS fn_fail_step;
    DROP FUNCTION IF EXISTS fn_update_agent;
    DROP FUNCTION IF EXISTS fn_reserve_mcp_port;
    DROP FUNCTION IF EXISTS fn_release_mcp_runtime;
  `);
}
