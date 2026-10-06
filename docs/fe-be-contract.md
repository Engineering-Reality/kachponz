# Frontend ↔ Backend Endpoint Contract

Exhaustive inventory of every Next.js route handler under
`microservice/frontend/src/app/api/**/route.ts` (38 files) mapped to its
`amadeus-core` Fastify target.

## Forwarding mechanism

- `src/lib/backendClient.ts` — `backendFetch(path, init)` attaches the session
  JWT (`amadeus_session` cookie) as `Bearer` and prepends `AMADEUS_API_URL`.
  `passthrough(res)` streams status + content-type + body back (works for SSE).
- `src/lib/session.ts` — cookie-backed JWT; `verifySession()` is the real gate.
- `src/middleware.ts` — optimistic cookie-presence redirect only.
- **Backend registration (`server.ts`): NO prefixes.** Every plugin is
  registered at root, and orchestrator paths already contain `/orchestrator/...`
  literally. So the backend path the FE forwards to IS the registered path.
- Feature flags: `/auth/*` registered only if `OAUTH2_JWT_SECRET` is set;
  `/transactions/*` only if `ENABLE_TRANSACTION_ROUTES`; `/health` always on.

## Contract table

| FE Route | Method(s) | → Backend Path | BE Exists? | Method Match? | Shape Match? | Notes |
|---|---|---|---|---|---|---|
| `/api/agents` | GET, POST | `/agents` | Yes (agents.ts) | Yes | passthrough | — |
| `/api/agents/[id]` | PUT, DELETE | `/agents/:id` | Yes | Yes | passthrough | BE also exposes `GET /agents/:id`; FE has no GET proxy (not needed — list page keeps full objects). |
| `/api/agents/create-from-description` | POST | `/agents/create-from-description` | Yes | Yes | not verified | LLM route (strict body, rate-limited). |
| `/api/auth/login` | POST | `/auth/login` (direct `fetch`) | Yes (auth.ts)* | Yes | Match | Parses `{token,user}`, sets `amadeus_session` cookie. *Only if `OAUTH2_JWT_SECRET` set. |
| `/api/auth/logout` | POST | *(none — clears cookie)* | N/A | N/A | N/A | No backend call. |
| `/api/auth/register` | POST | `/auth/register` then `/auth/login` (direct `fetch`) | Yes* | Yes | Match | Register returns `{success,user}` (no token); FE then logs in. *Flag-gated. |
| `/api/tools` | GET, POST | `/tools` | Yes (tools.ts) | Yes | passthrough | See secret-masking note below. |
| `/api/tools/[id]` | PUT, DELETE | `/tools/:id` | Yes | Yes | passthrough | BE also exposes `GET /tools/:id` (masks env secrets); FE has no GET proxy (not needed — list page keeps full objects). |
| `/api/knowledge-bases` | GET, POST | `/knowledge-bases` | Yes (knowledgeBase.ts) | Yes | passthrough | — |
| `/api/knowledge-bases/[id]` | GET, DELETE | `/knowledge-bases/:id` | Yes | Yes | passthrough | GET returns KB + embedded `documents[]`. |
| `/api/knowledge-bases/[id]/documents` | POST | `/knowledge-bases/:id/documents` | Yes | Yes | passthrough | Multipart forwarded raw with original content-type. |
| `/api/knowledge-bases/[id]/documents/[docId]` | DELETE | `/knowledge-bases/:id/documents/:docId` | Yes | Yes | passthrough | — |
| `/api/transactions` | GET, POST | `/transactions` | Yes (transactions.ts)† | Yes | passthrough | †Only if `ENABLE_TRANSACTION_ROUTES`. GET forwards query string. |
| `/api/transactions/[id]` | GET | `/transactions/:id` | Yes† | Yes | passthrough | — |
| `/api/transactions/[id]/steps/[step]/complete` | POST | `/transactions/:id/steps/:step/complete` | Yes† | Yes | passthrough | BE also runs `verifyFinancialSignature` preHandler. |
| `/api/agent-invoke/shared-agent/[hash]` | GET | `/agent-invoke/shared-agent/:hash` | Yes (featureSharing.ts, public) | Yes | passthrough | Public — direct `fetch`, no JWT. |
| `/api/agent-invoke/shared-thread/[hash]` | GET | `/agent-invoke/shared-thread/:hash` | Yes (public) | Yes | passthrough | Public — direct `fetch`, no JWT. |
| `/api/feature-sharing/agent/share-anyone-with-link/[agentId]` | POST | `/feature-sharing/agent/share-anyone-with-link/:agentId` | Yes | Yes | passthrough | — |
| `/api/feature-sharing/agent/share-editor-with/[agentId]` | POST | `/feature-sharing/agent/share-editor-with/:agentId` | Yes | Yes | passthrough | Body `{emails:[]}`. |
| `/api/feature-sharing/agent/share-visitor-with/[agentId]` | POST | `/feature-sharing/agent/share-visitor-with/:agentId` | Yes | Yes | passthrough | Body `{emails:[]}`. |
| `/api/feature-sharing/thread/share-anyone-with-link/[agentId]/[threadId]` | POST | `/feature-sharing/thread/share-anyone-with-link/:agentId/:threadId` | Yes | Yes | passthrough | — |
| `/api/feature-sharing/thread/share-editor-with/[agentId]/[threadId]` | POST | `/feature-sharing/thread/share-editor-with/:agentId/:threadId` | Yes | Yes | passthrough | — |
| `/api/feature-sharing/thread/share-visitor-with/[agentId]/[threadId]` | POST | `/feature-sharing/thread/share-visitor-with/:agentId/:threadId` | Yes | Yes | passthrough | — |
| `/api/orchestrator/run-agentic` | POST | `/orchestrator/run-agentic` | Yes (orchestrator/routes.ts) | Yes | not verified | Strict body requires `idempotencyKey` (≥8); supports `stream` SSE. |
| `/api/orchestrator/agents/[id]/recipe` | GET, PUT, DELETE | `/orchestrator/agents/:agentId/recipe` | Yes | Yes | passthrough | Positional id → `:agentId`. |
| `/api/orchestrator/agents/[id]/recipe/run` | POST | `/orchestrator/agents/:agentId/recipe/run` | Yes | Yes | passthrough | SSE stream. |
| `/api/orchestrator/agents/[id]/loop/run` | POST | `/orchestrator/agents/:agentId/loop/run` | Yes | Yes | passthrough | SSE stream. |
| `/api/orchestrator/agents/[id]/uipath-context` | GET | `/orchestrator/agents/:id/uipath-context` | Yes | Yes | passthrough | — |
| `/api/orchestrator/autofill/suggest` | POST | `/orchestrator/autofill/suggest` | Yes | Yes | passthrough | Returns `{value}`. |
| `/api/orchestrator/chat/recommendations` | POST | `/orchestrator/chat/recommendations` | Yes | Yes | passthrough | Returns `{suggestions}`. |
| `/api/orchestrator/chat/title` | POST | `/orchestrator/chat/title` | Yes | Yes | passthrough | Returns `{title}`. |
| `/api/orchestrator/mcp/manager-status` | GET | `/orchestrator/mcp/manager-status` | Yes | Yes | passthrough | — |
| `/api/orchestrator/mcp/status` | GET | `/orchestrator/mcp/status` | Yes | Yes | passthrough | — |
| `/api/orchestrator/mcp/[toolId]/restart` | POST | `/orchestrator/mcp/:toolId/restart` | Yes | Yes | passthrough | — |
| `/api/orchestrator/tools/[id]/uipath-queue-transactions` | GET | `/orchestrator/tools/:toolId/uipath-queue-transactions` | Yes | Yes | passthrough | Forwards query string (`queueName`, `folderId`). |
| `/api/orchestrator/uipath/folders` | POST | `/orchestrator/uipath/folders` | Yes | Yes | passthrough | — |
| `/api/orchestrator/uipath-jobs` | GET | `/orchestrator/uipath-jobs` | Yes | Yes | passthrough | Forwards query string. |
| `/api/mcp-registry/search` | GET | *(external)* `registry.modelcontextprotocol.io` | N/A | N/A | N/A | Intentionally NOT a backend call — hits the public MCP registry directly. |

