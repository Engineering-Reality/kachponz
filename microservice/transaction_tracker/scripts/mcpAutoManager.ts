import { spawn, ChildProcess } from 'child_process';
import net from 'node:net';
import { statSync } from 'node:fs';
import pg from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PortAllocator, loadPortRange } from '../src/services/portAllocator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const portRange = loadPortRange();
const portAllocator = new PortAllocator(portRange);

type ActiveProc = { child: ChildProcess; port: number };
const activeProcesses = new Map<string, ActiveProc>();

const SECRET_KEY_RE = /secret|password|token|key/i;
const LIVENESS_BACKOFF_MS = [200, 400, 800, 1600, 3200];
const MAX_SPAWN_ATTEMPTS = 3;

function redactEnv(env: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env || {})) {
    out[k] = SECRET_KEY_RE.test(k) ? '***REDACTED***' : v;
  }
  return out;
}

function redactArgs(args: string[]): string[] {
  // args may contain a JSON-encoded blob with secret fields (e.g. UiPath clientSecret).
  return args.map((arg) => {
    try {
      const parsed = JSON.parse(arg);
      if (parsed && typeof parsed === 'object') {
        const redacted: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(parsed)) {
          redacted[k] = SECRET_KEY_RE.test(k) ? '***REDACTED***' : v;
        }
        return JSON.stringify(redacted);
      }
    } catch {
      /* not JSON, fall through */
    }
    return arg;
  });
}

function logPrefix(toolName: string, port?: number | null): string {
  return port ? `[${toolName}:${port}]` : `[${toolName}]`;
}

async function getExcludedPorts(): Promise<Set<number>> {
  const res = await pool.query<{ port: number }>(
    `SELECT port FROM mcp_runtime_state WHERE status IN ('starting','running') AND port IS NOT NULL`,
  );
  return new Set(res.rows.map((r) => r.port));
}

