# Prompt #17 — Amadeus: Python Legacy Cleanup (Audit First, Then Delete)

## Why this is staged, not a one-shot delete

Not all legacy Python is dead. Confirmed from the current codebase:

- `microservice/mcp_2/` and `microservice/mcp_tools/` — already fully removed. Nothing
  to do here.
- `microservice/agent_backend/` — **still Python, still live** (`routes/agents.py`,
  `companies.py`, `agent_logs.py`, `agent_tools.py`, `roles.py`). This is the CRUD
  backend for agents/companies/roles/tools — used by Agent Matrix, Agent Creator, and
  most of the frontend pages this whole project has been built around. Deleting this
  without a TypeScript replacement breaks the platform's core data layer, not a
  peripheral feature.
- Root `app.py`, `auth_middleware.py`, `requirements.txt`, and `backend/Amadeus/`
  (with its 41MB `.pt` model) — likely dead duplicate snapshots, per Prompt 00's
  original architecture triage, but never actually confirmed via diff.
- `agent_creator/` (autofill), `agent_field_autofill/`, `rag/`, `feature_sharing/` —
  design for TS replacements already written (Prompt 14, Prompt 15), but not
  confirmed executed. If these Python services are still what's actually serving
  requests, deleting them before their TS replacements are live and confirmed working
  breaks those features.

This prompt has four steps, in order. Do not skip ahead to deletion before the
audit in Step 1 is complete and reported.

## Step 1 — Audit: what's actually live vs. dead

For each Python service/folder, answer two questions with evidence, not assumption:

1. **Is it mounted?** Check root `app.py` (or wherever the Python ASGI app boots) for
   `include_router(...)` / `app.mount(...)` calls referencing each service. A folder
   that exists but is never mounted into the running app is dead regardless of
   whether the code inside it looks functional.
   ```bash
   grep -n "include_router\|mount\|import.*routes" app.py
   ```
2. **Does the frontend call it?** Grep the frontend for fetch calls to each service's
   route prefix (`/agent-backend`, `/rag`, `/feature-sharing`, `/agent-creator`
   autofill endpoints, etc.):
   ```bash
   grep -rn "'/agent-backend\|'/rag\|'/feature-sharing\|autofill" microservice/frontend/src --include="*.tsx" --include="*.ts"
   ```

Build a table: `service | mounted? | called by frontend? | verdict (dead / live-needs-port / live-has-ts-replacement)`.
Report this table before proceeding to Step 2.

## Step 2 — Confirm the two likely-dead duplicates via diff

Don't delete `backend/Amadeus/` or root `app.py` on assumption — confirm:

```bash
diff app.py backend/Amadeus/backend/app.py 2>&1 | head -50
diff auth_middleware.py backend/Amadeus/backend/auth_middleware.py 2>&1 | head -50
```

If they're identical or near-identical, and Step 1's audit shows root `app.py` is
either unmounted-from or superseded by `microservice/amadeus-core`'s server (check
`server.ts` for what's actually bound to the production port), both are safe to
delete as duplicate dead weight. If they've meaningfully diverged, stop and report
the diff — don't delete without understanding what diverged and why.

## Step 3 — Delete confirmed-dead code (this step only, nothing else yet)

Based on Step 1 + Step 2's findings, delete only what's confirmed dead:

- `backend/Amadeus/` (entire folder, including the 41MB `.pt` model) — if confirmed
  duplicate/unmounted.
- Root `app.py`, `auth_middleware.py`, `requirements.txt` — if confirmed unmounted
  and superseded by `amadeus-core`.
- Any of `agent_creator/`, `agent_field_autofill/`, `rag/`, `feature_sharing/` that
  Step 1 shows are NOT mounted and NOT called by the frontend at all (i.e., dead
  code nobody's hitting, regardless of whether a TS replacement exists yet) — these
  are safe to remove immediately, no port needed first, since nothing depends on them
  today.
- For anything Step 1 marks "live-needs-port" or "live, TS replacement not yet
  confirmed working" — do NOT delete in this step. That's Step 4.

Update `requirements.txt`-dependent tooling (Dockerfiles, CI configs, README setup
instructions) to remove references to the deleted Python setup, so onboarding
instructions don't point at code that no longer exists.

## Step 4 — What's left: port before delete

For every service Step 1 marked "live-needs-port":

- **`agent_backend`** — this is the biggest one and probably deserves its own
  follow-up prompt rather than being rushed here, given it's straightforward CRUD
  (agents/companies/roles/tools tables) but touches a lot of frontend surface area.
  Scope for that follow-up: port each route file (`agents.py`, `companies.py`,
  `agent_logs.py`, `agent_tools.py`, `roles.py`) to an equivalent TypeScript router
  under `amadeus-core` (or a dedicated service, matching whatever this repo's current
  convention is), preserving the exact same request/response shapes so the frontend
  doesn't need simultaneous changes. Cut over one route file at a time, confirm each
  works end-to-end (not just compiles) before moving to the next, and only delete
  `agent_backend/routes/X.py` once its TS replacement is confirmed handling real
  traffic.
- **`rag/`, `agent_field_autofill/`, `agent_creator/`'s autofill piece** — if Step 1
  shows these ARE still mounted/called, confirm whether Prompt 14 and Prompt 15 were
  actually executed and are live. If yes, cut over and delete the Python versions. If
  no, those prompts need to be executed first — don't delete the only working
  implementation before its replacement exists.
- **`feature_sharing/`** — per earlier investigation this has no real Python
  implementation to begin with (README spec only), so there's nothing here to port
  FROM — Step 1 should show it's not mounted/callable at all (there's no working code
  to call), meaning it likely belongs in Step 3's "delete now" bucket, not this one.
  Confirm this rather than assuming.

## Acceptance criteria

- [ ] Step 1's audit table is reported in full before any file is deleted.
- [ ] `diff` output for the two duplicate-suspect files is reported before
      `backend/Amadeus/` or root `app.py` is deleted.
- [ ] Nothing marked "live-needs-port" is deleted in this PR — only genuinely dead
      code and confirmed duplicates.
- [ ] `agent_backend`'s TS port is explicitly scoped as a separate follow-up prompt,
      not attempted inline here.
- [ ] After Step 3's deletions, the app still builds and starts, and a live
      agent-invoke session (Danantara CX100) still works end-to-end — this is the
      regression check that actually matters.
- [ ] Setup docs / Dockerfiles / CI configs no longer reference deleted Python paths.

## Non-goals

- Do NOT delete `agent_backend` in this PR — it needs a TS replacement first,
  scoped as its own prompt.
- Do NOT delete anything Step 1 couldn't classify with evidence — an inconclusive
  audit result means "investigate further," not "assume dead and remove."
- Do NOT attempt to port RAG/autofill inline here if Prompt 14/15 haven't been
  executed yet — flag that gap, don't rush a port under this cleanup prompt's scope.