Legend: "passthrough" = FE handler forwards the raw body/response unchanged, so
response shape is determined by the page caller, not the route handler — no
shape assertion made at the route level.

## Mismatches & Actions

Overall the wiring is clean: **every forwarding FE route targets an existing
backend route with a matching HTTP method.** No method mismatches, no broken
paths. The items below are observations/caveats, not broken contracts.

1. **No GET proxy on `/api/agents/[id]` and `/api/tools/[id]`** (they export
   only PUT + DELETE), while the backend DOES expose `GET /agents/:id` and
   `GET /tools/:id`. Verified callers: `agents/page.tsx` and `tools/page.tsx`
   only ever `PUT`/`DELETE` these paths and GET the full objects from the
   collection endpoints (`/api/agents`, `/api/tools`). **Action: none (YAGNI)** —
   adding the GET proxies would be dead code today. Add only if a
   single-resource page/deep-link is introduced.

2. **Secret masking asymmetry (backend concern, not a wiring mismatch).**
   `GET /tools/:id` masks `env` secrets before returning; `GET /tools` (the
   list, the only one the FE actually calls) does `SELECT *` and returns
   `versions` **unmasked**. **Action (backend):** mask secrets in the list
   handler too, or have the FE tools page never render raw `env`. Out of scope
   for FE↔BE wiring but worth a ticket.

3. **Feature-flag / env dependencies.** `/api/auth/login`, `/api/auth/register`
   depend on `OAUTH2_JWT_SECRET` being set on the backend (else `/auth/*` is
   never registered → 404 → login/register silently break). `/api/transactions*`
   depend on `ENABLE_TRANSACTION_ROUTES`. **Action:** ensure both are set in any
   environment where the dashboard/login or transactions UI is used; document in
   deployment config. Not a code fix.

4. **`run-agentic` body contract (not verified here).** Backend `RunAgenticSchema`
   is `.strict()` and requires `idempotencyKey` (8–200 chars, `[A-Za-z0-9._:-]`).
   FE passes the body through verbatim, so the burden is on the page caller to
   supply a valid key; a malformed/missing key yields a 400 from the backend.
   **Action:** verify the chat/playground caller always sends a conforming
   `idempotencyKey` (left to the page-level audit).

## FE routes calling a NON-EXISTENT backend endpoint

**None.** Every backend-forwarding FE route resolves to a route that is
registered in `amadeus-core` today (subject to the feature flags in note 3).

For completeness, the two FE routes that do NOT call `amadeus-core` at all:
- `/api/auth/logout` — only clears the session cookie locally.
- `/api/mcp-registry/search` — proxies the external public MCP registry
  (`registry.modelcontextprotocol.io`), by design.
