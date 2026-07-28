/**
 * Seeds the existing "SWIFT" knowledge base (kb_id e3f889c7-afac-49b6-9a47-75c93ab32ec4)
 * with synthetic (clearly fake, not real) sanctioned-entity text entries, so
 * SwiftFraudDetector/SwiftMTApuPptDetector's search_knowledge_base tool has
 * real content to retrieve during the owo.md/tok.md token-sizing measurement
 * (LANJUTAN C). One-off script — not part of normal app startup.
 *
 * Usage: npx tsx scripts/seedSwiftKbSynthetic.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closePool } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SWIFT_KB_ID = 'e3f889c7-afac-49b6-9a47-75c93ab32ec4';
const ENTRIES_PATH = process.argv[2] ?? '/tmp/qwen-tok-test/kb-seed-entries.json';

async function main() {
  const entries: Array<{ title: string; text: string }> = JSON.parse(fs.readFileSync(ENTRIES_PATH, 'utf8'));

  const existing = await query('SELECT count(*) FROM kb_documents WHERE kb_id = $1', [SWIFT_KB_ID]);
  const existingRow = existing.rows[0];
  if (existingRow && Number(existingRow.count) > 0) {
    console.log(`kb_documents already has ${existingRow.count} rows for SWIFT KB — skipping (idempotent).`);
    await closePool();
    return;
  }

  for (const entry of entries) {
    await query(
      `INSERT INTO kb_documents (kb_id, filename, file_type, raw_text, status)
       VALUES ($1, $2, 'txt', $3, 'ready')`,
      [SWIFT_KB_ID, `${entry.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.txt`, entry.text],
    );
    console.log('Inserted:', entry.title);
  }

  console.log(`\nDone — ${entries.length} synthetic entries inserted into SWIFT KB (${SWIFT_KB_ID}).`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
