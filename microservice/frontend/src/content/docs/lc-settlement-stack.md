# The LC Settlement Stack

Four services coordinate to settle one Import LC / SKBDN / SBLC transaction from
`submitted` to `advised`.

## transaction_tracker (port 8080)

Fastify + PostgreSQL service — the single source of truth. It owns:

- **The state machine** (`src/config/stepFlows.ts`): 9 steps —
  `submitted → distributed_to_analyst → doc_examined → ee_ntf_created →
  ee_ntf_approved → mt_converted → swift_released → settled → advised`.
  `submitted` and `ee_ntf_approved` are the only two manual/human steps — neither has
  an automatic executor, both must be advanced via `complete_step` directly.
- **The executor abstraction** (`src/orchestrator/executors/`) — see
  [Cost-Aware Executor Routing](/docs/cost-aware-routing).
- **Two auth layers** (`src/middleware/auth.ts`):
  1. `X-Robot-Key` — per-robot API key, argon2-hashed, checked on every request.
  2. HMAC-SHA512 request signature (`X-Signature` + `X-Robot-Timestamp` +
     `X-Robot-Signing-Secret`) — required only for financial steps
     (`mt_converted`, `swift_released`, `settled`). The HMAC key is
     `secret` alone, or `` `${secret}:${SIGNATURE_PEPPER}` `` if the tracker has
     `SIGNATURE_PEPPER` configured — **every client must match this exactly** or
     signatures silently never verify.
- **A2A protocol** (`src/orchestrator/a2a/`) — see [A2A Protocol & Signatures](/docs/a2a-protocol).
- **Robot provisioning** (`scripts/registerRobot.ts`) — the only way to mint a
  `X-Robot-Key` + signing secret pair; secrets are shown once and never stored
  plaintext.

Key REST surface: `POST /transactions`, `GET /transactions/:id`,
`POST /transactions/:id/steps/:step/complete`, `POST /orchestrator/dispatch`,
`GET /orchestrator/route`, `GET /orchestrator/executors`, `POST /a2a`, `POST /a2a/rpc`.

## amadeus-mcp (port 10002, SSE)

A thin MCP wrapper (`src/client/trackerClient.ts`) exposing 8 of transaction_tracker's
REST endpoints as MCP tools for an LLM agent to call: `list_transactions`,
`get_transaction`, `create_transaction`, `dispatch_step`, `complete_step`, `fail_step`,
`list_executors`, `explain_route`. It computes the HMAC signature client-side for
financial `complete_step` calls.

## mcp-uipath (port 10001, SSE)

A real UiPath Automation Cloud integration — 3 tools: `list_uipath_processes`,
`trigger_uipath_job`, `get_uipath_job_status`. Does OAuth2 client-credentials
authentication against `{UIPATH_BASE_URL}/identity_/connect/token`, then calls the
Orchestrator OData API (`Releases`, `Jobs/StartJobs`, `Jobs(id)`). Verified end-to-end
against a live UiPath Cloud tenant — see the "single client SSE" note in the source for
its one current limitation (one connected MCP client at a time; fine for demo/MVP).

## The E2E demo script

`microservice/transaction_tracker/scripts/e2e-demo.ts` drives all 9 steps end-to-end by
calling transaction_tracker's REST API directly (deliberately **not** via the MCP
protocol — simpler to run deterministically for a demo). It has two modes:

- `DEMO_MODE=simulate` (default) — no UiPath credentials needed; financial steps are
  completed directly with a computed HMAC signature.
- `DEMO_MODE=live` — calls UiPath Cloud's REST API directly (same pattern as
  `mcp-uipath`, but inline in the script) to actually start and poll a job for each
  financial step.

Run it: `cd microservice/transaction_tracker && npx tsx scripts/e2e-demo.ts`. Full setup
steps are in `microservice/transaction_tracker/docs/demo_setup_guide.md`, including a
troubleshooting section for the `SIGNATURE_PEPPER` and stale-process pitfalls
encountered while building this.

## Frontend surfaces for this stack

`/dashboard` (transaction ledger table), `/dashboard/amadeus` (KPI + state-machine
pipeline view), `/agent-invoke` (chat UI hitting `/orchestrator/run-agentic`),
`/agent-creator` (has an "LC Settlement Orchestrator" preset prompt). See
[Frontend Surfaces](/docs/frontend-surfaces) for the full page map.
