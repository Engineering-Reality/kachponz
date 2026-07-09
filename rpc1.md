# Amadeus — Phase 1: Actually Verify "Failed to Fetch" Is Fixed (Live) — Phase 2: Postgres RPC Functions

Working directories: `microservice/transaction_tracker/`, `microservice/frontend/`, `microservice/mcp-uipath/`.

Read this whole file before starting. Phase 1 and Phase 2 are unrelated to each other — Phase 2 (RPC functions) does not fix or affect "Failed to fetch" in any way. It's included here because it's separately worth doing, not because it's part of the same bug. Do not skip Phase 1's live verification just because the static fix looks correct on paper — it already looked correct on paper once before and wasn't actually confirmed.

---

## Phase 1 — Confirm "Failed to fetch" is actually gone, and harden against the causes that survive the current fix

### What was already done (context, don't redo)

- `bodyLimit` bumped 1MB → 10MB in `src/server.ts`.
- `agent-invoke/page.tsx` now strips base64 attachment content from all but the current turn, capped to last 20 turns.

This was applied from static code reading, **never reproduced live in a browser**. Do that now, in this order:

### Step 1 — Instrument before testing

Add temporary (but useful long-term, keep them) diagnostics to `src/server.ts` on the `/orchestrator/run-agentic` route:

```ts
app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/orchestrator/run-agentic' && req.method === 'POST') {
    const contentLength = req.headers['content-length'];
    req.log.info({ contentLength, origin: req.headers.origin }, 'run-agentic request received');
  }
});
```

Confirm `@fastify/cors` (or whichever CORS plugin is registered) is set up to decorate **error responses** too, not just successful ones — this is the single most common reason "Failed to fetch" survives a payload-size fix. Check `src/server.ts` for the CORS plugin registration:

```ts
// Confirm this exists and runs early enough to cover error paths (413, 500, etc.),
// not just 2xx responses. If CORS headers are only attached in a success-path hook,
// any error response (including a 413 from a body-limit rejection) will lack
// Access-Control-Allow-Origin, and the browser will report the failure as an opaque
// "Failed to fetch" / CORS error instead of a readable HTTP status — even though
// the fetch went out and a real error came back.
await app.register(cors, {
  origin: true, // or the explicit frontend origin(s)
  credentials: true,
});
```

If this plugin is registered **after** other route-specific hooks or plugins that could short-circuit the request (e.g. auth middleware that rejects before CORS runs), error responses from those earlier hooks won't carry CORS headers either. Check registration order in `src/server.ts` — `cors` should generally be one of the first things registered, before auth middleware and before the body parser's limit check takes effect if possible. Report the current order before changing it.

### Step 2 — Reproduce live, in a browser, with DevTools open

```
1. Start the full stack: npm run dev (transaction_tracker), and the frontend.
2. Open the exact chat session that previously failed (the one with the PDF
   attachment + 10 add_uipath_queue_item calls in history), or construct an
   equivalent one if the old session isn't available.
3. Open DevTools → Network tab BEFORE sending the next message.
4. Send a message that previously triggered "Failed to fetch"
   (e.g. "yes trigger and process these queues").
5. Find the request to /orchestrator/run-agentic in the Network tab.
```

Report exactly what you see for that request:

- **Status column**: a number (200, 413, 500, etc.), or `(failed)`, or `(canceled)`, or blank/pending forever.
- **Size column**: the actual request payload size sent.
- If status is `(failed)`, click into it and check the specific error text Chrome/Firefox shows (e.g. `net::ERR_FAILED`, `net::ERR_CONNECTION_RESET`, a CORS-specific message in the Console tab alongside it).
- Check the **Console tab** in the same moment — a CORS rejection prints a specific, distinct message there (`"has been blocked by CORS policy"`) that's different from a generic network failure. If you see that specific message, the cause is CORS/missing-headers-on-error-path (see Step 1's note), not payload size.

### Step 3 — Branch based on what Step 2 actually showed

**If the request now succeeds (200, reasonable size)** — Phase 1's original fix worked. Still verify:
- Confirm the outbound size is meaningfully smaller than before (should be well under 100KB for a text-only follow-up turn, not several MB).
- Re-run the *entire* original failing scenario end to end once more (upload PDF → extract → queue → trigger) to confirm nothing regressed.
- Done, move to Phase 2 if desired.

