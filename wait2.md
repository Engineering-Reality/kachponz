# Prompt #8 — mcp-uipath: Reconcile the Two Divergent Copies and Deploy the Fix Safely

## Context — read this before touching anything

Two copies of the mcp-uipath MCP server currently exist and have diverged:

- **`~/Downloads/amadeus-uipath-mcp`** — has `src/` + `build/`. Has a correct,
  genuinely-polling `wait_for_uipath_job` and has `get_uipath_asset`. Missing
  `list_uipath_folders`.
- **`ponzgen/microservice/mcp-uipath`** — has `build/` only, no `src/`. Missing
  `wait_for_uipath_job` and `get_uipath_asset` entirely. Has `list_uipath_folders`.

Confirmed via a direct query against the `tools` table (using
`microservice/transaction_tracker/.env`'s `DATABASE_URL`): the **production-registered
copy is `ponzgen/microservice/mcp-uipath/build/index.js`** — spawned via `--stdio` for
the "UiPath CX100" tool (used by the Danantara CX100 agent), and ALSO spawned over SSE
for two other registered tools: **"UiPath Maestro"** and **"UiPath Queue"**. All three
production tool registrations point at this exact same compiled file. This means any
change to it has a blast radius of three tools, not one — Maestro and Queue are
outside everything discussed so far in this project and must not regress.

The deployed copy has no TypeScript source — only compiled `build/index.js`, its own
`node_modules/`, and a `.env` with live UiPath client credentials (do not print,
log, or echo the contents of that `.env` anywhere, including in commit messages, PR
descriptions, or tool output — treat it exactly like the previous session did:
acknowledge it exists, never repeat its contents).

**Decision made: `amadeus-uipath-mcp` becomes the canonical source going forward.**
Hand-editing the compiled, source-less `ponzgen/microservice/mcp-uipath/build/index.js`
directly was considered and rejected — it would leave the two copies permanently
diverged and unmaintainable, repeating the exact pattern this whole project has been
trying to eliminate elsewhere (Python/TypeScript duplication, `backend/Amadeus`
duplication). Do the real fix once, at the source, not a second patch on a black box.

## Step 1 — Port the missing tool into the canonical copy

In `~/Downloads/amadeus-uipath-mcp/src/`, find where the other list tools
(`list_uipath_processes`, `list_uipath_jobs`) are defined and add `list_uipath_folders`
following the exact same shape/conventions. Pull its actual behavior from
`ponzgen/microservice/mcp-uipath/build/index.js` — since that's compiled JS with no
source, read it directly (it'll be minified/compiled but the tool registration block,
its `inputSchema`, and its OData call target should still be identifiable — search for
the string `"list_uipath_folders"` in the compiled file to locate it). Match its input
schema and output shape exactly — anything currently calling this tool (check if
Maestro or Queue use it) must keep working identically after the port.

```bash
grep -n "list_uipath_folders" ponzgen/microservice/mcp-uipath/build/index.js
```

Build `amadeus-uipath-mcp` after adding it:

```bash
cd ~/Downloads/amadeus-uipath-mcp
npm run build   # or whatever this repo's actual build script is — check package.json
```

## Step 2 — Diff the full tool surface before going any further

Do NOT proceed to testing or swapping until you've confirmed the new build's tool list
is a strict superset of the old one, with matching schemas for anything both have in
common.

```bash
# List tools from the OLD deployed build (spawn it standalone, list tools, don't touch DB/live jobs):
cd ponzgen/microservice/mcp-uipath
node build/index.js --stdio &
OLD_PID=$!
# use a small MCP client script (or the existing test_mcp_client.mjs referenced
# earlier in this project, if it still exists under transaction_tracker) to connect
# and call listTools(), dump the result to /tmp/old-tools.json
kill $OLD_PID

# List tools from the NEW canonical build the same way:
cd ~/Downloads/amadeus-uipath-mcp
node build/index.js --stdio &
NEW_PID=$!
# same listTools() dump to /tmp/new-tools.json
kill $NEW_PID

diff <(jq -S . /tmp/old-tools.json) <(jq -S . /tmp/new-tools.json)
```

Expected diff: new build has `wait_for_uipath_job` and `get_uipath_asset` added,
`list_uipath_folders` now present in both with matching schema, everything else
(`list_uipath_processes`, `trigger_uipath_job`, `get_uipath_job_status`,
`list_uipath_jobs`) identical in name and `inputSchema` between old and new. If
anything else differs unexpectedly — a renamed tool, a changed parameter, a different
description — stop and figure out why before continuing; that's an unplanned
regression, not something to paper over.

## Step 3 — Test the new build in isolation, against real UiPath, before touching production

Do not skip this even though the DB isn't being changed yet.

```bash
cd ~/Downloads/amadeus-uipath-mcp
cp path/to/live/.env .env   # reuse the SAME credentials the deployed copy already
                              # uses — do not create new UiPath API credentials for
                              # this test, and do not print this file's contents
node build/index.js --stdio
```

With this instance running standalone (not registered in the `tools` table, not
touched by `mcpAutoManager` or the TS spawner — just a bare process for manual
testing), run through Prompt 07's Step 4 verification exactly:

1. Trigger a real UiPath job known to take 20-30+ seconds.
2. Call `wait_for_uipath_job` on it, confirm the call itself takes roughly as long as
   the job's actual runtime, not an instant return.
3. Confirm the returned state matches UiPath Orchestrator's UI for that job.
4. Test the timeout path with a short `timeoutSeconds` against a longer-running job,
   confirm `timedOut: true` comes back distinctly from a terminal-state result.
5. Call `get_uipath_asset` against a known asset (e.g. `TemptomailFlow_TempMail` or
   `TemptomailFlow_OTP`, whichever currently has a value) and confirm the returned
   value matches what's actually in UiPath Orchestrator's Assets page.
6. Call `list_uipath_folders` and confirm it returns real folder data matching what
   Maestro/Queue currently see — this is the newly-ported tool, verify it didn't break
   in translation.

Only proceed to Step 4 once all six checks pass.

## Step 4 — Back up the live deployed file before touching it

```bash
cd ponzgen/microservice/mcp-uipath
cp -r build build.bak-$(date +%Y%m%d-%H%M%S)
```

Keep this backup until Step 6's post-swap verification fully passes. Don't delete it
same-day even if the swap looks fine — give it at least one full day of Jandy actually
using the CX100/Maestro/Queue tools before considering the backup safe to remove.

## Step 5 — Swap, carrying over dependencies and credentials correctly

```bash
cd ponzgen/microservice/mcp-uipath

# Stop anything currently spawning this file — clean teardown, same discipline as
# every dev-server test in this project:
pkill -9 -f "mcp-uipath/build/index.js" 2>/dev/null
sleep 2

# Replace the build output:
rm -rf build
cp -r ~/Downloads/amadeus-uipath-mcp/build ./build

# Carry over node_modules — the new build may depend on packages the old
# node_modules doesn't have (or different versions). Reuse the canonical repo's
# node_modules rather than assuming the old one is compatible:
rm -rf node_modules
cp -r ~/Downloads/amadeus-uipath-mcp/node_modules ./node_modules
# If amadeus-uipath-mcp's node_modules wasn't installed (only committed
# package.json/lock), run `npm install --production` here instead of copying.

# The .env with live credentials stays exactly where it is — do NOT overwrite it
# with anything from amadeus-uipath-mcp's own .env (if it has one, it's probably
# for a different/test UiPath tenant). Confirm the existing .env is untouched:
ls -la .env
```

## Step 6 — Restart and verify all three dependent tools, not just CX100

The transaction_tracker backend's `mcpAutoManager` (or its TS successor, if Prompt 03
was completed) needs to pick up the swap. Depending on which is currently running:

```bash
# If still Python-managed:
curl -X POST "http://localhost:8081/orchestrator/mcp/<toolId>/restart" -H "X-Robot-Key: $ROBOT_KEY"
# Do this for all three toolIds: UiPath CX100, UiPath Maestro, UiPath Queue — find
# their toolIds via GET /orchestrator/mcp/status first.
```

For each of the three, confirm via `GET /orchestrator/mcp/status` that it comes back
`running` (or, for the stdio-mode CX100 tool, that a live agent invoke against it
succeeds — stdio tools may not show a persistent "running" state per Prompt 03's Part
E, spawn-on-demand is expected).

Then, functionally:

1. **UiPath CX100 / Danantara CX100 agent**: run one full loop iteration via
   `/agent-invoke` in playground mode (per the earlier discussion — full disposable
   email → login → OTP → survey chain, one iteration). Confirm `wait_for_uipath_job`
   now genuinely blocks and the agent never says "saya tidak punya tool untuk
   menunggu."
2. **UiPath Maestro**: whatever this tool's typical invocation is — run it once,
   confirm its normal behavior is unchanged from before the swap.
3. **UiPath Queue**: same — run its typical invocation, confirm unchanged behavior.

Do not consider this done until all three have been exercised, not just the one this
whole effort was originally about.