async function upsertRuntimeState(fields: {
  toolId: string;
  method: string;
  port: number | null;
  pid: number | null;
  status: string;
  lastError?: string | null;
  startedAt?: boolean; // true => set started_at = now()
  entryMtime?: number | null; // entry-file mtime (ms) current when this process was spawned
}): Promise<void> {
  // fn_reserve_mcp_port (db/functions/) — atomic upsert, replaces the ternary-built
  // SQL string this used to construct inline for the started_at column.
  await pool.query(
    `SELECT * FROM fn_reserve_mcp_port($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      fields.toolId,
      fields.method,
      fields.port,
      fields.pid,
      fields.status,
      fields.lastError ?? null,
      fields.entryMtime ?? null,
      fields.startedAt === true,
    ],
  );
}

async function markStopped(toolIds: string[]): Promise<void> {
  if (toolIds.length === 0) return;
  await pool.query(`SELECT * FROM fn_release_mcp_runtime($1::uuid[])`, [toolIds]);
}

/** Plain TCP connect check — doesn't need to be a valid SSE handshake, just proof something is listening. */
function tcpProbe(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function waitForLiveness(host: string, port: number): Promise<boolean> {
  for (const delay of LIVENESS_BACKOFF_MS) {
    await new Promise((r) => setTimeout(r, delay));
    if (await tcpProbe(host, port)) return true;
  }
  return false;
}

/** Stats a tool's entry-file (its args[0], when that's a local build output path) so we can
 * detect later that the on-disk code changed since the currently-running process was spawned. */
function statEntryMtime(args: string[]): number | null {
  const entryPath = args[0];
  if (!entryPath) return null;
  try {
    // Round to whole milliseconds — mtimeMs has a fractional (sub-ms) part on
    // most filesystems, and the DB column is bigint (Postgres rejects a
    // decimal literal bound to bigint).
    return Math.round(statSync(entryPath).mtimeMs);
  } catch {
    return null; // not a local file path (e.g. npx/remote) — mtime-based restart doesn't apply
  }
}

/** Spawns one SSE tool, allocating a fresh port and retrying on EADDRINUSE races. */
async function startSseTool(tool: any, release: any): Promise<void> {
  const toolId: string = tool.tool_id;
  const command: string = release.command;
  const args: string[] = release.args;
  const entryMtime = statEntryMtime(args);

  for (let attempt = 1; attempt <= MAX_SPAWN_ATTEMPTS; attempt++) {
    const excludePorts = await getExcludedPorts();
    let port: number;
    try {
      port = await portAllocator.allocate(excludePorts);
    } catch (err) {
      console.error(`[MCP AutoManager] ${logPrefix(tool.name)} port allocation failed:`, err);
      await upsertRuntimeState({
        toolId,
        method: 'sse',
        port: null,
        pid: null,
        status: 'crashed',
        lastError: 'Port range exhausted',
      });
      return;
    }

    // Reserve the port immediately, before spawning, so a concurrent sync
    // tick allocating at the same instant won't pick the same candidate.
    await upsertRuntimeState({ toolId, method: 'sse', port, pid: null, status: 'starting' });

    console.log(
      `${logPrefix(tool.name, port)} Starting (attempt ${attempt}/${MAX_SPAWN_ATTEMPTS}): command=${command} args=${JSON.stringify(redactArgs(args))}`,
    );

    const env = { ...process.env, ...release.env, PORT: String(port) };

    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false, // never true — args are passed as-is to execvp, no shell re-interpretation
    });

    let earlyBindFailure = false;
    let settled = false;

    child.stdout?.on('data', (data) => {
      process.stdout.write(`${logPrefix(tool.name, port)} ${data}`);
    });
    child.stderr?.on('data', (data) => {
      const text = String(data);
      process.stderr.write(`${logPrefix(tool.name, port)} ${text}`);
      if (/EADDRINUSE/.test(text)) earlyBindFailure = true;
    });

    const earlyExit = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 1000);
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolve(code !== 0 && code !== null);
      });
    });

    if (earlyExit || earlyBindFailure) {
      console.error(
        `${logPrefix(tool.name, port)} Failed to bind (EADDRINUSE or early exit) — releasing port, retrying`,
      );
      await upsertRuntimeState({
        toolId,
        method: 'sse',
        port: null,
        pid: null,
        status: 'crashed',
        lastError: 'EADDRINUSE or early exit on spawn',
      });
      continue; // retry with a fresh port allocation
    }

    // Liveness check via plain TCP connect, 5 attempts with backoff.
    const alive = await waitForLiveness(portRange.host, port);
    if (!alive) {
      settled = true;
      child.kill('SIGKILL');
      console.error(`${logPrefix(tool.name, port)} Liveness check failed after retries — releasing port`);
      await upsertRuntimeState({
        toolId,
        method: 'sse',
        port: null,
        pid: null,
        status: 'crashed',
        lastError: 'Liveness check failed (no TCP response on assigned port)',
      });
      continue; // retry with a fresh port allocation
    }

    await upsertRuntimeState({
      toolId,
      method: 'sse',
      port,
      pid: child.pid ?? null,
      status: 'running',
      startedAt: true,
      entryMtime,
    });
    console.log(`${logPrefix(tool.name, port)} Running (pid ${child.pid})`);

    activeProcesses.set(toolId, { child, port });

    child.on('exit', (code) => {
      if (settled) return; // already handled by the liveness-failure path above
      console.log(`${logPrefix(tool.name, port)} Exited with code ${code}`);
      activeProcesses.delete(toolId);
      // Never reuse the old port — mark crashed, next sync tick allocates fresh.
      upsertRuntimeState({
        toolId,
        method: 'sse',
        port: null,
        pid: null,
        status: 'crashed',
        lastError: `Process exited with code ${code}`,
      }).catch((err) => console.error(`${logPrefix(tool.name, port)} Failed to record exit:`, err));
    });

    return; // success, stop retry loop
  }

  console.error(`${logPrefix(tool.name)} Giving up after ${MAX_SPAWN_ATTEMPTS} spawn attempts`);
}

async function syncMcpServers() {
  try {
    const res = await pool.query("SELECT * FROM tools WHERE on_status = 'Online' OR on_status = 'true'");
    const tools = res.rows;

    const runningRes = await pool.query<{ tool_id: string; entry_mtime: string | null; port: number | null }>(
      `SELECT tool_id, entry_mtime, port FROM mcp_runtime_state WHERE status IN ('starting','running')`,
    );
    const runningToolIds = new Set(runningRes.rows.map((r) => r.tool_id));
    const recordedEntryMtimes = new Map(
      runningRes.rows.map((r) => [r.tool_id, r.entry_mtime !== null ? Number(r.entry_mtime) : null]),
    );

    // Reconcile rows inherited from a previous daemon incarnation. A DB status
    // of 'starting'/'running' alone doesn't prove a process is alive — this
    // daemon instance's own activeProcesses map only knows about processes IT
    // spawned. If the daemon was killed/restarted mid-spawn (e.g. tsx watch
    // reloading on a file save), the row is left claiming 'starting' forever,
    // and every future tick below would skip respawning it since the DB says
    // someone already has it. Verify with a real TCP probe before trusting it.
    for (const row of runningRes.rows) {
      const toolId = row.tool_id;
      if (activeProcesses.has(toolId)) continue; // owned by this process, no need to re-verify
      const alive = row.port ? await tcpProbe(portRange.host, row.port) : false;
      if (!alive) {
        console.log(
          `[MCP AutoManager] Stale runtime row for tool ${toolId} (status claims alive, nothing responds on port ${row.port ?? 'n/a'}) — clearing so it respawns`,
        );
        runningToolIds.delete(toolId);
        await upsertRuntimeState({
          toolId,
          method: 'sse',
          port: null,
          pid: null,
          status: 'crashed',
          lastError: 'Stale row from a previous daemon instance — no live process found on probe',
        });
      }
    }

    const expectedServerIds = new Set<string>();

    for (const tool of tools) {
      // Find the latest valid version
      const versions = typeof tool.versions === 'string' ? JSON.parse(tool.versions) : tool.versions;
      if (!versions || versions.length === 0) continue;

      const release = versions[versions.length - 1]?.released;
      // Only 'sse' tools are kept alive as persistent background processes by
      // this daemon. 'stdio' tools are spawned on-demand per-connection by
      // the LangGraph engine's StdioClientTransport (see engine.ts).
      if (!release || release.method !== 'sse') continue;

      const toolId = tool.tool_id;

      // Structured contract: { method, command, args: string[], env, port? }.
      // Legacy rows may still have `args` as a single concatenated string and
      // no `command` — do NOT attempt to parse/guess those, just skip.
      if (typeof release.args === 'string' || !release.command) {
        console.error(
          `[MCP AutoManager] Legacy args string detected for tool ${tool.name}; migrate to structured {command, args[]} format`,
        );
        continue;
      }

      if (!Array.isArray(release.args) || release.args.length === 0) continue;

      expectedServerIds.add(toolId);

      // Stale-build detection: applies to both stdio and sse tools spawned by
      // this daemon (only sse tools reach this point today, but the check
      // itself doesn't care about transport). If the entry file on disk is
      // newer than the mtime recorded when the currently-tracked process was
      // spawned, treat it exactly like a crash so the spawn check below
      // respawns it fresh against the new code.
      if (activeProcesses.has(toolId) || runningToolIds.has(toolId)) {
        const currentMtime = statEntryMtime(release.args);
        const recordedMtime = recordedEntryMtimes.get(toolId) ?? null;
        if (currentMtime !== null && recordedMtime !== null && currentMtime > recordedMtime) {
          console.log(
            `[MCP AutoManager] Restarting ${tool.name} — build changed since process start (spawned against mtime ${recordedMtime}, current mtime ${currentMtime})`,
          );
          const active = activeProcesses.get(toolId);
          if (active) {
            active.child.removeAllListeners('exit');
            active.child.kill('SIGKILL');
            activeProcesses.delete(toolId);
          }
          await markStopped([toolId]);
          runningToolIds.delete(toolId);
        }
      }

      if (!activeProcesses.has(toolId) && !runningToolIds.has(toolId)) {
        // Fire-and-forget: each tool's start sequence (allocate, spawn,
        // liveness-check) runs independently so one slow/failing tool
        // doesn't block the rest of this sync tick.
        startSseTool(tool, release).catch((err) =>
          console.error(`${logPrefix(tool.name)} Unexpected error starting tool:`, err),
        );
      }
    }

    // Kill removed or offline processes
    const stoppedIds: string[] = [];
    for (const [toolId, { child, port }] of activeProcesses.entries()) {
      if (!expectedServerIds.has(toolId)) {
        console.log(`[MCP AutoManager:${port}] Stopping obsolete MCP process for tool ${toolId}`);
        child.removeAllListeners('exit');
        child.kill('SIGTERM');
        activeProcesses.delete(toolId);
        stoppedIds.push(toolId);
      }
    }
    await markStopped(stoppedIds);
  } catch (err) {
    console.error('[MCP AutoManager] Error syncing MCP servers:', err);
  }
}

// Check every 10 seconds for changes in the DB
setInterval(syncMcpServers, 10000);
syncMcpServers(); // Initial check

console.log('[MCP AutoManager] Daemon started. Monitoring database for Online MCP servers...');

async function shutdown() {
  console.log('[MCP AutoManager] Shutting down all MCP servers...');
  const ownedIds = [...activeProcesses.keys()];
  for (const { child } of activeProcesses.values()) {
    child.removeAllListeners('exit');
    child.kill('SIGKILL');
  }
  activeProcesses.clear();
  try {
    await markStopped(ownedIds);
  } catch (err) {
    console.error('[MCP AutoManager] Failed to mark tools stopped on shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown();
});
process.on('SIGTERM', () => {
  shutdown();
});