**If status is a clean 413** — the payload is still too big even at 10MB, or `bodyLimit` didn't actually take effect (check it's reading from the right Fastify instance — if there are multiple `Fastify()` instantiations or the dev server didn't restart after the change, an old instance could still be running with the default limit). Verify:
```bash
grep -n "bodyLimit" microservice/transaction_tracker/src/server.ts
ps aux | grep "tsx watch src/server.ts"
```
Restart cleanly, retest.

**If status is `(failed)` with a CORS message in Console** — this is the missing-headers-on-error-path issue from Step 1. Fix the CORS plugin registration order and/or explicitly handle CORS headers in Fastify's `onError` hook so every error response (regardless of which hook rejected it) gets `Access-Control-Allow-Origin` attached:

```ts
app.setErrorHandler((error, request, reply) => {
  reply.header('Access-Control-Allow-Origin', request.headers.origin ?? '*');
  reply.header('Access-Control-Allow-Credentials', 'true');
  // ... existing error handling logic, don't remove it, just ensure headers are set first
});
```

**If status is `(failed)` with no CORS message, and no request ever appears in the server's own logs** — the request never reached the server at all. Check:
- Is `tsx watch` mid-restart at that exact moment (a file save triggering a reload while the request was in flight)? Check the server's stdout timestamp against the request timestamp.
- Is the frontend pointed at the correct `apiUrl` (check for a stale env var, a hardcoded port that changed due to the earlier dynamic-port-allocation work, or a proxy misconfiguration)?

**If the request hangs indefinitely (pending, never resolves)** — this is a different bug than the original "Failed to fetch" (that one failed fast). Check whether the SSE stream from `runAgenticStepStream` is waiting on a hung MCP tool call (e.g. `bulk_add_uipath_queue_items` or `trigger_uipath_job` blocked on a slow/unresponsive UiPath API call with no timeout). Add a timeout wrapper around outbound UiPath `fetch()` calls in `mcp-uipath/src/index.ts` if none exists:

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30_000);
try {
  const res = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(timeoutId);
  // ...
} catch (e) {
  clearTimeout(timeoutId);
  if (e instanceof Error && e.name === 'AbortError') {
    return { content: [{ type: "text", text: `UiPath request timed out after 30s.` }], isError: true };
  }
  throw e;
}
```

### Step 4 — Report back before moving to Phase 2

State explicitly: which branch of Step 3 applied, what the actual root cause was, and confirmation that the live end-to-end scenario now passes. Do not mark Phase 1 done on static reasoning alone a second time.

---

## Phase 2 — Postgres RPC functions (unrelated to Phase 1, separate value)

This phase is about atomicity and removing dynamic-SQL-string construction from the write paths — it does not touch HTTP, CORS, payload size, or anything related to "Failed to fetch." Do this because it's good practice, not because it fixes Phase 1's bug.

### Scope

Four targets only — do not convert simple single-table reads, there's no benefit there:

1. `services/transactions.ts` → `completeStep()` — currently idempotency check + row lock + optimistic-lock update + event insert as ~4 separate round trips inside an app-level `withTransaction()`.
2. `services/transactions.ts` → `failStep()` — same shape, simpler.
3. `routes/agents.ts` PUT handler — currently builds `UPDATE agents SET ${fields.join(', ')}` via dynamic string concatenation of column names (values are parameterized, but the column-list construction itself is fragile boilerplate).
4. `mcp_runtime_state` reserve/release (from the dynamic port allocation work, if that's landed in this codebase — check first) — needs atomic reserve-before-spawn semantics under concurrent sync ticks.

### Important boundary

Do **not** port `src/config/stepFlows.ts`'s flow-validation logic (forward/backward transition legality, financial-step gating) into SQL. That's versioned, type-checked TypeScript config and must stay the single source of truth for the state machine's shape. The SQL functions below receive **already-validated** `newStep`/`newStatus`/`financial` values from TypeScript — they only own the atomic write path (idempotency check, lock, update, insert), not the business rules about which transitions are legal.

### 1. Directory structure

```
microservice/transaction_tracker/
  db/
    functions/
      fn_complete_step.sql
      fn_fail_step.sql
      fn_update_agent.sql
      fn_reserve_mcp_port.sql
      fn_release_mcp_runtime.sql
      README.md   ← one line per function: name, args, returns, called from which TS file
