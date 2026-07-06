# A2A Protocol & Signatures

Amadeus A2A ("agent-to-agent") is an **in-house protocol**, not a vendor standard — built
for coordinating RPA robots (UiPath, PAD) and LLM agents (Qwen VL) around one shared
state machine in `transaction_tracker`. Two versions are both live for backwards
compatibility.

## v0 — envelope style (`amadeus.a2a/0`)

`POST /a2a` with a flat envelope:

```json
{
  "protocol": "amadeus.a2a/0",
  "type": "task.complete",
  "transactionId": "...",
  "step": "mt_converted",
  "idempotencyKey": "...",
  "correlationId": "...",
  "reason": "optional, required for task.failed",
  "data": {},
  "sentAt": "2026-07-06T05:06:24.803Z"
}
```

`type` is one of `task.assign` / `task.complete` / `task.failed` / `task.status`. This is
what `amadeus-mcp`'s `fail_step` tool sends, and what the frontend's A2A tab on
`/dashboard` shows as a reference payload.

## v1 — JSON-RPC 2.0 (`amadeus.a2a/1`)

`POST /a2a/rpc`, standard JSON-RPC 2.0 envelope (`jsonrpc: "2.0"`, `id`, `method`,
`params`). Supported methods:

- `task.submit` — submit a task for a `(transactionId, step)`; returns `taskId` + initial
  `state`.
- `task.get` — poll a task's current state.
- `task.cancel` — cancel a pending task.
- `task.provideInput` — supply input for a task in `input_required` state.
- `agent.card` — machine-readable capability discovery (see below).

Task lifecycle: `submitted → working → (input_required) → completed | failed | canceled`.

`task.submit` accepts an optional `signature: { timestamp, hmac }` — same HMAC-SHA512
scheme as the REST financial-step signature (see below), carried inside the RPC params
instead of HTTP headers.

## Agent Card discovery

`GET /.well-known/amadeus-agent-card.json` — public, unauthenticated — advertises the
orchestrator's supported auth schemes: `robot_key`, `hmac_signature`, and (per the card
builder) `oauth2_client_credentials`.

## The financial signature layer (shared by both protocol versions)

Financial steps (`mt_converted`, `swift_released`, `settled`) require a second auth
layer on top of `X-Robot-Key`:

```
canonical_string = METHOD \n PATH \n TIMESTAMP \n sha256(body)
signature        = HMAC-SHA512(key, canonical_string)
key              = signing_secret                        (if SIGNATURE_PEPPER unset)
                  = `${signing_secret}:${SIGNATURE_PEPPER}` (if set)
```

Sent as `X-Signature` (the HMAC, hex) + `X-Robot-Timestamp` (unix seconds, checked
against `SIGNATURE_MAX_SKEW_SEC` for anti-replay) + `X-Robot-Signing-Secret` (sent in
the clear on the wire — the server re-hashes and compares against the stored argon2
hash; this is a deliberate interim design documented in `middleware/auth.ts`, with
OAuth2/mTLS hardening noted as a roadmap item, not an oversight).

**The `SIGNATURE_PEPPER` gotcha:** every client that needs to complete a financial step
— `amadeus-mcp`, `e2e-demo.ts`, or any future robot — must know and use the *exact same*
`SIGNATURE_PEPPER` value as `transaction_tracker`, or its HMAC will never match and the
step will be rejected with `SIGNATURE_REQUIRED` even though a signature was sent. This
was hit and fixed live while building the settlement stack; both `amadeus-mcp/.env` and
`e2e-demo.ts`'s env now document `AMADEUS_SIGNATURE_PEPPER` explicitly for this reason.
