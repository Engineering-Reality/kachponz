/**
 * scripts/registerRobot.ts — Internal CLI for robot registration.
 *
 * Usage (run on the server by an operator with DB access):
 *   npm run robot:register -- --name <robot_name> --company <company_id>
 *
 * Security contract:
 *   - Generated API key is shown ONCE in plaintext, never stored.
 *   - Only the argon2 hash is persisted in service_accounts.
 *   - Operator must manually copy the key into UiPath Orchestrator
 *     as a Credential Asset (never hardcode in workflow).
 *   - No HTTP endpoint is exposed for robot registration.
 */
import "dotenv/config";
import crypto from "node:crypto";
import readline from "node:readline";
import argon2 from "argon2";
import pg from "pg";

// ── Bootstrap DB ─────────────────────────────────────────────
// We load env manually here since env.ts calls process.exit on
// failure — that's desired for the server, but we want friendlier
// CLI messages here.

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

// ── Arg parsing ───────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const robotName = getArg("--name");
  const companyId = getArg("--company");

  if (!robotName || !companyId) {
    console.error("Usage: npm run robot:register -- --name <robot_name> --company <company_uuid>");
    process.exit(1);
  }

  // Validate UUID format
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(companyId)) {
    console.error(`❌  company_id is not a valid UUID: '${companyId}'`);
    process.exit(1);
  }

  await client.connect();

  try {
    // ── Check for duplicate ────────────────────────────────────
    const existing = await client.query(
      "SELECT id, is_active FROM service_accounts WHERE robot_name = $1",
      [robotName]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      const acct = existing.rows[0];
      if (acct.is_active) {
        console.error(
          `❌  Robot '${robotName}' is already registered and active (id: ${acct.id}).\n` +
          `    If you need to rotate the key, first deactivate the account:\n` +
          `    UPDATE service_accounts SET is_active = false WHERE id = '${acct.id}';`
        );
        process.exit(1);
      } else {
        console.warn(
          `⚠️   Robot '${robotName}' exists but is inactive. A new active account will be created.`
        );
        const ok = await confirm("Continue? (y/N): ");
        if (!ok) {
          console.log("Aborted.");
          process.exit(0);
        }
      }
    }

    // ── Generate API key ────────────────────────────────────────
    // 32 bytes = 256-bit entropy; base64url encoding avoids special chars
    const rawKey = crypto.randomBytes(32).toString("base64url");

    // ── Hash with argon2 ────────────────────────────────────────
    // argon2id is the recommended variant (memory-hard, GPU-resistant)
    const hash = await argon2.hash(rawKey, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });

    // ── Insert into DB ──────────────────────────────────────────
    const result = await client.query(
      `INSERT INTO service_accounts
         (id, robot_name, api_key_hash, company_id, is_active, created_at)
       VALUES
         (gen_random_uuid(), $1, $2, $3, true, NOW())
       RETURNING id`,
      [robotName, hash, companyId]
    );

    const accountId = result.rows[0].id;

    // ── Display key — ONLY ONCE ─────────────────────────────────
    console.log("");
    console.log("══════════════════════════════════════════════════════════════");
    console.log("  ✅  Robot registered successfully");
    console.log("══════════════════════════════════════════════════════════════");
    console.log(`  Robot name  : ${robotName}`);
    console.log(`  Company ID  : ${companyId}`);
    console.log(`  Account ID  : ${accountId}`);
    console.log("");
    console.log("  API Key (copy now — this will NOT be shown again):");
    console.log("");
    console.log(`  ${rawKey}`);
    console.log("");
    console.log("  ⚠️  Store this key in UiPath Orchestrator > Assets > Credential.");
    console.log("      NEVER commit it to source control or logs.");
    console.log("══════════════════════════════════════════════════════════════");
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
