# Architecture Overview

This repository actually contains **two separate systems** that grew side by side and share
a codebase, but do not currently run as one integrated whole:

1. **The LC Settlement Orchestrator stack** — a Node/TypeScript state machine
   (`transaction_tracker`) plus two MCP servers (`amadeus-mcp`, `mcp-uipath`) and this
   Next.js console. This is the actively-developed system these docs focus on.
2. **The legacy "Combined Agent API"** — a Python/FastAPI monolith (`app.py` at the repo
   root) that mounts several sub-services (`agent_backend`, `agent_creator`,
   `agent_boilerplate`, `mcp_tools`, `rag`, …) backed by Supabase. It predates the LC
   settlement stack and is documented here for completeness, but **it currently fails to
   start** — see [Known Gaps & Caveats](/docs/known-gaps).

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LC SETTLEMENT ORCHESTRATOR STACK                │
│                                                                       │
│   Next.js Console (:3000)                                           │
│        │  REST (X-Robot-Key)                                       │
│        ▼                                                             │
│   transaction_tracker (:8080)  ── state machine + executor router   │
│        ▲              ▲                                             │
│        │ SSE/MCP      │ SSE/MCP                                     │
│   amadeus-mcp (:10002) │  mcp-uipath (:10001)                       │
│                        └─ real UiPath Automation Cloud OAuth2 calls  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  LEGACY "COMBINED AGENT API" (Python)                │
│                                                                       │
│   app.py (FastAPI, :8080 — port clash with transaction_tracker)      │
│     mounts: agent_backend · agent_creator · agent_boilerplate ·      │
│             mcp_tools · agent_field_autofill · rag                   │
│     spawns: mcp_2/mcp_auto_manager.py (background daemon)            │
│        │                                                              │
│        ▼                                                              │
│   Supabase (Postgres + Storage) — agents, tools, companies, roles,   │
│   agent_logs, user_companies, chat_sessions                          │
│        ▲                                                              │
│        │ SSE (per-tool, via mcp-proxy subprocesses)                  │
│   mcp_lib/agent_video · mcp_lib/sendgrid_mcp · mcp_lib/agent_creation │
└─────────────────────────────────────────────────────────────────────┘
```

## Why two systems?

Everything under `microservice/transaction_tracker`, `microservice/amadeus-mcp`,
`microservice/mcp-uipath`, and this `microservice/frontend` was purpose-built for one
concrete workflow: **Import LC / SKBDN / SBLC settlement**, with a real Postgres-backed
audit ledger, HMAC-signed financial steps, and a cost-aware router that picks the
cheapest of an LLM / PAD / UiPath executor for each step.

Everything else — `agent_backend`, `agent_creator`, `agent_boilerplate`, `mcp_tools`,
`mcp_2`, `rag`, `agent_field_autofill`, and the `mcp_lib/*` MCP servers — is a more
general-purpose "build and run an AI agent with tools" platform, backed by Supabase,
that predates the settlement stack (`backend/Amadeus/backend/microservice/` is literally
an older copy of part of it). The two were never merged into one runtime; they currently
just live in the same git repository.

## Where to go next

- **Building or demoing the settlement flow?** Read
  [The LC Settlement Stack](/docs/lc-settlement-stack),
  [Cost-Aware Executor Routing](/docs/cost-aware-routing), and
  [A2A Protocol & Signatures](/docs/a2a-protocol).
- **Working on the agent-builder platform?** Read
  [Agent Platform (Legacy)](/docs/agent-platform-legacy) and
  [MCP Servers Reference](/docs/mcp-servers-reference).
- **Working on either frontend?** Read [Frontend Surfaces](/docs/frontend-surfaces).
- **About to assume something works?** Read
  [Known Gaps & Caveats](/docs/known-gaps) first — several pieces described in READMEs
  are stubs with no backing code.
