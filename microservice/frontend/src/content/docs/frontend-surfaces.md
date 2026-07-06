# Frontend Surfaces

There are actually **two unrelated frontends** in this repository.

## This console (`microservice/frontend`, Next.js 16 App Router)

The one you're reading these docs in. Pages:

| Route | Purpose | Talks to |
|---|---|---|
| `/` | Marketing/landing page for the settlement stack | — |
| `/dashboard` | Transaction ledger table (split view: list + event log / A2A tab / flow graph) | `transaction_tracker` REST (`/transactions`) |
| `/dashboard/amadeus` | KPI cards + clickable state-machine pipeline + ledger table | `transaction_tracker` REST, polls every 5s |
| `/agent-invoke` | Chat-style UI to run an agentic step on a transaction; also lists agents in a dropdown and supports `?agent=` pre-selection by name | `transaction_tracker` `/orchestrator/run-agentic` **and** the legacy `/agents` endpoint |
| `/agent-creator` | Chat-style "describe your agent" UX with example presets (including "LC Settlement Orchestrator") | intended for `agent_creator` (legacy) — currently a static UI shell, compile button disabled |
| `/agents` | Agent registry CRUD table | legacy `agent_backend` `/agents` endpoint |
| `/tools` | MCP tool registry CRUD table | legacy `mcp_tools` `/tools` endpoint |
| `/docs`, `/docs/[slug]` | This documentation viewer (markdown files in `src/content/docs/`) | — |

**Important wiring detail:** every page reads its API base from
`NEXT_PUBLIC_API_URL`, defaulting to `http://127.0.0.1:8080` — for **every** page,
including `/agents` and `/tools`, which are legacy Combined Agent API (Supabase-backed)
endpoints, not `transaction_tracker` endpoints. Since both services default to port
8080, this console currently assumes **both backends are reachable at the same base
URL**, which isn't possible as long as both try to bind port 8080 directly (see
[Known Gaps & Caveats](/docs/known-gaps)). In practice, only whichever page's actual
backend is running behind `NEXT_PUBLIC_API_URL` will work at a time.

## The other frontend (`/frontend` at repo root, Vite + React 19)

A completely separate project (`package-lock.json` name: `amedus-ai`) — a
marketing/product SPA with `BookDemo.jsx`, `ProductDetail.jsx`, `Login.jsx`, product
data, testimonials, and a Three.js hero animation. It shares no code, no API client, and
no routes with `microservice/frontend`. It is not part of the LC settlement stack or the
agent platform's runtime — treat it as a separate, standalone marketing site.
