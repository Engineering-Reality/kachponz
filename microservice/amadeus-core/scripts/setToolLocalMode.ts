/**
 * CLI internal — pindahkan satu tool MCP dari mode "npx -y <pkg>" (menarik
 * paket dari registry npm SAAT RUNTIME) ke mode "node <path lokal>".
 *
 * Berguna saat egress ke registry npm diblokir (proxy/AppLocker korporat):
 * install paket sekali secara manual/offline ke sebuah folder vendor, lalu
 * arahkan tool ini ke entry point lokalnya sehingga `npx -y` tidak pernah
 * dipanggil lagi saat mcpAutoManager.ts atau engine.ts men-spawn tool ini.
 *
 * Pakai:
 *   npm run tool:set-local-mode -- --tool-id <uuid> --entry <path-ke-entry.js>
 *
 * Perilaku:
 *  1. Ambil versi terakhir tool dari kolom `versions` (JSON array).
 *  2. Ganti released.command -> "node", released.args -> [entry].
 *  3. Pertahankan released.env dan released.method apa adanya.
 *  4. Tampilkan diff before/after, minta konfirmasi eksplisit sebelum UPDATE.
 */
import { existsSync } from 'node:fs';
import { query } from '../src/db/pool.js';

interface Args {
  toolId?: string;
  entry?: string;
  yes: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tool-id') out.toolId = argv[++i];
    else if (a === '--entry') out.entry = argv[++i];
    else if (a === '--yes') out.yes = true;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.toolId || !UUID_RE.test(args.toolId)) {
    console.error('ERROR: --tool-id wajib berupa UUID valid.');
    process.exit(2);
  }
  if (!args.entry) {
    console.error('ERROR: --entry wajib (path ke file .js entry point lokal).');
    process.exit(2);
  }
  if (!existsSync(args.entry)) {
    console.error(`ERROR: entry point "${args.entry}" tidak ditemukan di filesystem ini.`);
    console.error('       (Bila target sebenarnya ada di mesin lain/Windows, lewati cek ini secara manual.)');
    process.exit(2);
  }

  const res = await query<{ name: string; versions: any[] }>(
    'SELECT name, versions FROM tools WHERE tool_id = $1',
    [args.toolId],
  );
  const row = res.rows[0];
  if (!row) {
    console.error(`ERROR: tool_id "${args.toolId}" tidak ditemukan.`);
    process.exit(3);
  }

  const versions = Array.isArray(row.versions) ? [...row.versions] : [];
  const lastIdx = versions.length - 1;
  if (lastIdx < 0) {
    console.error(`ERROR: tool "${row.name}" tidak punya versi tersimpan.`);
    process.exit(3);
  }

  const before = versions[lastIdx].released ?? {};
  if (typeof before.args === 'string') {
    console.error(
      `ERROR: tool "${row.name}" masih pakai format legacy (args berupa string). ` +
        `Normalisasi dulu (lihat migrations/1792000000000_normalize_mcp_commands.ts) sebelum memakai script ini.`,
    );
    process.exit(3);
  }

  const after = {
    ...before,
    command: 'node',
    args: [args.entry],
  };

  console.log(`\nTool: ${row.name} (${args.toolId})`);
  console.log('Before:', JSON.stringify({ command: before.command, args: before.args, method: before.method }, null, 2));
  console.log('After: ', JSON.stringify({ command: after.command, args: after.args, method: after.method }, null, 2));
  console.log('(env dan method dipertahankan apa adanya, tidak ditampilkan/diubah)\n');

  if (!args.yes) {
    console.log('Dry run only — tambahkan --yes untuk benar-benar menyimpan perubahan ini.');
    process.exit(0);
  }

  versions[lastIdx] = { ...versions[lastIdx], released: after };
  await query('UPDATE tools SET versions = $1 WHERE tool_id = $2', [JSON.stringify(versions), args.toolId]);

  console.log(`Tersimpan. Tool "${row.name}" sekarang berjalan via: node ${args.entry}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
