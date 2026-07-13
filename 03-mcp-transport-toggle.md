# Prompt #3 — Amadeus: Make MCP Transport (SSE vs stdio) Actually Selectable Per Tool

## Context you need before touching anything

Read these first, in this order:

1. `microservice/transaction_tracker/src/orchestrator/engine.ts` lines 387–400 (`buildTransport`) — the client already branches on `release.method === "sse" | "stdio"`. This is the TypeScript-side consumer.
2. `microservice/transaction_tracker/src/orchestrator/mcpAdapters.ts` — shows a hand-written stdio-only MCP *server* boilerplate. Native TS MCP tools currently only speak stdio.
3. `microservice/mcp_2/mcp_auto_manager.py` lines 90–168 (`_parse_mcp_tools`) — the legacy Python manager that spawns MCP servers. Note line 159: `command = f"mcp-proxy --sse-port={port} ... -- {args}"` — **every** tool gets wrapped in `mcp-proxy` and forced onto SSE, regardless of what `release.method` says elsewhere.
4. `microservice/transaction_tracker/migrations/1792000000000_normalize_mcp_commands.ts` — shows there's already a `method` column somewhere (`tools` table) storing `'sse' | 'stdio'`. Find and read that table's schema.
5. `microservice/transaction_tracker/src/orchestrator/mcpManagerState.ts` — read the comment referencing `"fetch failed" on the first tool call` to understand the current startup race between the manager and the first client connect.

## The problem

There are actually TWO places that decide transport, and they don't agree:

- **`engine.ts`'s `buildTransport()`** already supports both `StdioClientTransport` and `SSEClientTransport` based on a `release.method` field read from the DB (`tools` table, `versions[].released.method` presumably).
- **`mcp_auto_manager.py`'s `_parse_mcp_tools()`** always wraps every tool command in `mcp-proxy --sse-port=...`, forcing SSE transport at the process-spawn level regardless of what's stored as `method`. So even if a tool's DB row says `method: 'stdio'`, the Python manager still spawns it behind an SSE proxy, and the TS client tries to speak raw stdio to what's actually an SSE port — mismatch, silent failure, or (more likely) the `method` field is currently unused/always `'sse'` in practice and stdio was never truly wired end-to-end.

