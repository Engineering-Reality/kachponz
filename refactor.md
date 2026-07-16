# Prompt #18 — Amadeus: Deployment-Readiness Refactor + Testing (2GB RAM Target)

## Read this before touching anything

This is a resource-constraint refactor, not a rewrite. The codebase (~46k lines) is
not inherently too big for 2GB RAM — line count isn't what consumes memory, runtime
process count and per-process baseline overhead is. Every prior session in this
project has already found and fixed several concrete memory risks (heavy Python
VLM/CLIP dependencies, a duplicate Python snapshot with a 41MB model file, orphaned
`next dev` processes piling up during debugging, a still-Python `agent_backend`
service). This prompt is about finding what's LEFT, measuring it honestly, and fixing
what actually matters — not guessing.

**Be honest about the floor.** A 2GB VPS running Next.js + a Node orchestrator + one
or more MCP server processes + PostgreSQL, all on the same box, has a real physical
limit regardless of how well the code is refactored. Report actual numbers from Step
1 before promising this fits — if it doesn't, the honest options are: move Postgres to
a separate managed instance, split services across two small boxes, or ask for more
RAM. Don't let refactoring effort substitute for stating that plainly if the numbers
say so.

## Step 1 — Measure before changing anything

Don't optimize blind. Get real numbers first, ideally on a VM/container capped at 2GB
to see actual behavior under the real constraint, not just on a dev machine with
headroom to hide problems.

```bash
# Start every service that would run in production (production build, not dev mode
# — see Step 2 first if unsure which mode is currently used).
# Then, for each running process:
ps -eo pid,rss,vsz,comm --sort=-rss | head -20

# Per-process detail:
cat /proc/<pid>/status | grep -i vmrss
```

Record baseline (idle, no traffic) RSS for: Next.js server process, `amadeus-core`
orchestrator process, each MCP server process (note: stdio-mode tools may spawn
per-connection rather than staying resident — measure both idle and "one active
agent-invoke session" states), and PostgreSQL (if self-hosted on the same box —
confirm this explicitly, it changes the whole plan).

Then measure under light load: 3-5 concurrent `/agent-invoke` sessions, one Recipe
Executor run. Report peak RSS per process, not just idle.

**Report this table before proceeding.** Everything after this step should be
justified by what the numbers actually show, not assumed.

## Step 2 — Confirm production build mode is actually used

This project has direct history of dev-server confusion (`npm run dev` hangs,
orphaned Turbopack processes accumulating during one debugging session). Confirm the
deployment plan uses:

```bash
cd microservice/frontend
npm run build   # NOT `npm run dev` — dev mode keeps Turbopack's watcher, HMR
                # server, and source maps all resident in memory; production build
                # is materially lighter and is the only mode that should ever run on
                # the target VPS
npm run start
```

Enable Next.js standalone output to trim the deployed `node_modules` footprint:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: { root: path.join(__dirname) }, // already set per earlier work
};
```

If the current deployment plan runs `next dev` in production (check whatever
process manager config / systemd unit / Dockerfile CMD exists), fix this first —
it's likely the single biggest, cheapest win available before touching any
application code.

## Step 3 — Consolidate runtimes: finish the Python → TypeScript migration

Per the prior Python legacy cleanup work (Prompt 17): if `agent_backend` is still
Python, running it means a second language runtime (a Python/Uvicorn process) with
its own baseline memory cost, alongside every Node process. Confirm Prompt 17's
findings and, if `agent_backend`'s TS port hasn't landed yet, treat completing it as
a prerequisite for this deployment — one runtime (Node) instead of two is a direct,
measurable memory reduction, not just a code-cleanliness one.

## Step 4 — MCP process lifecycle audit

Per Prompt 03's design, stdio-mode MCP tools should spawn per-connection and
terminate on disconnect — they should NOT be long-lived daemons. Confirm this is
actually true in the current deployed behavior, not just the original design intent:

```bash
# While idle (no active agent-invoke session), confirm no stdio MCP child processes
# are lingering:
ps aux | grep -i "mcp-uipath\|mcp-" | grep -v grep
```

If any stdio-mode MCP server process is resident even when no agent session is
active, that's a lifecycle bug worth fixing here — each lingering process is pure
waste on a 2GB box. SSE-mode tools are expected to be resident (that's the tradeoff
for that transport mode per Prompt 03) — don't "fix" those into stdio without
re-evaluating whether they need shared/persistent state that stdio can't provide.

## Step 5 — Process memory limits and restart policy

Once Steps 1-4 establish an honest baseline, put hard limits in place so a leak or
spike in one process can't take down the whole box:

```bash
# Node processes — cap V8 heap explicitly rather than letting it grow unbounded:
node --max-old-space-size=256 dist/server.js   # tune the number to what Step 1's
                                                  # measurements actually show is
                                                  # needed, not a guess
