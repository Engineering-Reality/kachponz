# Agent Platform (Legacy)

A separate, Supabase-backed "build and run an AI agent with tools" platform that
predates the LC settlement stack. It runs as one combined FastAPI process (`app.py` at
the repo root, intended for port 8080 — see the port clash noted in
[Known Gaps & Caveats](/docs/known-gaps)).

## Combined Agent API (`app.py`)

Mounts all of the services below as FastAPI routers into one process, and spawns
`microservice/mcp_2/mcp_auto_manager.py` as a background subprocess on startup. Backed
entirely by one Supabase project (Postgres + Storage).

## agent_backend

CRUD layer for the platform's core entities: `agents`, `companies`, `roles`
(Super Admin / Admin / Staff / User), `agent_logs`, and agent↔tool associations.
Key routes: `/agents`, `/companies`, `/roles`, `/agent-logs`,
`/agents/{agent_id}/tools/{tool_id}`.

## agent_creator

Powers the natural-language "describe your agent" UX (the `/agent-creator` frontend
page's intended backend). Parses free text into structured fields
(`/user_input/parse-field`, `/user_input/parse-multi-agent`), autofills individual
fields via LLM (`/agent_creator_autofill/invoke[-stream]`), and recommends tools from an
external registry — `utils/mcphub_compass.py` calls `registry.mcphub.io/recommend`.

## agent_boilerplate (`backend/Amadeus/backend/microservice/agent_boilerplate`)

The actual agent **runtime**. `boilerplate/agent_boilerplate.py` (lines ~140-195) reads
an agent's configured tools from Supabase, builds an MCP config
(`{tool_name: {url: "http://localhost:{port}/sse", transport: "sse"}}`), checks each
URL is reachable, then connects via `MultiServerMCPClient` before invoking a LangGraph
agent. Two agent templates exist:
- `agent_templates/react_agent.py` — thin wrapper around LangGraph's
  `create_react_agent`, for models with native tool-calling.
- `agent_templates/react_text_agent.py` — a hand-rolled ReAct loop
  (`ReActTextAgent`) that regex-parses `Action:` / `Action Input:` / `Final Answer:`
  text output, for text-only models (e.g. Gemma) without structured tool-calling.

Key routes: `POST /agent-invoke/{agent_id}/invoke[-stream]`,
`GET /agent-invoke/{agent_id}/info`,
`GET /agent-invoke/shared-agent/{agent_hash}` and `shared-thread/{thread_hash}` — the
*only* working implementation of the "feature sharing" concept (see
[Known Gaps](/docs/known-gaps) — the dedicated `feature_sharing` service is unimplemented).

## mcp_tools & mcp_2 — two overlapping process managers

- **`mcp_tools`** — FastAPI routes (`/tools`, `/mcp-tools/refresh`, `/mcp-tools/status`)
  backed by `_mcp_manager.py`'s `MCPProxyManager`, which spawns/monitors/kills
  `mcp-proxy --sse-port=<port> -- <command>` subprocesses per Supabase tool row.
- **`mcp_2`** — a separate standalone daemon (`mcp_auto_manager.py`, no HTTP routes of
  its own) that polls Supabase on an interval (`MCP_CHECK_INTERVAL_MINUTES`, default 10),
  hashes tool configs to detect drift, and restarts `mcp-proxy` processes automatically.
  Persists state in `runner_files/manager_state.json`.

Both exist and both manage the same class of subprocess; they were not consolidated into
one manager.

## agent_field_autofill

A simplified, standalone subset of `agent_creator`'s autofill capability — generates one
field's value from the others, no memory/tools/multi-agent complexity. Uses OpenRouter
directly (`OPEN_ROUTER_API_KEY`), no Supabase calls of its own.

## rag

Two pipelines mounted at `/rag` and `/image-rag`: generic file upload → retrieve →
rerank → generate, and an image-embedding search/hybrid-search/query pipeline. Backed by
Supabase Storage (bucket `users-files`) and Postgres for vectors/metadata.

## website_tester

A static, no-build-step HTML/CSS/JS manual QA console (own Python `http.server`,
port 8008 with 8009-8012 fallback) for exercising the Combined Agent API by hand —
agents, tools, agent-invoke streaming, companies, roles, logs. Not a framework app, not
part of the Next.js frontend.
