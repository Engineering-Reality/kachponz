# Amadeus — UiPath Job/Queue Trace Dashboard + Kill the "Give Me the Folder Link Again" Friction

Working directories: `microservice/mcp-uipath/`, `microservice/transaction_tracker/`, `microservice/frontend/`.

Two independent problems, both scoped below. Do Part 1 first (it's the bigger architectural piece), Part 2 second.

---

## Part 1 — Trace UiPath robot execution from the agent, without opening Orchestrator

### Current state (confirmed by reading the code)

- `microservice/frontend/src/app/dashboard/page.tsx` is entirely built around the `transactions` table — `fetch(\`${apiUrl}/transactions?limit=50\`)`. This is the LC/SKBDN settlement state machine dashboard. It has nothing to do with UiPath job execution.
- Chat sessions in `agent-invoke/page.tsx` are persisted **only in `localStorage`** (`agent-sessions` key) — the server has zero knowledge of which chat triggered which UiPath job. There is no session_id sent to the backend, no server-side session table.
- `trigger_uipath_job` and `get_uipath_job_status` in `mcp-uipath/src/index.ts` return plain human-readable text (`Job ID: ...\nState: ...`) with no structured side-channel — nothing persists this anywhere once the chat scrolls past it.

The user wants: a real trace of every robot job triggered through agent chats — the 5 states (Pending, Running, Successful, Faulted, Stopped) — visible in a dashboard, without needing to open Orchestrator and paste links back into the chat. This requires new persistence, not just a new UI view on old data.

### 0. This feature's DB writes use RPC functions, per the established pattern

All non-trivial writes below (the upsert with conditional state transitions) go through Postgres functions in `db/functions/`, called via the existing `callFn()` wrapper in `src/db/rpc.ts` — same convention as `fn_complete_step`/`fn_fail_step`/`fn_update_agent` from the earlier RPC work. If that wrapper or directory doesn't exist yet in this codebase, create it first (it's small — see the RPC section below for the exact shape). Simple reads (the dashboard listing endpoint) stay as plain `SELECT` — no function needed there, consistent with "don't convert simple reads."

### 1. New table: `uipath_job_trace`

```sql
-- migrations/1789000000000_uipath_job_trace.ts
CREATE TABLE IF NOT EXISTS uipath_job_trace (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID REFERENCES agents(agent_id) ON DELETE SET NULL,
  tool_id         UUID REFERENCES tools(tool_id) ON DELETE SET NULL,
  session_label   VARCHAR,             -- client-supplied session identifier, best-effort correlation to a chat
  job_id          VARCHAR NOT NULL,
  job_key         VARCHAR,
  release_key     VARCHAR,
  process_name    VARCHAR,
  folder_id       VARCHAR,
  queue_name      VARCHAR,
  state           VARCHAR NOT NULL DEFAULT 'Pending',  -- Pending | Running | Successful | Faulted | Stopped
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_polled_at  TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  info            TEXT,
  raw_last_response JSONB
);
CREATE INDEX IF NOT EXISTS idx_uipath_job_trace_agent ON uipath_job_trace (agent_id);
CREATE INDEX IF NOT EXISTS idx_uipath_job_trace_job   ON uipath_job_trace (job_id);
CREATE INDEX IF NOT EXISTS idx_uipath_job_trace_state ON uipath_job_trace (state);
```

This table is intentionally separate from `transactions`/`transaction_events` — it's an observational log of agent-triggered robot activity, not part of the LC/SKBDN settlement state machine. It gets written to in **both** playground and production invoke modes — the earlier "playground skips DB writes" rule was specifically about not polluting the trade-finance transaction tables with test runs; this table exists precisely so playground/test invocations of UiPath jobs ARE traceable, which is the whole point of this feature.

### 2. Capture job data from the client's session, at the point of invocation

The frontend already generates a session identifier for `localStorage` (`agent-sessions`). Thread that same identifier through to the backend on every `run-agentic` call so job traces can be correlated to a specific chat:

In `agent-invoke/page.tsx`, add the current session's id/label to the request body:

```ts
body: JSON.stringify({
  // ...existing fields...
  sessionLabel: currentSessionId, // whatever the existing localStorage session key/id already is
})
```

Update `RunAgenticSchema` in `src/routes/schemas.ts` to accept `sessionLabel: z.string().optional()`, and thread it through `runAgenticStep`/`runAgenticStepStream` down into `loadMcpTools`'s tool-wrapping closure so it's available when a tool call happens.

### 3. Extract structured job data from tool results without polluting the LLM's context

