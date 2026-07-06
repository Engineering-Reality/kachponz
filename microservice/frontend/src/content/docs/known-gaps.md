# Known Gaps & Caveats

Things that look real from a README or file name but aren't (yet), found while mapping
this architecture. Check here before assuming something works.

## Root `app.py` currently cannot start

It imports `from microservice.agent_boilerplate...`, but `microservice/agent_boilerplate`
only exists under `backend/Amadeus/backend/microservice/`, not alongside `app.py` at the
repo root. `ModuleNotFoundError` on import. This looks like a leftover from merging two
previously separate projects rather than an intentional split.

## Port 8080 collision

`transaction_tracker` (Fastify) and the legacy `app.py` (FastAPI, `uvicorn.run(...,
port=8080)`) both default to port 8080. There is no compose file or config reconciling
this. Combined with the previous point, in practice only `transaction_tracker` can
realistically be the thing listening on 8080 today.

## `microservice/sendgrid_webhook` — stub, not wired up

Has real `models.py` and `database.py` (Supabase-backed email record tracking), but
**no route file exists** — `routes/` is an empty `__init__.py`. Not imported or mounted
in `app.py`. The webhook endpoints described in its README (`/sendgrid/webhook`, etc.)
do not exist in code.

## `microservice/feature_sharing` — documentation only, zero code

Only `README.md` and empty `__init__.py` files. No `database.py`, no `models.py`, no
route definitions. The sharing feature it describes *does* work, but it's implemented
inside `agent_boilerplate`'s `agent_invoke.py` (`/agent-invoke/shared-agent/{hash}`,
`/agent-invoke/shared-thread/{hash}`), not in this dedicated service.

## `agent_boilerplate/routes/available_llm.py` — empty file

0 bytes, 0 lines. Referenced by docs as an available-LLMs endpoint; nothing to serve it.
`agent_api.py`'s `GET /agent-api/get-llms` is separately documented as "not implemented."

## Two overlapping MCP process managers

`mcp_tools` (FastAPI-driven `MCPProxyManager`) and `mcp_2` (a standalone polling daemon,
`mcp_auto_manager.py`) both spawn/monitor the same class of `mcp-proxy` subprocess from
the same Supabase `tools` data, independently. Not consolidated.

## Frontend assumes two backends share one port

See [Frontend Surfaces](/docs/frontend-surfaces) — `/agents` and `/tools` pages expect
the legacy Combined Agent API at the same `NEXT_PUBLIC_API_URL` that `/dashboard` uses
for `transaction_tracker`. Given the port-8080 collision above, both can't be live
simultaneously without one of them moving to a different port.

## Two parallel copies of part of the codebase

`backend/Amadeus/backend/microservice/` contains an older copy of several services
(`agent_boilerplate`, plus slightly different versions of `mcp_2`, `mcp_tools`, `rag`,
`website_tester`) relative to the top-level `microservice/` directory. Check which copy
you're actually editing.

## Executor-level gaps (settlement stack)

- `dispatch_step` always passes an empty payload (`data: {}`) to executors — the Qwen VL
  `doc_examined` executor therefore always fails with "imageRef dokumen tidak tersedia"
  when dispatched this way. `e2e-demo.ts` works around this by falling back to a
  simulated `complete_step` when dispatch doesn't return `completed`.
- `PAD_DISPATCH_MODE` defaults to `queued_only` — no PAD executor call is real yet
  pending team confirmation of the actual trigger mechanism. No `mcp-pad` MCP server
  exists (would mirror `mcp-uipath`'s pattern once needed).
- `amadeus-mcp` and `mcp-uipath` support exactly one connected SSE client at a time
  (module-level `transport` variable, not a session map) — fine for demo/MVP, not for
  concurrent agents.

## `mcp_lib/agent_creation` calls a hardcoded remote URL

Defaults to `FASTAPI_BASE_URL = "https://boilerplate-agent.dev.chiswarm.ai"` — an
external deployed instance, not any local service in this repo, unless overridden.
