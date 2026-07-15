/**
 * CLI internal reset password user manusia — BUKAN endpoint publik, sama
 * seperti scripts/registerUser.ts. Hanya bisa dijalankan operator dengan
 * akses langsung ke server/DB.
 *
 * Pakai:
 *   npm run user:reset-password -- --email <email> [--password <plaintext>]
 *
 * Perilaku:
 *  1. Bila --password tidak diberikan, generate password acak (32 byte, base64url).
 *  2. Hash password (argon2id) dan update users.password_hash langsung.
 *  3. Tampilkan plaintext password HANYA SEKALI di terminal.
 */
import { withTransaction } from '../src/db/pool.js';
import { generateApiKey, hashSecret } from '../src/lib/crypto.js';

interface Args {
  email?: string;
  password?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--password') out.password = argv[++i];
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email || !EMAIL_RE.test(args.email)) {
    console.error('ERROR: --email wajib, format email valid.');
    process.exit(2);
  }

  const password = args.password ?? generateApiKey();
  const passwordHash = await hashSecret(password);

  const updated = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE users SET password_hash = $1 WHERE lower(email) = lower($2) RETURNING user_id`,
      [passwordHash, args.email],
    );
    return result.rows[0]?.user_id ?? null;
  });

  if (!updated) {
    console.error(`ERROR: user "${args.email}" tidak ditemukan.`);
    process.exit(3);
  }

  console.log('\n============================================================');
  console.log('  PASSWORD RESET — SIMPAN KREDENSIAL INI SEKARANG');
  console.log('  (tidak akan ditampilkan lagi; tidak disimpan plaintext)');
  console.log('============================================================');
  console.log(`  user_id    : ${updated}`);
  console.log(`  email      : ${args.email}`);
  console.log('  ----------------------------------------------------------');
  console.log(`  Password   : ${password}`);
  console.log('============================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR reset password:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
