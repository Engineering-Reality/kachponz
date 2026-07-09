# Amadeus Orchestrator — Robust Tools + Agents System

Working directory: `microservice/transaction_tracker/`.

You are refactoring the MCP tool registration + agent invocation flow so it stops crashing. There are **3 concrete bugs** live in production right now, all reproducible with the log in the appendix. Fix them in the order given, then apply the structural cleanup. No feature scope creep — the goal is to make the existing three-page flow (tools.html → agents.html → agent-invoke) actually work end to end.

---

## Product flow (do NOT change)

1. User registers an MCP server at `tools.html` (POST /tools, `on_status='Online'`).
2. The MCP AutoManager daemon spawns that server as a child process using the args stored in `tools.versions[latest].released.args`.
3. User creates an agent at `agents.html` and picks 1..N tools (multi-server MCP client).
4. User opens `agent-invoke`, sends a prompt → LangGraph engine loads all tools of the picked agent, connects to each MCP server, runs the ReAct loop, streams SSE back.

**All Python under `microservice/agent_creator/`, `microservice/mcp_tools/`, `microservice/agent_backend/` is legacy reference.** Read it to understand the intent, then port only what's missing. Do not run it, do not import it, do not shell out to Python. Every runtime path must be TypeScript.

---

## Bug 1 — MCP AutoManager mangles `args`, corrupts child process command

**Symptom** (verbatim from the log):

```
Cannot find module '/home/.../transaction_tracker/node /home/.../mcp-uipath/build/index.js '{"baseUrl":...}' --stdio'
```

**Root cause** (in `scripts/mcpAutoManager.ts`, function `parseArgs`):

The user stores this in `tools.versions[latest].released.args`:

```
node /home/firania/Downloads/ponzgen/microservice/mcp-uipath/build/index.js '{"baseUrl":"https://cloud.uipath.com","org":"anakindia",...}' --stdio
```

`parseArgs` currently:

1. Splits on spaces
2. Uses `spawn(cmd, args, { shell: false })`

But it (a) does NOT unquote correctly when a single-quoted JSON blob contains **double quotes inside**, and (b) more critically, `parseArgs` treats the JSON blob's own spaces/quotes as separators. The result is that the JSON string gets glued into the executable name.

**Fix — do this exactly:**

1. Replace the string-based `args` column contract with a **structured** JSON column contract. In `tools.versions[latest].released`, standardize on:

```json
{
  "method": "stdio",
  "command": "node",
  "args": [
    "/absolute/path/to/microservice/mcp-uipath/build/index.js",
    "{\"baseUrl\":\"https://cloud.uipath.com\",\"org\":\"anakindia\",\"tenant\":\"DefaultTenant\",\"clientId\":\"...\",\"clientSecret\":\"...\",\"scopes\":\"OR.Jobs OR.Robots.Read OR.Execution\",\"folderId\":\"997943\"}",
    "--stdio"
  ],
  "env": { "PORT": "10005" }
}
```

For `sse`:

```json
{
  "method": "sse",
  "port": 10002,
  "command": "node",
  "args": ["/absolute/path/to/microservice/amadeus-mcp/build/index.js"],
  "env": {}
}
```

Rules:
- `command` is the executable (e.g. `node`, `npx`, `python`, `uvx`).
- `args` is an **array of strings**. Each element is passed as-is to `execvp` — no shell interpretation, no re-splitting.
- Callers building this from the UI must NOT concatenate; they must build the array.

2. Rewrite `syncMcpServers()` in `scripts/mcpAutoManager.ts`:

   - Read `release.command` and `release.args` (array).
   - Delete `parseArgs()` entirely.
   - `spawn(release.command, release.args, { env: { ...process.env, ...release.env }, stdio: ['ignore', 'pipe', 'pipe'], shell: false })`.
   - Log the exact `command` and `args` array on startup (redact `clientSecret` if the key name matches `/secret|password|token|key/i`).

3. Backward compatibility shim: if a legacy row still has `release.args` as a **string** and no `release.command`, do NOT parse it. Log an error `"Legacy args string detected for tool <name>; migrate to structured {command, args[]} format"` and skip. Do not silently guess.

4. Add DB migration `migrations/1785000000000_normalize-tool-args.ts` that:
   - For each row in `tools`, if `versions[latest].released.args` is a string, attempt a one-shot conversion: split on `' '` respecting single-quoted spans as one token. Store as new structured shape.
   - If conversion is ambiguous (two or more quoted blobs, mismatched quotes), set `on_status='Offline'` and add `versions[latest].released.migration_error = 'AMBIGUOUS_LEGACY_ARGS'`.

