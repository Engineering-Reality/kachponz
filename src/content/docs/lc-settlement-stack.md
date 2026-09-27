The Amadeus LC Settlement Stack is a robust, enterprise-grade distributed system designed to securely automate the settlement of Import LC / SKBDN / SBLC transactions.

This stack is strictly built on **TypeScript and Node.js**, completely eliminating legacy Python dependencies. Four distinct services coordinate to transition a transaction from `submitted` to `advised` seamlessly.

---

## 1. `transaction_tracker` (Fastify Core)

The central orchestrator and the ultimate source of truth. Running on Port `8080`, this service manages the state machine, transaction ledger, and cryptographic validation.

### Key Responsibilities

- **The State Machine**: Powered by `src/config/stepFlows.ts`, it defines the strict 9-step progression:
  > `submitted → distributed_to_analyst → doc_examined → ee_ntf_created → ee_ntf_approved → mt_converted → swift_released → settled → advised`

- **The LangGraph Engine**: Dynamically loads agents to determine the correct MCP tools and execute reasoning over the state flow.
- **Dual Authentication Layer**:
  1. **Identity (`X-Robot-Key`)**: A unique, argon2-hashed API key validated on every request.
  2. **Non-Repudiation (HMAC-SHA512)**: Required exclusively for **financial steps** (`mt_converted`, `swift_released`, `settled`).

> [!CAUTION]
> **The `SIGNATURE_PEPPER` Gotcha:** Every MCP client must construct the signature using the exact same `SIGNATURE_PEPPER` as the `transaction_tracker`. A mismatch will result in a silent `SIGNATURE_REQUIRED` rejection.

### Essential REST API Surface

```typescript
// Core Transaction Endpoints
POST /transactions                    // Initialize new settlement
GET  /transactions/:id                // Retrieve ledger state
POST /transactions/:id/steps/:step/complete // Mutate state (requires HMAC for financial)

// Orchestration & Routing
POST /orchestrator/dispatch           // Trigger LangGraph reasoning
GET  /orchestrator/route              // Get cheapest executor for a step

// Agent-to-Agent (A2A)
POST /a2a                             // v0 Envelope Protocol
POST /a2a/rpc                         // v1 JSON-RPC 2.0 Protocol
```

---

## 2. `amadeus-mcp` (Tool Adapter)

A crucial bridge operating on Port `10002` via SSE transport. It acts as an MCP server wrapper (`src/client/trackerClient.ts`) exposing the `transaction_tracker`'s REST endpoints as functional tools for LLM agents.

**Exposed Tools:**
- `list_transactions`
- `get_transaction`, `create_transaction`
- `dispatch_step`, `complete_step`, `fail_step`
- `list_executors`, `explain_route`

> [!TIP]
> `amadeus-mcp` automatically computes the complex HMAC-SHA512 cryptographic signatures client-side, offloading this burden from the LangGraph agents.

---

## 3. `mcp-uipath` (RPA Integration)

An enterprise-ready UiPath Automation Cloud MCP server operating on Port `10001` (SSE).

**Exposed Tools:**
- `list_uipath_processes`
- `trigger_uipath_job`
- `get_uipath_job_status`

It leverages OAuth2 `client_credentials` against `{UIPATH_BASE_URL}/identity_/connect/token` to authenticate safely, allowing LangGraph agents to trigger physical RPA jobs without ever directly handling sensitive credentials.

---

## 4. End-to-End Testing & Demos

The repository includes a deterministic, REST-based end-to-end testing script: `microservice/transaction_tracker/scripts/e2e-demo.ts`.

It drives all 9 state transitions programmatically in two modes:
- **`DEMO_MODE=simulate`** (Default): Bypasses real UiPath jobs. Financial steps are completed by computing the HMAC signature inline.
- **`DEMO_MODE=live`**: Calls the UiPath Cloud REST API directly, waiting for physical robot completion before progressing the state machine.

```bash
# Run the simulated E2E test
cd microservice/transaction_tracker
npx tsx scripts/e2e-demo.ts
```
