/**
 * CLI internal registrasi user manusia (admin dashboard) — BUKAN endpoint
 * publik, sama seperti scripts/registerRobot.ts. Hanya bisa dijalankan
 * operator dengan akses langsung ke server/DB.
 *
 * Pakai:
 *   npm run user:register -- --email <email> --company <company_id> \
 *       [--role admin] [--name "Display Name"] [--password <plaintext>]
 *
 * Perilaku:
 *  1. Bila --password tidak diberikan, generate password acak (32 byte, base64url).
 *  2. Hash password (argon2id) sebelum simpan ke users.
 *  3. Assign user ke company via user_companies dengan role_id dari --role
 *     (default 'admin' bila tidak diberikan).
 *  4. Tampilkan plaintext password HANYA SEKALI di terminal.
 *  5. Bila --email sudah aktif → tolak, jangan generate ulang diam-diam.
 */
import { withTransaction } from '../src/db/pool.js';
import { generateApiKey, hashSecret } from '../src/lib/crypto.js';
import {
  activeUserEmailExists,
  insertUser,
  assignUserToCompany,
  findRoleIdByName,
} from '../src/services/users.js';

interface Args {
  email?: string;
  company?: string;
  role: string;
  name?: string;
  password?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { role: 'admin' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--company') out.company = argv[++i];
    else if (a === '--role') out.role = argv[++i] ?? 'admin';
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--password') out.password = argv[++i];
  }
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email || !EMAIL_RE.test(args.email)) {
    console.error('ERROR: --email wajib, format email valid.');
    process.exit(2);
  }
  if (!args.company || !UUID_RE.test(args.company)) {
    console.error('ERROR: --company wajib berupa UUID valid.');
    process.exit(2);
  }

  if (await activeUserEmailExists(args.email)) {
    console.error(
      `ERROR: user "${args.email}" sudah terdaftar & aktif. ` +
        `Nonaktifkan dulu bila ingin menerbitkan ulang. (tidak generate ulang diam-diam)`,
    );
    process.exit(3);
  }

  const roleId = await findRoleIdByName(args.role);
  if (roleId === null) {
    console.error(`ERROR: role "${args.role}" tidak ditemukan di tabel roles.`);
    process.exit(4);
  }

  const password = args.password ?? generateApiKey();
  const passwordHash = await hashSecret(password);

  const userId = await withTransaction(async (client) => {
    const id = await insertUser(client, {
      email: args.email!,
      passwordHash,
      displayName: args.name ?? null,
    });
    await assignUserToCompany(client, { userId: id, companyId: args.company!, roleId });
    return id;
  });

  console.log('\n============================================================');
  console.log('  USER REGISTERED — SIMPAN KREDENSIAL INI SEKARANG');
  console.log('  (tidak akan ditampilkan lagi; tidak disimpan plaintext)');
  console.log('============================================================');
  console.log(`  user_id    : ${userId}`);
  console.log(`  email      : ${args.email}`);
  console.log(`  company_id : ${args.company}`);
  console.log(`  role       : ${args.role}`);
  console.log('  ----------------------------------------------------------');
  console.log(`  Password   : ${password}`);
  console.log('============================================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR registrasi:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