5. Update the `POST /tools` and `PUT /tools/:id` handlers in `src/routes/tools.ts` to validate the structured shape via Zod:

```ts
const ReleaseSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('stdio'),
    command: z.string().min(1),
    args:    z.array(z.string()),
    env:     z.record(z.string()).default({}),
  }),
  z.object({
    method: z.literal('sse'),
    port:   z.number().int().positive(),
    command: z.string().min(1),
    args:    z.array(z.string()),
    env:     z.record(z.string()).default({}),
  }),
]);
```

Reject POSTs that don't conform. This prevents the UI from ever writing the broken shape again.

---

## Bug 2 — `runAgenticStepStream` writes to DB with a fabricated `txId`

**Symptom** (verbatim):

```
Failed to complete transaction in DB, but stream succeeded
DomainError: Transaksi tidak ditemukan
transaction_id: "52d5d8fa-3952-4c6e-8bba-529f1e43f03a"
```

**Root cause** (in `src/orchestrator/engine.ts` line 426 and line 558):

```ts
let txId = transactionId || `test-${Date.now()}`;
// ...
const isTest = txId.startsWith('test-') || txId.startsWith('invoke-');
if (!isTest) {
  await completeAndHandoff(auth, { transactionId: txId, ... });  // ← 404
}
```

The `isTest` check only catches strings prefixed `test-` or `invoke-`. The UI at `agent-invoke.html` sends a real UUIDv4 as `transactionId` even when the user is **just testing an agent** (there is no real transaction row backing it). Result: engine tries to complete a transaction that does not exist → 404 → the log warning fires every single invoke.

**Fix — do this exactly:**

1. Introduce a first-class **invocation mode** field on the request body of `POST /orchestrator/run-agentic`:

```ts
mode: z.enum(['playground', 'production']).default('playground')
```

Update `RunAgenticSchema` in `src/routes/schemas.ts` accordingly.

2. In `runAgenticStepStream` and `runAgenticStep`:

   - If `mode === 'playground'`: skip **all** DB writes. Do not call `completeAndHandoff`. Generate a synthetic `txId = 'playground-<uuid>'` for logging only. Set `step = 'playground'`.
   - If `mode === 'production'`: `transactionId` must be present and must exist in the `transactions` table. If it does not exist, return 400 with `{ code: 'TRANSACTION_NOT_FOUND' }` **before** starting the stream — do not silently swallow.

3. Delete the `txId.startsWith('test-') || txId.startsWith('invoke-')` heuristics. Replace with `mode !== 'production'`.

4. Update `microservice/frontend/agent-invoke.html` (and its TS/JS counterpart if any) to send `mode: 'playground'` for the test-drive UI. Never send a UUID that has no backing row.

5. Add a unit test in `test/engine.test.ts`:
   - Case A: mode=playground, no transactionId → 200 SSE stream, zero DB writes (assert with `pg` mock).
   - Case B: mode=production, unknown transactionId → 400 before stream opens.
   - Case C: mode=production, valid transactionId → stream + `completeStep` called once.

---

## Bug 3 — MCP client errors are swallowed, invoke keeps running with zero tools

**Symptom** (verbatim):

```
[MCP] Failed to connect to tool server
toolConfig: "UiPath Iqbal"
error: { code: -32000, name: "McpError" }
```

Then the stream still finishes with an answer, but the LangGraph agent had **zero tools available** — the fallback dummy tool kicked in. The user sees a plausible but useless response.

**Root cause** (in `src/orchestrator/engine.ts`, `loadMcpTools`):

```ts
try {
  await mcpClient.connect(transport);
  // ...
} catch (e) {
  log.warn(..., "[MCP] Failed to connect to tool server");   // ← swallowed
}
// then later:
if (langchainTools.length === 0) {
  // dummy fallback tool
}
```

**Fix — do this exactly:**

1. Add a **connection health report** to the engine result. Every attempted MCP server produces:

```ts
type McpServerHealth = {
  toolName: string;
  toolId: string;
  status: 'connected' | 'connect_failed' | 'list_tools_failed' | 'no_versions';
  error?: string;      // sanitized, no secrets
  loadedTools: string[];
};
```

Accumulate into `report: McpServerHealth[]`.

2. Emit the report as the **first SSE event** of every stream, before any LLM chunk:

```
event: mcp_health
data: {"servers":[{"toolName":"UiPath Iqbal","status":"connect_failed","error":"..."}]}
```

The frontend must display this above the chat, so the user immediately sees which tools failed.