Check the installed `@modelcontextprotocol/sdk` version's `CallToolResult` type first:

```bash
grep -n "structuredContent\|_meta" node_modules/@modelcontextprotocol/sdk/dist/**/*.d.ts 2>/dev/null | head -20
```

**If `_meta` (or `structuredContent`) is supported** by the installed SDK version, use it — this is the clean approach. Update the three relevant tools in `mcp-uipath/src/index.ts` to attach machine-readable data alongside the human text, without it ever entering the model's visible context:

```ts
return {
  content: [{ type: "text", text: `✅ UiPath job started.\nJob ID: ${job.Id}\n...` }],
  _meta: { jobId: String(job.Id), jobKey: job.Key, state: job.State, releaseKey: args.releaseKey },
};
```

Then in `loadMcpTools()` (`engine.ts`), after `mcpClient.callTool(...)` returns, check for `res._meta` and — only for `trigger_uipath_job`, `get_uipath_job_status`, and `bulk_add_uipath_queue_items`/`add_uipath_queue_item` (to also capture queue-side activity) — persist/update `uipath_job_trace` accordingly, using the `sessionLabel`/`agentId` already in scope in that closure. Never forward `_meta` into the text handed back to the LLM.

**If `_meta` is not reliably supported** by the installed SDK version, fall back to parsing the existing, already-consistent text format (pragmatic, not ideal — leave a comment explaining why):

```ts
function extractJobTrace(toolName: string, resultText: string) {
  if (toolName === 'trigger_uipath_job') {
    const jobId = /Job ID:\s*(\S+)/.exec(resultText)?.[1];
    const jobKey = /Job Key:\s*(\S+)/.exec(resultText)?.[1];
    const state = /State:\s*(\S+)/.exec(resultText)?.[1];
    return jobId ? { jobId, jobKey, state: state ?? 'Pending' } : null;
  }
  if (toolName === 'get_uipath_job_status') {
    const jobId = /^Job\s+(\S+):/m.exec(resultText)?.[1];
    const state = /State:\s*(\S+)/.exec(resultText)?.[1];
    const info = /Info:\s*(.+)$/m.exec(resultText)?.[1];
    return jobId && state ? { jobId, state, info } : null;
  }
  return null;
}
```

Add a unique constraint on `job_id` (repeated `get_uipath_job_status` calls must update the same row, not create duplicates):

```sql
ALTER TABLE uipath_job_trace ADD CONSTRAINT uq_uipath_job_trace_job_id UNIQUE (job_id);
```

