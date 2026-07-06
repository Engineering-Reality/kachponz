# MCP Servers Reference

Every MCP server in this repo, across both systems, in one place.

| Server | Transport | Port | Tools | Real or stub? |
|---|---|---|---|---|
| `microservice/amadeus-mcp` | SSE | 10002 | 8 tools wrapping transaction_tracker REST (`list_transactions`, `get_transaction`, `create_transaction`, `dispatch_step`, `complete_step`, `fail_step`, `list_executors`, `explain_route`) | **Real** — full REST passthrough + client-side HMAC signing |
| `microservice/mcp-uipath` | SSE | 10001 | `trigger_uipath_job`, `list_uipath_processes`, `get_uipath_job_status` | **Real** — OAuth2 + Orchestrator Jobs API, verified against a live UiPath tenant |
| `microservice/mcp_lib/agent_video` | stdio (behind `mcp-proxy --sse-port=10100`) | 10100 (via proxy) | `generate_images`, `generate_video` (Fal.ai) | Real, external API dependency (`FAL_KEY`) |
| `microservice/mcp_lib/sendgrid_mcp` | stdio | n/a (not proxied to SSE by default) | SendGrid send-email tools (`src/tools/index.ts`) | Real, unrelated in code to the broken `sendgrid_webhook` Python stub |
| `microservice/mcp_lib/agent_creation` | stdio | n/a | `create_new_agent`, `get_tools`, `get_tool`, agent↔tool association tools | Real, but calls a **hardcoded remote** `FASTAPI_BASE_URL` (`https://boilerplate-agent.dev.chiswarm.ai`) by default — not a local service |
| `microservice/mcp_tools` + `microservice/mcp_2` | n/a (process managers, not MCP servers themselves) | manages ports per Supabase config | — | Two independent, overlapping managers for the same class of `mcp-proxy` subprocess (see [Agent Platform](/docs/agent-platform-legacy)) |

## How an agent connects to any of these

Both the legacy `agent_boilerplate` runtime and this frontend's agent-invoke flow use
the same shape: a tool is registered somewhere (Supabase `tools` table for the legacy
platform; ad-hoc for the settlement stack) with a `port` and `transport: "sse"`, and the
client connects to `http://localhost:{port}/sse`. `agent_boilerplate.py` even has a
documented redirect hack forcing any tool literally named "Supabase" from port 10396 to
10399 to avoid a manager/config port mismatch — a sign this wiring is still evolving.

## Single-client SSE limitation

Both `amadeus-mcp` and `mcp-uipath` currently support exactly one connected SSE client
at a time (`let transport: SSEServerTransport` — a single module-level variable, not a
`Map<sessionId, transport>`). Both files have a `TODO` marking this as acceptable for
MVP/demo use but not for concurrent multi-agent access.