3. Add a new response field on the non-stream endpoint too: `{ output, mcpHealth: [...] }`.

4. If **all** requested tools failed to connect AND the agent was created with `>=1` tool linked, refuse to run:

```ts
throw new DomainError('NO_TOOLS_AVAILABLE',
  'None of the agent\'s registered MCP servers are reachable', 424,
  { report });
```

Return 424 (Failed Dependency), do not silently answer with a dummy tool. This is the single most important behavioral change: an agent with broken tools must **fail loud**, not fail helpful.

5. Remove the "dummy fallback tool" that hides missing-tool state. Only keep a fallback if the agent has zero tools registered on purpose (pure chat agent) — detect this at agent config load, not at MCP failure time.

6. Add exponential backoff retry to MCP connect: 3 attempts, 200ms → 600ms → 1800ms. Wrap `mcpClient.connect(transport)` and `mcpClient.listTools()`.

---

## Structural cleanup (do these after the three bugs are fixed)

### C1 — Extract `mcpProcessManager` into `src/services/mcpProcessManager.ts`

Right now `scripts/mcpAutoManager.ts` is a script spawned as a **separate child process** from `server.ts` via `spawn('tsx', ['../scripts/mcpAutoManager.ts'])`. That means:
- The daemon has its own PG pool → double connections.
- Crashes in the daemon are invisible to the API server.
- Logs are duplicated.

Fold it into the API server as an in-process service:

```
src/services/mcpProcessManager.ts
  export class McpProcessManager {
    start()      // begin 10s poll
    stop()       // SIGTERM all
    status()     // list of { toolId, pid, uptimeSec, port, method }
    healthOf(id) // liveness probe
  }
```

Wire it in `src/server.ts`:

```ts
const mcpManager = new McpProcessManager({ pool, logger });
await mcpManager.start();
app.addHook('onClose', () => mcpManager.stop());
```

Add endpoint `GET /orchestrator/mcp/status` that returns `mcpManager.status()`. The frontend can poll this to show a live process status list.

### C2 — Agent config: the tools binding must be a foreign key list, not stored blob

Read `microservice/agent_backend/routes/agents.py` — the legacy contract is a many-to-many between `agents` and `tools`. Right now the TS side stores `tools` inconsistently. Make the schema explicit:

```sql
-- migrations/1786000000000_agent_tools.ts
CREATE TABLE IF NOT EXISTS agent_tools (
  agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  tool_id  UUID NOT NULL REFERENCES tools(tool_id)   ON DELETE CASCADE,
  PRIMARY KEY (agent_id, tool_id)
);
```

Update `src/routes/agents.ts`:

- `POST /agents` body accepts `tools: string[]` (tool_ids). On insert, write to `agents` table and `agent_tools` in the same transaction.
- `GET /agents/:id` joins `agent_tools` + `tools` and returns `tools: Tool[]` fully hydrated.
- `PUT /agents/:id` overwrites the set.

Then in `loadMcpTools`, when the caller passes `agentId`, look up the tools via the join table — not via the deprecated JSONB blob on the agent row.

### C3 — Playground history is per-session, not persisted

Since playground mode doesn't touch `transactions`, keep the last 20 playground runs in memory keyed by `session_id` (cookie-set, 24h expiry). Endpoint `GET /orchestrator/playground/history` returns them. Do **not** create a new DB table for this.

### C4 — Env validation must fail fast on required vars

In `src/config/env.ts`, elevate these from optional to required if `MCP_AUTO_MANAGER=on` (default on):

- `DATABASE_URL`
- `MCP_TOOLS_DIR` (absolute path; used to validate `release.args[0]` starts with this dir — prevents arbitrary binary execution from DB).

Add a warm-up check at server startup: for each `on_status='Online'` tool, verify `release.args[0]` is a file that exists on disk. If not, log a bright warning and mark the tool `on_status='ConfigInvalid'` in DB.

---

## Deliverables

1. `scripts/mcpAutoManager.ts` — rewritten, structured `command`/`args[]` contract, no `parseArgs`.
2. `src/services/mcpProcessManager.ts` — new, in-process manager (structural cleanup C1).
3. `src/orchestrator/engine.ts` — `loadMcpTools` returns health report, playground mode skips DB writes, retry with backoff.
4. `src/routes/tools.ts` — Zod discriminated union for release, rejects malformed shape.
5. `src/routes/agents.ts` — uses `agent_tools` join table.
6. `src/routes/schemas.ts` — `RunAgenticSchema` gains `mode` field.
7. `src/routes/orchestrator.ts` — new `GET /orchestrator/mcp/status`, `GET /orchestrator/playground/history`.
8. `migrations/1785000000000_normalize-tool-args.ts` — data migration.
9. `migrations/1786000000000_agent_tools.ts` — many-to-many table.
10. `test/engine.test.ts`, `test/tools.test.ts`, `test/agents.test.ts` — cover the three bug scenarios and the new mode semantics.
11. Update `microservice/frontend/agent-invoke.html` (and js/ts) to send `mode: 'playground'` and render the `mcp_health` SSE event before the chat.
12. Update `microservice/frontend/tools.html` UI to collect `command` + `args[]` + `env{}` as separate inputs, not a single textarea. The single-textarea input is what produced the bug in the first place.

