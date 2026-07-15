import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MigrationBuilder } from 'node-pg-migrate';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function up(pgm: MigrationBuilder): Promise<void> {
  const sql = fs.readFileSync(
    path.join(__dirname, '../db/functions/fn_upsert_uipath_job_trace.sql'),
    'utf8',
  );
  pgm.sql(sql);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP FUNCTION IF EXISTS fn_upsert_uipath_job_trace;`);
}