This upsert has conditional, state-dependent logic (`started_at`/`ended_at` only set on specific transitions) — same category as `fn_complete_step` from the earlier RPC work. Make it a Postgres function, not inline `query()` calls, consistent with that established pattern (see `db/functions/README.md` if it already exists from prior work — add to it, don't start a second convention):

```sql
-- db/functions/fn_upsert_uipath_job_trace.sql
CREATE OR REPLACE FUNCTION fn_upsert_uipath_job_trace(
  p_agent_id      UUID,
  p_tool_id       UUID,
  p_session_label VARCHAR,
  p_job_id        VARCHAR,
  p_job_key       VARCHAR,
  p_release_key   VARCHAR,
  p_process_name  VARCHAR,
  p_folder_id     VARCHAR,
  p_queue_name    VARCHAR,
  p_state         VARCHAR,
  p_info          TEXT
)
RETURNS uipath_job_trace
LANGUAGE sql
AS $$
  INSERT INTO uipath_job_trace (
    agent_id, tool_id, session_label, job_id, job_key, release_key,
    process_name, folder_id, queue_name, state, info, triggered_at, last_polled_at
  )
  VALUES (
    p_agent_id, p_tool_id, p_session_label, p_job_id, p_job_key, p_release_key,
    p_process_name, p_folder_id, p_queue_name, p_state, p_info, now(), now()
  )
  ON CONFLICT (job_id) DO UPDATE SET
    state          = EXCLUDED.state,
    info           = COALESCE(EXCLUDED.info, uipath_job_trace.info),
    last_polled_at = now(),
    started_at     = COALESCE(uipath_job_trace.started_at,
                               CASE WHEN EXCLUDED.state = 'Running' THEN now() END),
    ended_at       = CASE WHEN EXCLUDED.state IN ('Successful','Faulted','Stopped')
                          THEN now() ELSE uipath_job_trace.ended_at END,
    process_name   = COALESCE(uipath_job_trace.process_name, EXCLUDED.process_name),
    queue_name      = COALESCE(uipath_job_trace.queue_name, EXCLUDED.queue_name)
  RETURNING *;
$$;
```

Call it via the same `callFn()` wrapper from the RPC work (`src/db/rpc.ts`):

```ts
await callFn('fn_upsert_uipath_job_trace', [
  agentId, toolId, sessionLabel, trace.jobId, trace.jobKey ?? null,
  trace.releaseKey ?? null, trace.processName ?? null, trace.folderId ?? null,
  trace.queueName ?? null, trace.state, trace.info ?? null,
]);
```

If `callFn`/`src/db/rpc.ts` doesn't exist yet in this codebase (the earlier RPC-functions task may not have landed), create it first — it's a ~10-line generic wrapper, don't inline raw `SELECT * FROM fn_x(...)` calls ad hoc at each site.

### 4. Background poller — jobs go stale between chat turns, they need to be polled independently

A job stays `Pending`/`Running` in the trace table forever unless something calls `get_uipath_job_status` again — and nothing does that automatically today. Add a lightweight poller, following the same pattern as the existing MCP process sync tick (check whether `mcpAutoManager.ts` or `mcpProcessManager.ts` is the current home for this kind of periodic task, add alongside it rather than inventing a third scheduler):

```ts
// runs every 15s
async function pollActiveJobTraces() {
  const { rows } = await query(`
    SELECT * FROM uipath_job_trace
    WHERE state IN ('Pending', 'Running')
      AND (last_polled_at IS NULL OR last_polled_at < now() - interval '15 seconds')
    LIMIT 50
  `);
  for (const row of rows) {
    try {
      // Reuse the existing UiPath OAuth token logic — either call mcp-uipath's
      // get_uipath_job_status via its already-running MCP connection, or hit
      // the Orchestrator Jobs API directly from transaction_tracker if a
      // token-fetch helper already exists there; don't duplicate OAuth logic
      // if it can be reused from mcp-uipath through the existing MCP client.
      const status = await fetchJobStatus(row.job_id, row.folder_id);
      // Reuse fn_upsert_uipath_job_trace instead of a second ad hoc UPDATE —
      // ON CONFLICT + COALESCE means passing NULL for fields we don't know
      // here (agent_id, tool_id, etc.) won't clobber what's already stored.
      await callFn('fn_upsert_uipath_job_trace', [
        null, null, null, row.job_id, null, null, null, row.folder_id, null,
        status.state, status.info ?? null,
      ]);
    } catch (e) {
      log.warn({ jobId: row.job_id, err: e }, 'Failed to poll job trace');
    }
  }
}
setInterval(pollActiveJobTraces, 15_000);
```

### 5. New tool: pull actual queue transaction items, not just job state

The user explicitly wants queue-item-level visibility too (transactions inside a queue: New/InProgress/Successful/Failed/Abandoned/Retried), not just job-level state. Add to `mcp-uipath/src/index.ts`:

```ts
server.tool(
  "get_uipath_queue_transactions",
  "List recent transaction items in a UiPath queue, with their processing status (New, InProgress, Successful, Failed, Abandoned, Retried).",
  {
    queueName: z.string().describe("Exact queue name, from list_uipath_queues"),
    folderId: z.string().optional(),
    top: z.number().int().positive().max(100).optional().default(25),
  },
  async (args) => {
    // GET /odata/QueueItems?$filter=QueueDefinition/Name eq '<queueName>'&$orderby=CreationTime desc&$top=<top>
    // same token/header pattern as existing tools
  }
);
```

### 6. New endpoint + new dashboard view

Add `GET /orchestrator/uipath-jobs` in `transaction_tracker` returning recent `uipath_job_trace` rows (joined with `agents.agent_name` for display), filterable by `agentId`/`state`/`sessionLabel`.

Add a new dashboard route `microservice/frontend/src/app/dashboard/robots/page.tsx` (or a tab on the existing dashboard — check which fits the current nav better) that:
- Fetches from the new endpoint, polls every 5-10s while the page is open.
- Renders each job as a row/card: process name, queue name, agent name, state (color-coded: Pending=slate, Running=blue+pulse, Successful=emerald, Faulted=red, Stopped=amber), triggered time, duration if ended.
- Clicking a row expands to show `get_uipath_queue_transactions` results for the associated queue, if one was involved.
- Keep a small "Open in Orchestrator ↗" link per row for power users who want the raw UI — this is now a convenience, not a requirement, to view status.

### Verification — Part 1

```bash
npm run migrate:up
psql $DATABASE_URL -c "\df fn_upsert_uipath_job_trace"
# trigger a job through agent-invoke, confirm a row appears in uipath_job_trace within 15s
psql $DATABASE_URL -c "SELECT job_id, state, process_name, session_label FROM uipath_job_trace ORDER BY triggered_at DESC LIMIT 5;"
# wait ~30s without touching the chat, confirm state transitions Pending -> Running -> Successful
# automatically via the poller, with no further chat interaction
curl http://127.0.0.1:8080/orchestrator/uipath-jobs
# open the new dashboard view, confirm the same job appears and updates live
```

---

## Part 2 — Stop asking for the folder link every session

### Root cause (confirmed)

Every UiPath tool defaults `folderId` to `process.env.UIPATH_FOLDER_ID ?? "0"`. That env var is only set if the tool's stored registration config included `account.folderId` in its credentials JSON (see the loading code near the top of `mcp-uipath/src/index.ts`). If "UiPath Iqbal" was registered without that field, every tool call silently defaults to folder `"0"` — wrong for this account — and the model has no way to know that except by trying and failing, which is exactly the back-and-forth you're seeing.

### 1. Backfill the existing registration (data fix, do this immediately, unblocks today)

```sql
-- Find the tool's current stored config first to confirm the shape
SELECT tool_id, name, versions FROM tools WHERE name ILIKE '%uipath%';
-- Then update the credentials JSON embedded in versions[latest].released.args
-- to include "folderId": "997942" if it's missing. Exact update depends on
-- the current JSON structure — inspect before writing the UPDATE.
```

### 2. Make `folderId` a required, explicit field at registration time — not buried in a JSON blob

In `microservice/frontend/src/app/tools/page.tsx`, for UiPath-type tool registration specifically, add a dedicated "Default Folder ID" input, marked required, with a "Test & List Folders" button that calls a new lightweight backend endpoint:

```ts
// GET /orchestrator/uipath/folders?clientId=...&clientSecret=...&baseUrl=...&org=...&tenant=...
// Fetches an OAuth token with the given credentials, then GET /odata/Folders,
// returns { id, fullyQualifiedName } list so the user picks from a dropdown
// instead of copy-pasting a folder ID out of a URL.
```

This turns "paste the link from Orchestrator" into "pick your folder from a dropdown once, at registration time" — the friction moves from every chat session to a single one-time setup step.

### 3. Proactive context on agent selection — the actual behavioral fix the user wants

When a UiPath-backed agent is selected in `agent-invoke/page.tsx`, don't wait for the user to ask "list the available queue." Fetch a live summary the moment the agent is selected, and show it in a persistent sidebar panel (not as a fake first chat message — that would consume a conversational turn and read oddly):

```tsx
// New component: <AgentContextPanel agentId={selectedAgent} />
// On mount / agent change:
//   - call list_uipath_processes and list_uipath_queues directly via a new
//     lightweight backend endpoint (not through the LLM — this is a pure data
//     fetch, no reasoning needed): GET /orchestrator/agents/:id/uipath-context
//   - render: "Processes available: RPA_Challenge (2 more...)"
//             "Queues: TestQueue (3 pending items)"
//   - a refresh icon button to re-fetch on demand
```

Add `GET /orchestrator/agents/:id/uipath-context` in `transaction_tracker`: looks up the agent's linked tools, and for any UiPath-type tool, calls `list_uipath_processes` + `list_uipath_queues` (+ optionally `get_uipath_queue_transactions` for a pending-item count) through the already-connected MCP client for that tool, and returns a compact JSON summary. This reuses existing tool logic — it does not duplicate the UiPath API calls in a second place.

This means: the moment you select "UiPath Iqbal" as the agent, the sidebar already shows "Processes: RPA_Challenge · Queues: TestQueue (0 pending)" before you type anything — no link-pasting, no "which folder" round-trip.

### Verification — Part 2

```bash
# 1. Confirm the backfilled folderId works without being asked:
#    select the UiPath agent, ask "list the available queue" with NO folder
#    link provided this time — expect it to just work.

# 2. Confirm the registration form now requires folderId and the folder-picker
#    dropdown populates real folder names from a test connection.

# 3. Confirm the sidebar context panel appears immediately on agent selection,
#    showing real process/queue names, before any message is sent.
```

## Constraints (carried over from prior work, still apply)

- No `shell: true`, no dynamic SQL string building for the new queries.
- Full raw response logging server-side for any new UiPath API call added.
- `_meta`/structured side-channel data must never leak into the text the LLM sees — verify by checking the actual prompt/context sent to the model after this change, not just that the DB row got written.
- Migrations additive only.