---

## Verification plan

Run all of these locally and paste the log outputs when done:

```bash
# 0. Migrate
npm run migrate:up

# 1. Register a UiPath tool via API with the new structured shape
curl -X POST http://127.0.0.1:8080/tools -H 'content-type: application/json' -d '{
  "name": "UiPath Test",
  "on_status": "Online",
  "versions": [{"released": {
    "method": "stdio",
    "command": "node",
    "args": [
      "/absolute/path/to/microservice/mcp-uipath/build/index.js",
      "{\"baseUrl\":\"https://cloud.uipath.com\",\"org\":\"anakindia\",\"tenant\":\"DefaultTenant\",\"clientId\":\"xxx\",\"clientSecret\":\"xxx\",\"scopes\":\"OR.Jobs\",\"folderId\":\"997943\"}",
      "--stdio"
    ],
    "env": {}
  }}]
}'

# 2. Confirm process spawned
curl http://127.0.0.1:8080/orchestrator/mcp/status
# expect: [{"toolId":"...","pid":<num>,"uptimeSec":<>,"method":"stdio"}]

# 3. Playground invoke — no transactionId, no DB write
curl -N -X POST http://127.0.0.1:8080/orchestrator/run-agentic \
  -H 'content-type: application/json' \
  -d '{"mode":"playground","agentId":"<agent-uuid>","idempotencyKey":"k1","stream":true,"prompt":"List UiPath processes"}'
# expect first SSE event:  event: mcp_health  data: {"servers":[{"toolName":"UiPath Test","status":"connected","loadedTools":[...]}]}
# expect subsequent LLM chunks, then event: complete
# expect NO "Transaksi tidak ditemukan" warning in server log

# 4. Playground invoke against an intentionally broken tool
# (set on_status='Online' but point args[0] at a non-existent path)
# expect: 424 NO_TOOLS_AVAILABLE

# 5. Production invoke against a real transactionId — end-to-end DB write
curl -N -X POST http://127.0.0.1:8080/orchestrator/run-agentic \
  -H 'content-type: application/json' \
  -d '{"mode":"production","transactionId":"<real-uuid>","agentId":"...","idempotencyKey":"k2","stream":true,"prompt":"..."}'

# 6. Unit tests
npm run test
```

All six steps must pass with **zero** `Failed to complete transaction in DB` warnings and **zero** `Cannot find module` errors.

---

## Constraints (non-negotiable)

- **No Python at runtime.** Legacy Python is reference-only.
- **No `shell: true` in `spawn` calls, ever.** Every process spawn uses the array form.
- **No string concatenation to build shell commands.** If you find yourself typing `` ` `` around a command, stop and use `spawn(cmd, args[])`.
- **No secrets in logs.** Redact any key matching `/secret|password|token|apiKey|clientSecret/i`.
- **Every new endpoint returns typed Zod-validated responses.**
- **Every child process's stdout/stderr is prefixed with the tool name** in logs. No more anonymous `[undefined]` prefixes.
- **Migrations are additive.** Never drop or alter existing columns; add new ones with defaults.
- Playground mode must be the **default** in the invoke UI so bank users can experiment without polluting `transactions`.

---

## Appendix — original error log (for regression testing)

```
Error: Cannot find module '/home/firania/.../transaction_tracker/node /home/firania/.../mcp-uipath/build/index.js '{"baseUrl":"https:/cloud.uipath.com",...}' --stdio'
code: 'MODULE_NOT_FOUND'
```

```
[MCP] Failed to connect to tool server
toolConfig: "UiPath Iqbal"
error: { code: -32000, name: "McpError" }
```

```
Failed to complete transaction in DB, but stream succeeded
DomainError: Transaksi tidak ditemukan
transaction_id: "52d5d8fa-3952-4c6e-8bba-529f1e43f03a"
code: "NOT_FOUND"
httpStatus: 404
```

When you're done, these three log lines must not reappear under the verification steps.