```

If using PM2 or systemd, set a hard memory ceiling with an automatic restart on
breach (`pm2` `max_memory_restart`, or systemd `MemoryMax=` + `Restart=on-failure`)
so a single runaway process degrades gracefully (one restart) instead of triggering
an OOM-killer event that can take down unrelated processes on the same box.

## Step 6 — Database connection pool sizing

Confirm the Postgres client pool (wherever `amadeus-core`/`agent_backend` configure
it) uses a conservative `max` connection count appropriate for a resource-constrained
box — each open connection costs memory on both the client and (if self-hosted)
server side:

```ts
// e.g. for node-postgres:
const pool = new Pool({ max: 5, idleTimeoutMillis: 30000 });
```

If PostgreSQL itself is self-hosted on this same 2GB box (confirm from Step 1),
also review its own `shared_buffers`/`max_connections` config — default Postgres
settings are tuned for dedicated database servers with much more RAM, not a shared
2GB box also running the application. This is a real, separate tuning pass; don't
skip it if Postgres is confirmed local.

## Step 7 — Testing plan (write this before refactoring further, not after)

A refactor without tests is how regressions slip in silently. Before making further
changes beyond Steps 2-6 (which are safe, mechanical wins), establish:

1. **Regression baseline for Recipe Executor / Loop Mode** — an automated test that
   runs the Danantara CX100 loop (or a mocked version of it, if hitting real UiPath
   in CI isn't feasible) and asserts job-ID tracking, releaseKey resolution, and
   concurrency invariants still hold after any refactor touching `engine.ts` or the
   recipe machinery.
2. **MCP tool loading test** — confirm `loadMcpTools()` still connects correctly to
   both single-tool and multi-tool (namespaced, per Prompt 13) agent configurations
   after any changes.
3. **Endpoint smoke tests** — reuse/extend the `test-model-endpoints.ts` script from
   Prompt 11 and the MCP tool-list check from Prompt 11 Part D as an automated
   pre-deploy gate, not just a manual pre-flight check.
4. **Memory/load test under the real constraint** — run the Step 1 measurement
   process again after all refactor changes, on the same capped-at-2GB environment,
   and compare before/after numbers directly. "It compiles" is not evidence this
   works within budget — only a repeated measurement is.
5. **A deployment checklist** combining all of the above into a single ordered
   runbook: build in production mode → start each service → run endpoint smoke tests
   → run one real Danantara loop iteration → check peak RSS across all processes →
   only then consider the deployment verified.

## Acceptance criteria

- [ ] Step 1's baseline + under-load memory table is reported in full, on an
      environment actually capped at 2GB, before any other step's changes are made.
- [ ] Confirmed (not assumed) that production build mode (`next build && next start`)
      is what actually runs in the deployment plan.
- [ ] `output: 'standalone'` is set and its effect on deployed size is measured.
- [ ] `agent_backend`'s Python-vs-TS status is explicitly resolved before declaring
      this deployment ready — if still Python, that's flagged as the next
      prerequisite, not silently left as-is.
- [ ] No stdio-mode MCP process is resident while idle — confirmed via `ps`, not
      assumed from the original design.
- [ ] Memory limits + restart policy are in place for every long-running process.
- [ ] DB connection pool `max` is set deliberately, not left at a default meant for
      a dedicated database server.
- [ ] A repeatable test suite exists covering Recipe Executor regression, MCP tool
      loading, and endpoint health — runnable as a single command, not manual steps.
- [ ] A final memory measurement, taken the same way as Step 1's baseline, is
      reported after all changes — and if it still doesn't fit 2GB, that's stated
      plainly along with the realistic alternatives (separate DB host, more RAM,
      split across two boxes), not glossed over.

## Non-goals

- Do NOT rewrite application logic (Recipe Executor, MCP tool handling, auth) as
  part of this pass unless Step 1's measurements point at a specific memory
  offender inside that logic — this is a deployment/process/config refactor first,
  application-code refactor only if the numbers demand it.
- Do NOT assume the 2GB target is achievable before Step 1's numbers say so — if
  Postgres is self-hosted on the same box alongside everything else, say clearly
  whether the numbers actually add up, rather than optimizing indefinitely toward a
  target that may need a different fix (like moving Postgres off-box).
- Do NOT skip the testing plan (Step 7) to move faster — a refactor that breaks the
  Danantara loop silently is worse than a slower, verified one.