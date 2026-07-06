# Amadeus A2A Protocol v1 — In-house Multi-Agent Coordination

Amadeus A2A Protocol v1 is a state-of-the-art multi-agent coordination protocol designed internally for Bank Mandiri's Trade Finance settlement (Import LC/SKBDN/SBLC). It facilitates secure, air-gapped coordination between RPA robots (UiPath, PAD) and agentic LLMs. 

## Design Principles
- **Agent Card Discovery**: The orchestrator's capabilities are machine-readable and discoverable without hardcoding.
- **JSON-RPC 2.0**: The protocol uses mature, structured request/response semantics with standardized error codes.
- **Multi-turn Task Lifecycle**: Every task has its own internal state machine (`submitted` → `working` → `input_required` → `completed` / `failed` / `canceled`). This allows for clarification loops without altering the underlying transaction step.
- **SSE Streaming**: Tasks offer Server-Sent Events for live, non-polling status updates.
- **Secure Signatures**: 2FA HMAC-SHA512 message envelopes with anti-replay timestamps.

## Backwards Compatibility
The server continues to support `amadeus.a2a/0` on `POST /a2a` for legacy robot configurations. However, all new integrations should utilize `POST /a2a/rpc` (v1).

## Terminology
- **Task**: An invocation of a specific `step` in the transaction lifecycle.
- **Message**: Immutable audit log entries for every state transition within a Task.
- **Agent Card**: A JSON schema representing the orchestrator's current capabilities, required parameters, and endpoints.

## Task Lifecycle Diagram
```text
submitted → working → completed
               ↓  ↑    → failed
       input_required  → canceled
```

## Method Reference

All requests follow the JSON-RPC 2.0 specification.
Endpoint: `POST /a2a/rpc`

### `task.submit`
Submits a new task to the orchestrator.
- **Params**: `transactionId` (string), `step` (string), `correlationId` (string), `data` (object, optional), `signature` (object, optional for financial steps).
- **Result**: `taskId`, `state`, `transactionId`, `step`, `assigneeHint`.

### `task.get`
Fetches task details and its message trail.
- **Params**: `taskId` (string)
- **Result**: Task data and `messages` array.

### `task.cancel`
Cancels an active task.
- **Params**: `taskId` (string), `reason` (string)
- **Result**: `taskId`, `state` (canceled)

### `task.provideInput`
Provides clarification when a task is in `input_required` state.
- **Params**: `taskId` (string), `data` (object)
- **Result**: `taskId`, `state` (working)

### `agent.card`
Retrieves the Agent Card.
- **Params**: None
- **Result**: The complete `AgentCard` object.

## Signature Scheme (Financial Steps)
For financial steps, the client must include an HMAC-SHA512 signature in the `task.submit` payload.

**Canonical String to Sign:**
```
POST\n/a2a/rpc\n<TIMESTAMP>\n<SHA256_OF_BODY>
```
Sign this string using HMAC-SHA512 with the robot's signing secret.

## SSE Streaming
Endpoint: `GET /a2a/tasks/{taskId}/stream`
Clients can open an SSE connection to receive live updates whenever the task state or messages change.

## End-to-end Example Workflow
1. RPA Robot uses `task.submit` to request the orchestrator to perform document examination.
2. The orchestrator returns a `taskId` with state `submitted`.
3. The internal executor starts processing and transitions the state to `working`.
4. The executor encounters an ambiguity and transitions the state to `input_required`, providing an `inputRequiredMsg`.
5. The robot (or a human via dashboard) sees the status and calls `task.provideInput` with the necessary data.
6. The executor resumes (`working`) and finally completes the task (`completed`), triggering the state tracker to advance to the next step.
