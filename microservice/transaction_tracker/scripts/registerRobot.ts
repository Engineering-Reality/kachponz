/**
 * CLI internal registrasi robot — BUKAN endpoint publik (prompt: lubang keamanan).
 * Hanya bisa dijalankan operator dengan akses langsung ke server/DB.
 *
 * Pakai:
 *   npm run robot:register -- --name <robot_name> --company <company_id> \
 *       [--types import_lc,skbdn] [--financial]
 *
 * Perilaku:
 *  1. Generate API key acak (32 byte, base64url).
 *  2. Bila --financial: generate signing secret (HMAC layer) juga.
 *  3. Hash keduanya (argon2id) sebelum simpan ke service_accounts.
 *  4. Tampilkan plaintext HANYA SEKALI di terminal (pola AWS/Stripe).
 *  5. Bila --name sudah aktif → tolak, jangan generate ulang diam-diam.
 */
import { withTransaction } from '../src/db/pool.js';
import {
  generateApiKey,
  generateSigningSecret,
  hashSecret,
} from '../src/lib/crypto.js';
import {
  activeAccountNameExists,
  insertServiceAccount,
} from '../src/services/serviceAccounts.js';

interface Args {
  name?: string;
  company?: string;
  types?: string[];
  financial: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { financial: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') out.name = argv[++i];
    else if (a === '--company') out.company = argv[++i];
    else if (a === '--types') out.types = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--financial') out.financial = true;
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_RE = /^[a-zA-Z0-9._-]{3,64}$/;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.name || !NAME_RE.test(args.name)) {
    console.error('ERROR: --name wajib, 3-64 char [a-zA-Z0-9._-].');
    process.exit(2);
  }
  if (!args.company || !UUID_RE.test(args.company)) {
    console.error('ERROR: --company wajib berupa UUID valid.');
    process.exit(2);
  }

  if (await activeAccountNameExists(args.name)) {
    console.error(
      `ERROR: robot "${args.name}" sudah terdaftar & aktif. ` +
        `Nonaktifkan dulu bila ingin menerbitkan ulang. (tidak generate ulang diam-diam)`,
    );
    process.exit(3);
  }

  const apiKey = generateApiKey();
  const apiKeyHash = await hashSecret(apiKey);

  let signingSecret: string | null = null;
  let signingSecretHash: string | null = null;
  if (args.financial) {
    signingSecret = generateSigningSecret();
    signingSecretHash = await hashSecret(signingSecret);
  }

  const id = await withTransaction((client) =>
    insertServiceAccount(client, {
      robotName: args.name!,
      apiKeyHash,
      apiKeyPrefix: apiKey.substring(0, 8),
      signingSecretHash,
      companyId: args.company!,
      allowedTypes: args.types && args.types.length > 0 ? args.types : null,
    }),
  );

  // Output kredensial — HANYA SEKALI. Tidak pernah tersimpan plaintext.
  console.log('\n============================================================');
  console.log('  ROBOT REGISTERED — SIMPAN KREDENSIAL INI SEKARANG');
  console.log('  (tidak akan ditampilkan lagi; tidak disimpan plaintext)');
  console.log('============================================================');
  console.log(`  service_account_id : ${id}`);
  console.log(`  robot_name         : ${args.name}`);
  console.log(`  company_id         : ${args.company}`);
  console.log(`  allowed_types      : ${args.types?.join(',') ?? '(semua)'}`);
  console.log('  ----------------------------------------------------------');
  console.log(`  X-Robot-Key        : ${apiKey}`);
  if (signingSecret) {
    console.log(`  Signing-Secret     : ${signingSecret}`);
    console.log('  (dipakai untuk header X-Robot-Signing-Secret pada step finansial)');
  }
  console.log('============================================================');
  console.log('  Salin ke UiPath Orchestrator Asset (credential asset),');
  console.log('  JANGAN hardcode di workflow. Lihat docs/uipath_integration.md');
  console.log('============================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR registrasi:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
