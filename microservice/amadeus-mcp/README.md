# amadeus-mcp

**Amadeus Orchestrator MCP Server** — exposes 8 Model Context Protocol tools over **SSE** transport for controlling the `transaction_tracker` (Import LC / SKBDN / SBLC settlement pipeline).

Port: **10002** | Transport: **SSE** | Protocol: **amadeus.a2a/0**

---

## Quickstart

```bash
cd microservice/amadeus-mcp
cp .env.example .env
# Edit .env with your AMADEUS_ROBOT_KEY (see "Generate Robot Key" below)

npm install
npm run build
npm run start           # → SSE at http://localhost:10002/sse

# Or for hot-reload dev:
npm run dev
```

---

## Generate Robot Key

```bash
cd microservice/transaction_tracker
npm run robot:register -- --name amadeus-mcp-service --types import_lc,skbdn,sblc
# Copy the X-Robot-Key output → paste into amadeus-mcp/.env as AMADEUS_ROBOT_KEY
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `10002` | SSE listen port |
| `AMADEUS_API_BASE` | `http://127.0.0.1:8080` | transaction_tracker base URL |
| `AMADEUS_ROBOT_KEY` | _(required)_ | Robot key from `registerRobot.ts` |

---

## Available Tools (8)

| Tool | Description |
|---|---|
| `list_transactions` | List LC/SKBDN/SBLC with optional status/type filter |
| `get_transaction` | Full detail + event timeline for one transaction |
| `create_transaction` | Create a new settlement transaction |
| `dispatch_step` | **MAIN** — dispatch current step to executor (LLM/UiPath/PAD) |
| `complete_step` | Mark step complete (signatures required for financial steps) |
| `fail_step` | Record failure with reason (does not advance state) |
| `list_executors` | List registered executors with cost units |
| `explain_route` | Preview which executor will handle step X before dispatch |

---

## Register in Frontend UI (`/tools`)

1. Open `http://localhost:3000/tools`
2. Click **Register MCP** → modal opens
3. Click the **"Amadeus MCP"** preset button (auto-fills all fields)
4. Update `args` to the actual path: `node /absolute/path/to/microservice/amadeus-mcp/build/index.js`
5. Click **Register**

The `mcp_auto_manager.py` will discover this row and spawn the server automatically on agent boot.

---

## Test with MCP Inspector

```bash
# Ensure amadeus-mcp is running (npm run dev)
npx @modelcontextprotocol/inspector http://127.0.0.1:10002/sse
# → 8 tools appear in the inspector, all callable
```

---

## End-to-End Integration Flow

```
                     ┌─────────────────────┐
                     │  Boilerplate Agent   │
                     │  (agent_boilerplate) │
                     └────────┬────────────┘
                              │ SSE connects to 3 MCP servers
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
   ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐
   │  amadeus-mcp │  │  mcp-uipath    │  │  sendgrid-mcp   │
   │  :10002/sse  │  │  :10001/sse    │  │  :10003/sse     │
   └──────┬───────┘  └───────┬────────┘  └─────────────────┘
          │                  │
          │ HTTP             │ HTTP (UiPath Orchestrator API)
          ▼                  ▼
   ┌─────────────────┐  ┌──────────────────┐
   │ transaction_    │  │ UiPath Cloud /   │
   │ tracker :8080   │  │ On-Premise Orch. │
   │ (PostgreSQL)    │  └──────────────────┘
   └─────────────────┘

Agent reasoning loop example:
1. Agent calls amadeus.get_transaction(id) → sees step=mt_converted (financial)
2. Agent calls amadeus.explain_route(step=mt_converted, type=import_lc) → UiPath preferred
3. Agent calls amadeus.dispatch_step(transactionId, idempotencyKey)
   → dispatchBridge calls UiPath executor → outcome=dispatched, jobId=X
4. UiPath robot finishes → calls POST /a2a task.complete
   → transaction_tracker advances to swift_released
5. Agent calls amadeus.get_transaction again → confirms advancement
```

---

## Running Tests

```bash
npm run test        # vitest run — 24/24 tests
npm run typecheck   # tsc --noEmit — strict clean
```

---

## Architecture Notes

- **`app.py` NOT modified** — Opsi A: transaction_tracker runs standalone at `:8080`
- **`mcp_auto_manager.py` NOT modified** — row created via UI preset, `method: sse` already supported
- **No stdio** — SSE transport only, follows `mcp-uipath` pattern exactly
- **Financial steps** (`mt_converted`, `swift_released`, `settled`) require `signature` in `complete_step`
