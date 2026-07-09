# Amadeus — Dynamic Port Allocation for SSE MCP Servers

Working directory: `microservice/transaction_tracker/`.

## The problem

Right now, SSE-mode MCP servers use a **static, user-typed port**. Look at `microservice/frontend/src/app/tools/page.tsx` — the registration form has a plain `port` text input, and whatever the user types (`"10003"`, `"10005"`, ...) gets stored verbatim in `tools.versions[latest].released.port`. Then:

- `scripts/mcpAutoManager.ts` reads that static `release.port`, sets `env.PORT = release.port` and spawns the child.
- `src/orchestrator/engine.ts` (`loadMcpTools`, line ~192) reads that **same static value** again to build the client URL:
  ```ts
  const url = release.port.startsWith("http") ? release.port : `http://localhost:${release.port}/sse`;
  transport = new SSEClientTransport(new URL(url));
  ```

This breaks in two ways:
1. Two users register two SSE tools and happen to pick the same port → the second process fails to bind (`EADDRINUSE`), and nothing tells them why.
2. The port the user typed might already be held by an unrelated OS process, or held by a zombie from a previous crashed run.

We want ports assigned **dynamically at process-start time**, verified free via an actual socket bind test — the same technique the legacy Python code already uses. Read it first.

## Read this legacy code before writing anything

`microservice/mcp_tools/routes/tools.py`:

- `_load_port_config()` — loads `{host, start_port, end_port}` from `config/port_range.json` (defaults 127.0.0.1 : 10000–11999), overridable via `MCP_HOST` / `MCP_START_PORT` / `MCP_END_PORT` env vars.
- `get_free_port()` — the actual allocation algorithm:
  1. Refresh a cached set of "already assigned" ports from the DB every 30s.
  2. Build `candidate_ports = [p in range if p not in used_ports]`.
  3. If the candidate list is large, sample ~100 of them (for speed) plus first/middle/last of the range for spread.
  4. For each candidate, **actually bind a real socket** (`socket.bind((host, port))`), immediately close it, and return that port if the bind succeeded. This is the real correctness check — the "already assigned" set is just an optimization to avoid handing out a port that's *logically* taken even if nothing is bound to it yet.
  5. Falls back to a full range scan if the sampled attempt fails.
- `mcp_tools.py` `refresh_tools()` (the endpoint) additionally detects **duplicate ports across tools** in the stored config and reassigns the losers via `get_free_port()`.

Port your TypeScript version does not need the "duplicate port in DB" detection step — that whole class of bug goes away once ports are ephemeral runtime state instead of persisted static config (see below). But the **bind-test allocation algorithm** is exactly what to port.

Also read `config/port_range.json` at the repo root — reuse the same file so both stacks agree on the range during the migration period.

## Design for the TypeScript side

### 1. New table: `mcp_runtime_state` — the single source of truth for "where is this SSE tool actually listening right now"

```sql
-- migrations/1787000000000_mcp_runtime_state.ts
CREATE TABLE IF NOT EXISTS mcp_runtime_state (
  tool_id     UUID PRIMARY KEY REFERENCES tools(tool_id) ON DELETE CASCADE,
  method      VARCHAR NOT NULL,               -- 'sse' | 'stdio'
  port        INT,                            -- null for stdio
  pid         INT,
  status      VARCHAR NOT NULL DEFAULT 'stopped', -- starting | running | crashed | stopped
  last_error  TEXT,
  started_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Stop treating `tools.versions[latest].released.port` as live truth. It stays in the schema only as a legacy/display field (and becomes optional). The **runtime** port for an SSE tool lives only in `mcp_runtime_state`, and it can be different every single time the process (re)starts.

### 2. New service: `src/services/portAllocator.ts`

```ts
export interface PortRange { host: string; startPort: number; endPort: number; }

export class PortAllocator {
  constructor(range: PortRange, opts?: { sampleSize?: number });

  // Attempts an actual bind-and-release on a candidate port. Mirrors Python's socket.bind test.
  async isPortFree(port: number): Promise<boolean>;

  // Returns a free port not present in `excludePorts`, verified via real bind test.
  // Throws PortRangeExhaustedError if none found after sampling + full scan.
  async allocate(excludePorts: Set<number>): Promise<number>;
}
```

Implementation notes:
- Use Node's `net.createServer()`, call `.listen(port, host)`, on `'listening'` resolve true + immediately `.close()`; on `'error'` (EADDRINUSE etc.) resolve false. Wrap in a Promise, no callbacks left dangling.
- Load `{host, startPort, endPort}` from `config/port_range.json` by default; allow override via env vars `MCP_HOST`, `MCP_START_PORT`, `MCP_END_PORT` (add these to `src/config/env.ts` as optional, same defaults as Python: `127.0.0.1`, `10000`, `11999`).
- Sampling strategy: mirror Python — if the candidate list (range minus excluded) is large, try a random sample of ~100 plus first/middle/last, before falling back to a full linear scan. Keep this behavior because it's what makes `get_free_port()` fast in practice on a large range.
- `excludePorts` is supplied by the caller (the process manager), built from **currently running** `mcp_runtime_state` rows with `status IN ('starting','running')` — not from the static `tools.versions[...].port` column. This is the key behavioral change: exclusion set = "what's actually alive right now", not "what somebody once typed in a form."

### 3. Update `scripts/mcpAutoManager.ts` (or `src/services/mcpProcessManager.ts` if that refactor already landed — check first, don't create two competing implementations)

On each sync tick, for every `Online` tool with `release.method === 'sse'` that has no row in `mcp_runtime_state` with `status IN ('starting','running')`:

1. Build `excludePorts` = `Set<number>` of ports from all `mcp_runtime_state` rows currently `starting`/`running`.
2. `const port = await portAllocator.allocate(excludePorts)`.
3. Upsert `mcp_runtime_state` immediately with `status='starting', port, pid=null` **before** spawning — this reserves the port against a concurrent sync tick trying to allocate at the same instant (two tools coming online in the same 10s tick). Use `INSERT ... ON CONFLICT (tool_id) DO UPDATE`.
4. Spawn the child with `env.PORT = String(port)` (both `mcp-uipath` and `amadeus-mcp` already read `process.env.PORT` — confirmed in their `src/index.ts`, no server-side changes needed there).
5. On successful spawn, do a liveness check: poll `http://{host}:{port}/sse` (plain TCP connect is enough, doesn't need to be a valid SSE handshake) up to 5 times with backoff (200ms, 400ms, 800ms, 1600ms, 3200ms). On success: `UPDATE mcp_runtime_state SET status='running', pid=$pid, started_at=now()`. On failure after all retries: kill the child, `UPDATE mcp_runtime_state SET status='crashed', last_error=$reason`, and **release the port** (delete the row or set port=null) so the next sync tick allocates a fresh one — do not retry the same port.
6. Handle the `EADDRINUSE` race explicitly: if the child process itself fails to bind (reported via stderr pattern matching `/EADDRINUSE/` or a non-zero early exit within 1s of spawn), treat it exactly like a failed liveness check — release the port, mark crashed, and retry allocation+spawn up to 3 times total before giving up and logging a loud error.
7. On child `'exit'` (any time, not just at startup): `UPDATE mcp_runtime_state SET status='crashed', pid=null`. Do not reuse the old port on the next attempt — always call `portAllocator.allocate()` fresh. This satisfies "different port every time the server is started."
8. On graceful daemon shutdown (SIGINT/SIGTERM): kill all children, `UPDATE mcp_runtime_state SET status='stopped', pid=null` for all rows this instance owns.
9. Prefix every log line with the tool name and assigned port, e.g. `[UiPath Iqbal:10047] ...` — right now logs are prefixed by name only, the port is just as important for debugging.

### 4. Update `src/orchestrator/engine.ts` → `loadMcpTools`

Replace the current logic (around line 191):

```ts
if (release.method === "sse") {
  const url = release.port.startsWith("http") ? release.port : `http://localhost:${release.port}/sse`;
  transport = new SSEClientTransport(new URL(url));
}
```

with a lookup against `mcp_runtime_state`:

```ts
if (release.method === "sse") {
  const runtime = await query(
    `SELECT port, status FROM mcp_runtime_state WHERE tool_id = $1`,
    [config.tool_id]
  );
  const row = runtime.rows[0];
  if (!row || row.status !== 'running' || !row.port) {
    // record in the mcp_health report (see prior bug-fix pass) as 'not_running'
    // and skip this tool entirely — do not attempt to connect to a stale port.
    continue;
  }
  const url = `http://${env.MCP_HOST ?? '127.0.0.1'}:${row.port}/sse`;
  transport = new SSEClientTransport(new URL(url));
}
```

This is the crux of the fix: the LangGraph engine must never again read a port out of `tools.versions[...].released.port` for an SSE tool. It only trusts `mcp_runtime_state`, which is only ever written by the process manager that actually spawned (or failed to spawn) that exact process.

If the `mcp_health` SSE event / health-report mechanism from the earlier bug-fix pass isn't in this codebase yet, add a minimal version: collect `{ toolName, status: 'running'|'not_running'|'connect_failed', port }` per tool and log it; wiring it into the SSE stream is optional for this task but the *lookup-before-connect* behavior is not optional.

### 5. Frontend: `microservice/frontend/src/app/tools/page.tsx`

- For `method === 'sse'`, remove the free-text `port` input entirely. Replace with a read-only "Live port" field that is empty until the tool has actually been started at least once, then displays whatever `GET /orchestrator/mcp/status` (or equivalent) reports for that `tool_id` — with a small "●  running on :10047" / "○  stopped" indicator.
- For `method === 'stdio'`, no port field is shown at all (never was relevant).
- Keep `args`/`command`/`env` inputs as-is (those are unaffected by this change — separate concern from the earlier args-parsing bug fix, don't re-solve that here, just don't regress it).
- The "copy JSON snippet" helper (`getJsonSnippet`, ~line 124) currently interpolates the static `port` into the example config it shows the user. Change it to pull from the live status endpoint instead, or clearly label the shown port as "port will be assigned at runtime — check the status panel after starting."

### 6. New/confirm endpoint: `GET /orchestrator/mcp/status`

If this endpoint already exists (from a prior refactor), extend it; if not, add it:

```ts
// returns one row per tool with an mcp_runtime_state entry
[
  { toolId, toolName, method, port, status, pid, startedAt, lastError }
]
```

The frontend polls this every few seconds while the tools page is open, to reflect ports as they're actually assigned.

## Constraints (non-negotiable)

- **Never persist a "chosen" port back into `tools.versions[...].released.port` as if it were durable config.** That column becomes informational/legacy only. `mcp_runtime_state.port` is the only port anything should ever connect to.
- **Always verify with a real socket bind before handing out a port**, exactly like the Python reference. Do not just pick `startPort + offset` and hope.
- **Every restart gets a new allocation call.** Do not cache "last known good port" and try to reuse it — that defeats the purpose and reintroduces the exact collision risk we're removing.
- **No `shell: true`** in any spawn call (same rule as the earlier bug-fix pass, still applies).
- **stdio-method tools are entirely unaffected** by any of this — no port allocation, no `mcp_runtime_state.port` value (leave it `null`), skip them in the allocator entirely.
- Migrations are additive only.

## Verification plan

```bash
npm run migrate:up

# 1. Register two SSE tools, deliberately WITHOUT specifying a port (or with the same port — it must not matter anymore)
curl -X POST http://127.0.0.1:8080/tools -d '{"name":"SSE Tool A","on_status":"Online","versions":[{"released":{"method":"sse","command":"node","args":["/abs/path/to/amadeus-mcp/build/index.js"],"env":{}}}]}'
curl -X POST http://127.0.0.1:8080/tools -d '{"name":"SSE Tool B","on_status":"Online","versions":[{"released":{"method":"sse","command":"node","args":["/abs/path/to/mcp-uipath/build/index.js"],"env":{}}}]}'

# 2. Confirm both get DIFFERENT live ports, assigned dynamically
curl http://127.0.0.1:8080/orchestrator/mcp/status
# expect two rows, status='running', two distinct ports in the 10000-11999 range

# 3. Kill one process manually (simulate crash), confirm auto-restart picks a DIFFERENT port than before
kill -9 <pid-of-tool-A>
sleep 12   # wait for next sync tick
curl http://127.0.0.1:8080/orchestrator/mcp/status
# expect Tool A back to status='running' with a NEW port, different from its previous one

# 4. Restart the whole server process entirely, confirm ports reshuffle
# (Ctrl+C, npm run dev again)
curl http://127.0.0.1:8080/orchestrator/mcp/status
# expect both tools running again, ports likely different from the previous run

# 5. Agent invoke against an agent using both tools — confirm engine connects via mcp_runtime_state, not the static tools.versions.port
curl -N -X POST http://127.0.0.1:8080/orchestrator/run-agentic \
  -d '{"mode":"playground","agentId":"<agent-with-both-tools>","idempotencyKey":"k1","stream":true,"prompt":"list available tools"}'
# expect successful tool discovery from both servers regardless of their current live ports
```

All five steps must succeed with zero `EADDRINUSE` crashes and no manual port bookkeeping required from the user.