```

One `CREATE OR REPLACE FUNCTION` per file, never combined — migrations need to diff cleanly.

### 2. Migration wiring

`migrations/1788000000000_rpc_functions.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const FUNCTION_FILES = [
  'fn_complete_step.sql',
  'fn_fail_step.sql',
  'fn_update_agent.sql',
  'fn_reserve_mcp_port.sql',
  'fn_release_mcp_runtime.sql',
];

export async function up(pgm: MigrationBuilder): Promise<void> {
  for (const file of FUNCTION_FILES) {
    const sql = fs.readFileSync(path.join(__dirname, '../db/functions', file), 'utf8');
    pgm.sql(sql);
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP FUNCTION IF EXISTS fn_complete_step;
    DROP FUNCTION IF EXISTS fn_fail_step;
    DROP FUNCTION IF EXISTS fn_update_agent;
    DROP FUNCTION IF EXISTS fn_reserve_mcp_port;
    DROP FUNCTION IF EXISTS fn_release_mcp_runtime;
  `);
}
```

Use `CREATE OR REPLACE FUNCTION` everywhere so migrations are safely rerunnable in dev.

### 3. `fn_complete_step`

```sql
-- db/functions/fn_complete_step.sql
CREATE OR REPLACE FUNCTION fn_complete_step(
  p_transaction_id   UUID,
  p_expected_version INT,
  p_new_step         VARCHAR,
  p_new_status       VARCHAR,
  p_actor            VARCHAR,
  p_reason           TEXT,
  p_idempotency_key  VARCHAR,
  p_payload          JSONB,
  p_financial        BOOLEAN
)
RETURNS TABLE (
  out_transaction_id UUID,
  out_current_step   VARCHAR,
  out_status         VARCHAR,
  out_version        INT,
  out_event_id       UUID,
  out_idempotent_replay BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_event transaction_events%ROWTYPE;
  v_tx transactions%ROWTYPE;
  v_event_id UUID;
BEGIN
  SELECT * INTO v_existing_event
    FROM transaction_events
   WHERE transaction_id = p_transaction_id
     AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    RETURN QUERY SELECT v_tx.id, v_tx.current_step, v_tx.status, v_tx.version,
                        v_existing_event.id, TRUE;
    RETURN;
  END IF;

  UPDATE transactions
     SET current_step = p_new_step,
         status       = p_new_status,
         version      = version + 1,
         updated_at   = now()
   WHERE id = p_transaction_id
     AND version = p_expected_version
  RETURNING * INTO v_tx;

  IF NOT FOUND THEN
    PERFORM 1 FROM transactions WHERE id = p_transaction_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002';
    ELSE
      RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  INSERT INTO transaction_events
    (transaction_id, step, status, actor, reason, idempotency_key, payload, signed)
  VALUES
    (p_transaction_id, p_new_step, 'completed', p_actor, p_reason, p_idempotency_key, p_payload, p_financial)
  RETURNING id INTO v_event_id;

  RETURN QUERY SELECT v_tx.id, v_tx.current_step, v_tx.status, v_tx.version, v_event_id, FALSE;
END;
$$;
```

Use custom SQLSTATE codes (`P0002`/`P0003`, the user-reserved range) so the TS caller maps them to `DomainError` without string-matching messages.

### 4. `fn_update_agent`

```sql
-- db/functions/fn_update_agent.sql
CREATE OR REPLACE FUNCTION fn_update_agent(
  p_agent_id           UUID,
  p_agent_name         VARCHAR DEFAULT NULL,
  p_description        TEXT    DEFAULT NULL,
  p_agent_style        TEXT    DEFAULT NULL,
  p_on_status          BOOLEAN DEFAULT NULL,
  p_share_editor_with  JSONB   DEFAULT NULL
)
RETURNS SETOF agents
LANGUAGE sql
AS $$
  UPDATE agents SET
    agent_name        = COALESCE(p_agent_name, agent_name),
    description       = COALESCE(p_description, description),
    agent_style       = COALESCE(p_agent_style, agent_style),
    on_status         = COALESCE(p_on_status, on_status),
    share_editor_with = COALESCE(p_share_editor_with, share_editor_with)
  WHERE agent_id = p_agent_id
  RETURNING *;
$$;
```

Exclude the `tools` column if the `agent_tools` join table refactor has landed (check first); if not, leave `tools` untouched for now and add a `-- TODO` comment.

### 5. `fn_reserve_mcp_port` / `fn_release_mcp_runtime`

Only add these if `mcp_runtime_state` already exists (from the dynamic-port-allocation work) — check first, don't invent the table here.

```sql
-- db/functions/fn_reserve_mcp_port.sql
CREATE OR REPLACE FUNCTION fn_reserve_mcp_port(
  p_tool_id UUID, p_method VARCHAR, p_port INT
) RETURNS mcp_runtime_state LANGUAGE sql AS $$
  INSERT INTO mcp_runtime_state (tool_id, method, port, status, updated_at)
  VALUES (p_tool_id, p_method, p_port, 'starting', now())
  ON CONFLICT (tool_id) DO UPDATE
    SET method = EXCLUDED.method, port = EXCLUDED.port, status = 'starting',
        pid = NULL, last_error = NULL, updated_at = now()
  RETURNING *;
$$;
```

```sql
-- db/functions/fn_release_mcp_runtime.sql
CREATE OR REPLACE FUNCTION fn_release_mcp_runtime(
  p_tool_id UUID, p_status VARCHAR, p_last_error TEXT DEFAULT NULL
) RETURNS mcp_runtime_state LANGUAGE sql AS $$
  UPDATE mcp_runtime_state
     SET status = p_status, pid = NULL, last_error = p_last_error, updated_at = now()
   WHERE tool_id = p_tool_id
  RETURNING *;
$$;
```

### 6. TS wrapper — `src/db/rpc.ts`

```ts
import { query } from './pool.js';
import type pg from 'pg';

export async function callFn<T extends pg.QueryResultRow = pg.QueryResultRow>(
  fnName: string,
  args: ReadonlyArray<unknown>,
): Promise<pg.QueryResult<T>> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return query<T>(`SELECT * FROM ${fnName}(${placeholders})`, args);
}
```

`fnName` is always a hardcoded string literal at the call site — never built from user input.

### 7. Error mapping — `src/db/pgErrors.ts`

```ts
const PG_ERROR_MAP: Record<string, { code: string; message: string; status: number }> = {
  P0002: { code: 'NOT_FOUND',        message: 'Transaksi tidak ditemukan',                 status: 404 },
  P0003: { code: 'VERSION_CONFLICT', message: 'Update konkuren ditolak (optimistic lock)',   status: 409 },
};

export function mapPgFunctionError(err: any): DomainError | null {
  const mapped = PG_ERROR_MAP[err?.code];
  return mapped ? new DomainError(mapped.code, mapped.message, mapped.status) : null;
}
```

Update call sites (`completeStep`, `failStep`, `agents.ts` PUT, `mcpAutoManager.ts`) to use `callFn(...)` and this error mapper.

### Constraints

- Function names never built dynamically from user input.
- No business logic already living in TypeScript config gets duplicated in SQL.
- Every function redeployable via `CREATE OR REPLACE`.
- Args Zod-validated on the TS side before the call — a Postgres function replaces multi-round-trip calls, not input validation.
- Don't touch simple single-table reads.

### Verification plan

```bash
npm run migrate:up
psql $DATABASE_URL -c "\df fn_*"

# idempotency + version-conflict behavior
psql $DATABASE_URL -c "SELECT * FROM fn_complete_step('<uuid>', 0, 'doc_examined', 'in_progress', 'test', NULL, 'k1', '{}'::jsonb, false);"
psql $DATABASE_URL -c "SELECT * FROM fn_complete_step('<uuid>', 0, 'doc_examined', 'in_progress', 'test', NULL, 'k1', '{}'::jsonb, false);"  # expect idempotent_replay=true
psql $DATABASE_URL -c "SELECT * FROM fn_complete_step('<uuid>', 999, 'doc_examined', 'in_progress', 'test', NULL, 'k2', '{}'::jsonb, false);"  # expect P0003

npm run test
```

All must pass, plus `EXPLAIN ANALYZE` the function call once to confirm it's one round trip, not the old 4-round-trip pattern.
