# Amadeus — Diagnose Why UiPath Queue Tools Still Aren't Callable + Fix the Restart Gap

Working directory: `microservice/mcp-uipath/` and `microservice/transaction_tracker/`.

## Context

A previous task asked you to add `list_uipath_queues`, `add_uipath_queue_item`, and `bulk_add_uipath_queue_items` to `microservice/mcp-uipath/src/index.ts`, plus an anti-hallucination system-prompt suffix in `engine.ts`.

Latest test result: the agent now correctly says *"I don't have a tool that can send data to your queue yet"* instead of fabricating success — so the anti-hallucination fix is confirmed working. But the queue tools are still not callable. Do not re-implement blindly; **diagnose first**, because there are three distinct possible causes and the fix differs for each.

## Step 1 — Diagnose which of these is true

Run these checks, in order, and report the result of each before making any change:

```bash
# A. Are the queue tools actually in source?
grep -n 'server.tool(' microservice/mcp-uipath/src/index.ts
# Expect to see: trigger_uipath_job, list_uipath_processes, get_uipath_job_status,
#                list_uipath_queues, add_uipath_queue_item, bulk_add_uipath_queue_items
# If the last three are MISSING → the previous task was never applied. Go to Step 2.

# B. If they ARE in source, is the compiled build up to date?
ls -la microservice/mcp-uipath/src/index.ts microservice/mcp-uipath/build/index.js
# Compare mtimes. If build/index.js is OLDER than src/index.ts → stale build. Go to Step 3.

# C. If the build IS current, is the currently-running child process the stale one?
ps aux | grep "mcp-uipath/build/index.js"
# Note the PID and start time. Compare process start time against build/index.js mtime.
# If the process started BEFORE the build was last updated → it's running old code in memory.
# Go to Step 3.

# D. Confirm via the running server itself — call GET /orchestrator/mcp/status (or equivalent)
curl http://127.0.0.1:8080/orchestrator/mcp/status
# Check "uptimeSec" / "startedAt" for the UiPath tool entry against the build mtime from step B.
```

Report which of A/B/C/D triggered before proceeding.

## Step 2 — If the tools were never added to source

Implement exactly these three tools in `microservice/mcp-uipath/src/index.ts`, following the same pattern as the existing three (`getUiPathToken()` reuse, same header shape, never throw — always return `{ content: [{ type: "text", text: ... }] }`):

- `list_uipath_queues` — `GET /odata/QueueDefinitions`, lists `{Id, Name, Description}`.
- `add_uipath_queue_item` — `POST /odata/Queues/UiPathODataSvc.AddQueueItem` with `{ itemData: { Name, Priority, SpecificContent, Reference } }`.
- `bulk_add_uipath_queue_items` — `POST /odata/Queues/UiPathODataSvc.BulkAddQueueItems` with `{ queueName, commitType, queueItems: [{ Priority, SpecificContent }] }`. This is the one the PDF-extraction flow needs — it accepts an array of row objects in one call.

Also verify `UIPATH_SCOPES` includes `OR.Queues` (queue endpoints 403 with the job/process scopes alone) — check `.env` and the UiPath Admin → External Applications scope list for this org. If `OR.Queues` isn't granted there, no code change fixes it; it must be added in UiPath Admin first, then the cached OAuth token needs to naturally expire and refresh (or force it — see Step 4).

Then proceed to Step 3 regardless — adding the code is necessary but not sufficient.

## Step 3 — Force the running process to pick up the change (the actual gap)

This is the structural problem, independent of whether Step 2 was needed: **your process manager has no way to detect "the underlying tool code changed, restart me."** It only spawns a new child when a tool's DB row transitions to `Online` with no existing tracked process. Editing and rebuilding a tool's source does nothing to a process that's already running — Node has already loaded the old `build/index.js` into memory.

Fix this at two levels:

### 3a. Immediate manual fix (do this now to unblock testing)

