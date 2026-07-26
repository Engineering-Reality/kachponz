#!/usr/bin/env node
// Read-only measurement: samples RSS for every process belonging to this
// stack (Fastify server, mcpAutoManager daemon + its spawned MCP tool
// children, PostgreSQL, frontend Next.js) so the VPS 2vCPU/4GB sizing in
// docs/vps-deployment.md is based on real numbers, not guesses.
//
// Usage: npm run measure -- [--label idle|during-invoke]

import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

function parseArgs(argv) {
  const out = { label: 'sample' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--label') out.label = argv[++i];
  }
  return out;
}

function psSnapshot() {
  const out = execSync('ps -eo pid,ppid,rss,args --no-headers', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return out
    .split('\n')
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), rssKb: Number(m[3]), args: m[4] }))
    // Exclude the `concurrently` supervisor itself — its own argv contains
    // every child command string verbatim (e.g. both "tsx watch
    // src/server.ts" and "tsx watch scripts/mcpAutoManager.ts"), so it
    // otherwise double-matches every component pattern below.
    .filter((p) => !/\bconcurrently\b/.test(p.args));
}

const toMb = (kb) => Math.round((kb / 1024) * 10) / 10;

const GROUPS = [
  { label: 'amadeus-core: Fastify server', pattern: /src\/server\.ts|dist\/src\/server\.js/ },
  { label: 'amadeus-core: mcpAutoManager daemon', pattern: /scripts\/mcpAutoManager\.ts|dist\/scripts\/mcpAutoManager\.js/ },
  { label: 'frontend: Next.js', pattern: /next start|\.next[/\\]standalone[/\\]server\.js|next-server/ },
  { label: 'PostgreSQL', pattern: /bin\/postgres/ },
];

async function findMcpToolChildren(procs) {
  if (!process.env.DATABASE_URL) return [];
  let pg;
  try {
    pg = (await import('pg')).default;
  } catch {
    return [];
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT t.name, r.pid, r.method FROM mcp_runtime_state r
       JOIN tools t ON t.tool_id = r.tool_id
       WHERE r.status = 'running' AND r.pid IS NOT NULL`,
    );
    const rows = [];
    for (const row of res.rows) {
      const p = procs.find((pp) => pp.pid === row.pid);
      if (p) rows.push({ component: `MCP tool (${row.method}): ${row.name}`, pid: p.pid, rssMb: toMb(p.rssKb) });
    }
    return rows;
  } catch (err) {
    console.error(`[measure] could not read mcp_runtime_state: ${err instanceof Error ? err.message : err}`);
    return [];
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const { label } = parseArgs(process.argv.slice(2));
  const procs = psSnapshot();

  const rows = [];
  for (const g of GROUPS) {
    for (const p of procs.filter((pp) => g.pattern.test(pp.args))) {
      rows.push({ component: g.label, pid: p.pid, rssMb: toMb(p.rssKb) });
    }
  }
  rows.push(...(await findMcpToolChildren(procs)));

  console.log(`\nFootprint sample [${label}] — ${new Date().toISOString()}\n`);
  if (rows.length === 0) {
    console.log('No matching processes found — is the stack running?');
    process.exit(1);
  }

  const nameWidth = Math.max(...rows.map((r) => r.component.length)) + 2;
  console.log(`${'COMPONENT'.padEnd(nameWidth)}${'PID'.padEnd(8)}RSS (MB)`);
  console.log('-'.repeat(nameWidth + 20));
  for (const r of rows) {
    console.log(`${r.component.padEnd(nameWidth)}${String(r.pid).padEnd(8)}${r.rssMb}`);
  }

  const byComponent = new Map();
  for (const r of rows) byComponent.set(r.component, (byComponent.get(r.component) ?? 0) + r.rssMb);
  console.log('\nPer-component total:');
  for (const [component, total] of byComponent) {
    console.log(`  ${component.padEnd(nameWidth)}${Math.round(total * 10) / 10} MB`);
  }

  const grandTotal = Math.round(rows.reduce((sum, r) => sum + r.rssMb, 0) * 10) / 10;
  console.log(`\nGrand total (naive RSS sum): ${grandTotal} MB`);
  const pgRowCount = rows.filter((r) => r.component === 'PostgreSQL').length;
  if (pgRowCount > 1) {
    console.log(
      `Note: ${pgRowCount} PostgreSQL processes counted — each backend's RSS includes the shared\n` +
        `shared_buffers mapping, so summing them naively over-counts actual physical memory use.\n` +
        `Treat the PostgreSQL total as an upper bound, not additive with the other components.`,
    );
  }
  console.log('');
}

main().catch((err) => {
  console.error('measure-footprint crashed:', err);
  process.exit(2);
});