## Step 7 — Clean up

```bash
rm -rf ~/Downloads/ponzgen/microservice/mcp-uipath/build.bak-*   # only after Step 6
                                                                    # has passed AND at
                                                                    # least a day of
                                                                    # real usage
```

Note for Jandy, not something to act on automatically: `~/Downloads/amadeus-uipath-mcp`
is now the actual source of truth. Going forward, changes to any UiPath MCP tool
happen there, get built, and get redeployed the same way this prompt just did — not by
editing anything under `ponzgen/microservice/mcp-uipath/build/` directly again. Worth
moving `amadeus-uipath-mcp` into the main `ponzgen` repo (e.g.
`ponzgen/microservice/mcp-uipath` becoming the actual source-controlled package
instead of a build-only folder) as a follow-up, so there's one repo instead of two —
flag this to Jandy, don't do it unprompted in this PR since it touches repo/folder
structure beyond this fix's scope.

## Acceptance criteria

- [ ] `list_uipath_folders` added to `amadeus-uipath-mcp/src`, builds cleanly, output
      verified to match the old tool's schema and behavior.
- [ ] Full tool-list diff between old and new builds shows exactly the expected
      changes (two tools added, one tool now present in both, everything else
      unchanged) — no surprise regressions.
- [ ] All six isolated tests in Step 3 pass against real UiPath before any production
      file is touched.
- [ ] A timestamped backup of the old `build/` exists before the swap.
- [ ] `node_modules` and `.env` carried over correctly — new build actually runs in
      the deployed location, not just in the source repo.
- [ ] All three dependent tools (CX100, Maestro, Queue) independently verified working
      after the swap — not just the one this fix targeted.
- [ ] `wait_for_uipath_job` in a live Danantara CX100 invoke now genuinely blocks for
      the job's real duration, and the agent no longer says "saya tidak punya tool
      untuk menunggu."
- [ ] No live credential values printed, logged, or included in any commit/PR
      description anywhere in this process.

## Separate, non-blocking note: the stuck-Pending job

A recent transcript showed job `110716440` stuck in `Pending` across multiple
`get_uipath_job_status` checks, with the agent correctly refusing to trigger a new job
per the concurrency rule (v2 system prompt behavior confirmed working). This may be
unrelated to the MCP tooling fix entirely — a job stuck in Pending without progressing
can mean the UiPath robot pool is unavailable, over capacity, or licensing-limited on
the Orchestrator side. After this PR ships, if jobs still get stuck in Pending for
extended periods, that's an infrastructure/capacity issue to check directly in UiPath
Orchestrator's dashboard — not something further MCP server code changes can fix.
Mention this to Jandy as a heads-up, don't try to build a workaround for it in this PR.

## Non-goals

- Do NOT touch Maestro's or Queue's own registration config, releaseKeys, or folder
  IDs — this PR only changes which `build/index.js` they spawn, nothing about how
  they're registered.
- Do NOT delete `ponzgen/microservice/mcp-uipath`'s `.env` or regenerate credentials.
- Do NOT merge the two repos into one folder structure in this PR — flag it as a
  follow-up, per Step 7's note.
- Do NOT skip Step 3's isolated testing to save time — this is a live production path
  serving three tools with real credentials; the isolated test is what makes the swap
  safe to do at all.