```bash
cd microservice/mcp-uipath
npm run build

# Find and kill the currently running instance
ps aux | grep "mcp-uipath/build/index.js"
kill -9 <pid>

# Let the process manager notice it's gone and respawn on its next sync tick
# (check scripts/mcpAutoManager.ts or src/services/mcpProcessManager.ts for the poll interval — typically 10s)
sleep 12
curl http://127.0.0.1:8080/orchestrator/mcp/status
# Confirm a NEW pid and recent startedAt for the UiPath tool entry
```

### 3b. Structural fix — detect stale builds automatically, don't rely on someone remembering to kill -9

In whichever file currently owns the spawn/sync loop (`scripts/mcpAutoManager.ts`, or `src/services/mcpProcessManager.ts` if that refactor has landed — check which one exists before editing), add a build-freshness check to the sync tick:

1. For every tool with `method` pointing at a local file path (i.e. `args[0]` or the stdio/sse launch command references a `build/` output), stat the **entry file's mtime** at sync time.
2. Track, per running process, the entry-file mtime that was current **when that process was spawned** (store this alongside the existing `pid`/`port` bookkeeping — add an `entry_mtime` field to `mcp_runtime_state` if that table exists from prior work, otherwise an in-memory map keyed by `tool_id`).
3. On each sync tick, if the **current** entry-file mtime is newer than the mtime recorded at spawn time for the running process, treat it exactly like a crash: kill the process, clear its runtime row, let the next iteration of the same tick (or the next tick) respawn it fresh. Log clearly: `[MCP AutoManager] Restarting <tool name> — build changed since process start (spawned against mtime X, current mtime Y)`.
4. This must apply to **both** `stdio` and `sse` method tools — the mtime check doesn't care about transport.

This means: from now on, `npm run build` + wait one sync interval is enough. Nobody has to remember to manually find and kill a PID again.

### 3c. Add a manual restart escape hatch too, for cases mtime-checking can't catch (e.g. env var changes with no file change)

Add `POST /orchestrator/mcp/:toolId/restart` that:
- Looks up the tool's current running process (if any), kills it.
- Clears its `mcp_runtime_state` row (or marks it for immediate re-sync).
- Returns `202 Accepted` immediately; the actual respawn happens on the next sync tick, same as any other lifecycle transition.

Wire a small "Restart" button next to each `Online` tool row in `microservice/frontend/src/app/tools/page.tsx`, calling this endpoint, so future tool debugging doesn't require SSH+kill -9 at all.

## Step 4 — If the cause was scope-related (Step 2's `OR.Queues` note)

If UiPath Admin didn't have `OR.Queues` granted and you had to add it there:

```bash
# Force the cached OAuth token to refresh immediately rather than waiting for natural expiry —
# easiest: restart the mcp-uipath process again after the scope change (same steps as 3a).
# getUiPathToken()'s in-memory cache is per-process, so a fresh process = fresh token = new scopes.
```

## Verification plan — full end-to-end repeat of the failing scenario

```bash
# 1. Confirm the new tools are actually visible to the MCP client
npx @modelcontextprotocol/inspector http://localhost:<current-assigned-port>/sse
#   → call list_uipath_queues, confirm it returns real queue names (not an error)

# 2. Re-run the exact user scenario end-to-end through the real agent chat:
#    a. "list my queue"          → expect an "Invoking MCP Tool: list_uipath_queues" block, real queue names back
#    b. upload the same PDF, "extract please"  → same extraction as before
#    c. "can u send the data to my queue"       → expect an "Invoking MCP Tool: bulk_add_uipath_queue_items"
#       block with the actual 10-row array as Parameters, THEN a success message referencing a real item count

# 3. Confirm the restart-detection fix works on its own, independent of this specific tool:
#    - touch microservice/mcp-uipath/src/index.ts (no functional change, just bump mtime)
#    - npm run build
#    - wait one sync interval
#    - curl /orchestrator/mcp/status → confirm a new pid + startedAt for that tool, with NO manual kill -9
```

All three verification steps must pass. Step 3 in particular is the regression test for the structural fix — if you have to manually kill a process to see code changes take effect ever again, the mtime-based restart detection isn't working.
