#!/usr/bin/env node
// Diagnose-only: never writes files, never mutates the DB, never installs
// anything. Reports PASS/FAIL/WARN per check with a remediation hint, so a
// Windows CMD/PowerShell session (or any platform) can be triaged before
// `npm install` / `npm run dev` is attempted.
//
// Usage: npm run preflight   (from microservice/amadeus-core)

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const rows = [];
function report(name, status, detail) {
  rows.push({ name, status, detail });
}

function printTable() {
  const statusWidth = 6;
  const nameWidth = Math.max(...rows.map((r) => r.name.length), 'CHECK'.length) + 2;
  const header = `${'CHECK'.padEnd(nameWidth)}${'STATUS'.padEnd(statusWidth)}DETAIL`;
  console.log(header);
  console.log('-'.repeat(header.length + 40));
  for (const r of rows) {
    const color = r.status === 'PASS' ? '\x1b[32m' : r.status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
    console.log(`${r.name.padEnd(nameWidth)}${color}${r.status.padEnd(statusWidth)}\x1b[0m${r.detail}`);
  }
}

// ─── Node version / arch ───────────────────────────────────────────────
function checkNodeVersion() {
  const required = pkg.engines?.node ?? '';
  const current = process.version;
  const major = Number(current.slice(1).split('.')[0]);
  const ok = major >= 20 && major < 23;
  report(
    'node-version',
    ok ? 'PASS' : 'FAIL',
    `${current} (${process.platform}/${process.arch}), required ${required}${ok ? '' : ' — install a Node LTS in range'}`,
  );
}

// ─── node / npx resolution ──────────────────────────────────────────────
function resolveOnPath(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = execFileSync(finder, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

function checkBinaryResolution() {
  for (const bin of ['node', 'npx']) {
    const resolved = resolveOnPath(bin);
    report(
      `resolve:${bin}`,
      resolved ? 'PASS' : 'FAIL',
      resolved ? resolved : `not found on PATH — install Node.js and restart the shell`,
    );
  }
}

// ─── argon2 native binding ──────────────────────────────────────────────
async function checkArgon2() {
  try {
    const argon2 = await import('argon2');
    await argon2.default.hash('preflight-check');
    report('argon2-binding', 'PASS', 'native binding loaded and callable');
  } catch (err) {
    report(
      'argon2-binding',
      'FAIL',
      `${err instanceof Error ? err.message : String(err)} — prebuilt binary missing; needs Visual Studio Build Tools + Python to compile, or a matching prebuilt for this Node version`,
    );
  }
}

// ─── Database + pgvector ────────────────────────────────────────────────
async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    report('database-url', 'FAIL', 'DATABASE_URL not set in .env');
    report('pgvector-extension', 'FAIL', 'skipped — no DATABASE_URL');
    report('tools-table', 'FAIL', 'skipped — no DATABASE_URL');
    return;
  }

  let pg;
  try {
    pg = await import('pg');
  } catch {
    report('database-url', 'FAIL', '"pg" package not installed — run npm install first');
    return;
  }

  const client = new pg.default.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    report('database-url', 'PASS', 'connected successfully');

    const ext = await client.query(
      `SELECT installed_version FROM pg_available_extensions WHERE name = 'vector'`,
    );
    if (ext.rows.length === 0) {
      report(
        'pgvector-extension',
        'FAIL',
        'extension "vector" not available on this PostgreSQL install — see docs/windows-setup.md for install steps',
      );
    } else {
      const installed = ext.rows[0].installed_version;
      report(
        'pgvector-extension',
        'PASS',
        installed ? `available and installed (v${installed})` : 'available, not yet installed (CREATE EXTENSION vector on migrate:up)',
      );
    }

    try {
      const toolRows = await client.query(`SELECT name, versions FROM tools`);
      if (toolRows.rows.length === 0) {
        report('tools-table', 'WARN', 'no rows in tools table yet — nothing to check for command resolvability');
      } else {
        for (const row of toolRows.rows) {
          const versions = row.versions ?? [];
          const released = versions[versions.length - 1]?.released;
          if (typeof released?.args === 'string' || !released?.command) {
            report(
              `tool:${row.name}`,
              'WARN',
              'legacy pre-migration format (string args / no command) — mcpAutoManager.ts already skips this row; run migrations/1792000000000_normalize_mcp_commands.ts-style normalization or scripts/setToolLocalMode.ts to fix',
            );
            continue;
          }
          const resolvable =
            released.command === 'node' || released.command === 'npx' || released.command === 'python'
              ? Boolean(resolveOnPath(released.command))
              : true; // absolute path — checked by fs existence would need release.args[0]; treat as informational
          report(
            `tool:${row.name}`,
            resolvable ? 'PASS' : 'FAIL',
            `method=${released.method ?? 'unknown'} command=${released.command}${resolvable ? '' : ' — not resolvable on PATH'}`,
          );
        }
      }
    } catch (err) {
      report('tools-table', 'WARN', `could not read tools table: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    report('database-url', 'FAIL', err instanceof Error ? err.message : String(err));
    report('pgvector-extension', 'FAIL', 'skipped — DB connection failed');
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── Proxy / registry reachability ──────────────────────────────────────
function checkProxyEnv() {
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'NODE_EXTRA_CA_CERTS', 'NO_PROXY'];
  const present = proxyVars.filter((v) => process.env[v]);
  report(
    'proxy-env',
    'WARN',
    present.length
      ? `set: ${present.join(', ')}`
      : 'none set — fine on an open network, but corporate TLS-inspecting proxies usually require HTTPS_PROXY + NODE_EXTRA_CA_CERTS',
  );
}

async function checkRegistryReachability() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://registry.npmjs.org/-/ping', { signal: controller.signal });
    clearTimeout(timer);
    report('npm-registry', res.ok ? 'PASS' : 'WARN', `HTTP ${res.status}`);
  } catch (err) {
    report(
      'npm-registry',
      'WARN',
      `unreachable (${err instanceof Error ? err.message : String(err)}) — npx -y packages will fail at runtime if egress stays blocked; see PROMPT 1 section C for the offline/local fallback`,
    );
  }
}

async function main() {
  console.log(`Preflight check — ${pkg.name} (diagnose-only, no writes)\n`);
  checkNodeVersion();
  checkBinaryResolution();
  await checkArgon2();
  await checkDatabase();
  checkProxyEnv();
  await checkRegistryReachability();
  console.log('');
  printTable();

  const hasBlockerFailure = rows.some(
    (r) => r.status === 'FAIL' && ['node-version', 'resolve:node', 'resolve:npx', 'argon2-binding', 'database-url', 'pgvector-extension'].includes(r.name),
  );
  console.log('');
  if (hasBlockerFailure) {
    console.log('Result: one or more hard blockers found — see FAIL rows above.');
    process.exit(1);
  }
  console.log('Result: no hard blockers detected.');
}

main().catch((err) => {
  console.error('Preflight script crashed unexpectedly:', err);
  process.exit(2);
});