You want: **register a tool once, pick stdio or SSE for it, and have both the spawner (currently Python, moving to TS) and the client agree on that choice** — with stdio being the lower-overhead default for local/native TS MCP servers (like the one boilerplate’d in `mcpAdapters.ts`), and SSE reserved for tools that genuinely need a long-lived network-addressable process (e.g. shared across multiple orchestrator instances, or a Python tool that can't be spawned as a stdio child of the Node process).

## What to build

### Part A — Confirm and fix the DB contract

Find the `tools` table schema (likely in an early migration). Confirm there's a `method` field (or add one) on the release/version JSON with allowed values `'sse' | 'stdio'`. If it's missing, add a migration:

```sql
-- if tools.versions is JSONB, this is a data migration not a schema one;
-- if there's a dedicated column, ALTER TABLE tools ADD COLUMN default_method text
--   DEFAULT 'stdio' CHECK (default_method IN ('sse','stdio'));
```

Check whether `normalize_mcp_commands.ts` (the migration you already read) already touches this — don't duplicate work it did.

### Part B — Fix `mcp_auto_manager.py` to respect `method` (stop-gap while Python is legacy)

Since Python is being phased out but is still what runs today, patch `_parse_mcp_tools` so it branches:

```python
method = tool.get('method', 'sse')  # read from the DB row, not hardcoded
if method == 'sse':
    command = f"mcp-proxy --sse-port={port} {env_flags} -- {args}".strip()
else:  # stdio
    # No mcp-proxy wrapper — pass the raw command through so the spawned
    # process speaks stdio directly. The manager still needs to track its
    # PID for lifecycle/health-check purposes, just not a port.
    command = f"{env_flags} {args}".strip() if env_flags else args
    port = None
```

Downstream, `_start_tool` / the health-check loop currently assumes every running tool has a port (`self.running_processes[tool_name]['port']`). Audit that path and make port optional for stdio tools — health checks for stdio tools should check "is the PID alive" instead of "does the port respond."

### Part C — Build the equivalent TS-native spawner (forward path)

Given Python is legacy, the actual fix that matters long-term is a TS spawner that replaces `mcp_auto_manager.py`. Scope for THIS prompt: only build the piece needed to unblock per-tool transport selection — not a full rewrite of the manager (that's a separate, bigger migration; flag it as follow-up work in the PR description, don't attempt it here).

Add a small `src/orchestrator/mcpSpawner.ts` module with:

```ts
export async function spawnMcpTool(tool: ToolRow): Promise<SpawnResult> {
  const method = tool.method ?? 'stdio';
  if (method === 'stdio') {
    // Just resolve command/args/env — the actual child process is spawned
    // lazily by StdioClientTransport itself when the agent connects, per
    // the existing buildTransport() pattern in engine.ts. No manager-owned
    // long-running process needed for stdio tools.
    return { method: 'stdio', command: tool.command, args: tool.args, env: tool.env };
  }
  // SSE path: still needs a manager-owned long-running process + port
  // allocation. Reuse the existing port-allocation logic — find it in
  // mcp_auto_manager.py's port range logic (config/port_range.json) and
  // port it to TS, don't reinvent the range.
  return spawnSseProcess(tool);
}
```

Key insight to preserve: **stdio tools don't need the "manager" at all** — `StdioClientTransport` in `engine.ts` already spawns its own child process per connection (see line 393–397, it takes `command`/`args`/`env` directly). The Python manager's job for stdio tools should shrink to "resolve and validate the command exists" — not "keep it running as a daemon." Only SSE tools need a persistent manager-owned process, because SSE clients connect to an already-listening port rather than spawning their own process.

This means: **for any tool that can be stdio, you can likely skip the manager entirely and let `engine.ts`'s existing `buildTransport()` handle it as-is** — the missing piece is just making sure the `tools` table row has the right `command`/`args`/`env`/`method: 'stdio'` populated, which may already work today. Verify this with a spike before building `mcpSpawner.ts`: register one simple native TS tool (e.g. adapt `mcpAdapters.ts`'s boilerplate) with `method: 'stdio'` and confirm `engine.ts` connects to it with ZERO Python manager involvement. If that spike works, Part C shrinks to "fix the registration UI/API to accept `method: 'stdio'` as a first-class option" — see Part D.

### Part D — Frontend: tool registration UI

Find the tool registration page (likely `microservice/frontend/src/app/tools/` or similar — check `agent-creator` and `tools` folders under `src/app/`). Add a radio/select for transport method (`stdio` default, `sse` opt-in) when registering a new MCP tool, with inline help text:

- **stdio** — "Recommended. Tool runs as a child process per agent connection. No port management, no persistent daemon."
- **sse** — "Use only if the tool must run as a shared long-lived service (e.g. legacy Python tools via mcp-proxy, or a tool shared across multiple orchestrator instances)."

### Part E — MCP status endpoint should show method without requiring a port

`GET /orchestrator/mcp/status` (routes.ts ~126) currently joins against `mcp_runtime_state` which assumes port/pid tracking. For stdio tools that spawn per-connection, "status" doesn't mean "is a daemon running" — it means "did the last connection attempt succeed." Adjust the query/response so stdio tools show `status: 'stdio (spawned on demand)'` instead of a misleading `stopped`.

## Acceptance criteria

- [ ] A tool registered with `method: 'stdio'` connects successfully via `engine.ts`'s existing `buildTransport()` with zero involvement from `mcp_auto_manager.py`.
- [ ] A tool registered with `method: 'sse'` still works exactly as it does today (no regression).
- [ ] `mcp_auto_manager.py` no longer force-wraps every tool in `mcp-proxy` — it branches on `method`.
- [ ] The Tools registration page in the frontend lets you pick stdio or SSE, with stdio as the default for new registrations.
- [ ] `GET /orchestrator/mcp/status` doesn't show stdio tools as permanently "stopped" just because they have no port.

## Non-goals

- Do NOT do the full TS rewrite of `mcp_auto_manager.py` in this PR — that's tracked separately. This prompt only needs the `method` branch fixed in the Python file plus the TS-side registration/status polish.
- Do NOT change SSE tools' behavior or port allocation range.
- Do NOT migrate existing SSE-registered tools to stdio automatically. Method changes are per-tool, opt-in, manual.
