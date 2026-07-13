# Prompt #2 — Amadeus: Fix "Auth failed: fetch failed"

## Context you need before touching anything

Read these:

1. `microservice/transaction_tracker/src/lib/uipathAuth.ts` — the single source of truth for OAuth. Every UiPath call flows through here.
2. `microservice/transaction_tracker/src/orchestrator/executors/uipathExecutor.ts` line 108–124 — the caller path where the error currently surfaces.
3. `microservice/transaction_tracker/src/orchestrator/engine.ts` line 105–120 — `withMcpRetry` (existing retry pattern for MCP calls). Copy the shape of this for the auth retry.
4. Any `sanitizeMcpError` usage in engine.ts — the existing error-hygiene helper.

Note also: the mcp-uipath external server has its own OAuth token cache and its own fetch. That's a SECOND fetch path. This prompt covers the Amadeus-side one; mcp-uipath's own auth resilience is Part D below and needs a separate change in the sibling repo.

## The problem

`"Auth failed: fetch failed"` is what surfaces when `getUiPathToken` calls `fetch(${creds.baseUrl}/identity_/connect/token)` and Node's undici throws before an HTTP response arrives. `fetch failed` with no status code means: DNS resolution failed, TCP couldn't connect, TLS handshake failed, connection was reset mid-flight, or the process ran out of file descriptors. It is NOT a 401/403 — the credentials never got tested.

Current behavior:
- One failure = whole agent turn dies.
- No retry.
- Error surface is the raw string `"Auth failed: fetch failed"` — indistinguishable from a real credential problem.
- No circuit breaker: if UiPath's identity endpoint is down for 5 minutes, the frontend keeps generating token-fetch requests every time the sidebar polls (`UiPathLiveGraph` at 4-second intervals × N tools), and every one of them fails identically.

## What to build

### Part A — Retry with exponential backoff in `getUiPathToken`

Wrap the `fetch(...)` call in `src/lib/uipathAuth.ts` with a retry helper that:

- Retries only on network-class failures (no HTTP status): `fetch failed`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, `UND_ERR_SOCKET`. Detect via `error.cause?.code` where possible.
- Does NOT retry on 4xx (bad credentials — retrying won't help; retrying will lock the account).
- Retries on 5xx and on 429 (respect `Retry-After` header if present).
- 3 attempts total. Backoff: 500ms → 1500ms → 4500ms with ±25% jitter.
- On final failure, throw a typed error `UipathAuthError` with a `cause` property distinguishing:
  - `'network'` — connection couldn't be made (surface: "UiPath identity endpoint unreachable from this host")
  - `'credentials'` — 4xx (surface: "UiPath credentials rejected — check UIPATH_CLIENT_ID / UIPATH_CLIENT_SECRET")
  - `'server'` — 5xx after retries (surface: "UiPath identity service is unhealthy — retry later")
  - `'rate_limit'` — 429 after retries

Reuse the shape of `withMcpRetry` in `engine.ts` but with these auth-specific classifications — do NOT put auth logic inside `withMcpRetry`.

### Part B — Negative-cache the last failure for a short window

In the same `tokenCache` map, add a `lastFailure?: { at: number; error: UipathAuthError }` field per cacheKey. On any request within 10 seconds of a `'network'` or `'server'` failure, short-circuit and throw the cached error immediately instead of hammering the endpoint.

Do NOT negative-cache credential failures for less than 60 seconds — same rationale, don't lock the account.

Expose a `resetUiPathTokenCache(cacheKey?: string)` function that clears both the success cache and the failure cache. Wire it to a `POST /orchestrator/uipath-auth/reset` admin endpoint (behind the same `typedSecured` auth as other admin routes) so Jandy can force a fresh fetch after fixing credentials without a full restart.

### Part C — Better error surfacing in the caller

In `uipathExecutor.ts` around line 118, the current catch produces:
```
Gagal ambil OAuth token UiPath: ${e.message}
```

Change to:
```ts
if (e instanceof UipathAuthError) {
  const humanReason = {
    network: 'Tidak bisa reach UiPath identity endpoint (network/DNS/TLS)',
    credentials: 'Kredensial UiPath ditolak oleh identity server',
    server: 'UiPath identity service tidak sehat (5xx)',
    rate_limit: 'Rate limit UiPath identity — coba lagi nanti',
  }[e.cause];
  return {
    outcome: 'refused',
    reason: `${humanReason}: ${e.message}`,
    detail: { authFailureCause: e.cause },
  };
}
```

`outcome: 'refused'` (not `'dispatched'`) so the executor router doesn't count it as a successful dispatch.

Also add the `authFailureCause` field to the frontend `AgentContextPanel` display so the user sees "network" vs "credentials" at a glance.

### Part D — Mirror the fix in mcp-uipath (sibling repo)

The mcp-uipath server has an equivalent OAuth flow — the server logs show `[mcp-uipath] Fetching fresh OAuth token (cache empty)` right before some of the auth failures. That server needs the same retry + backoff + negative cache. Same three classes. Same shape.

If the mcp-uipath sibling repo isn't in the workspace, stop here and note this as a follow-up in the PR description with a pointer to the log line above. Do NOT reimplement mcp-uipath's OAuth inside `transaction_tracker`.

### Part E — Observability

Add structured logs at info level for every auth outcome:

```ts
log.info({
  cacheKey,
  outcome: 'success' | 'network' | 'credentials' | 'server' | 'rate_limit',
  attempt: 1 | 2 | 3,
  durationMs,
  status: httpStatus ?? null,
}, 'UiPath auth attempt');
```

Do NOT log the client secret or the access token, even at debug. The existing code doesn't; keep it that way.

## Acceptance criteria

- [ ] Simulated `fetch failed` (e.g. block `cloud.uipath.com` in `/etc/hosts` temporarily) triggers 3 retries visible in logs, then throws `UipathAuthError` with `cause: 'network'`.
- [ ] Credential rejection (401) does NOT retry, throws `UipathAuthError` with `cause: 'credentials'` on first attempt.
- [ ] Within 10 seconds of a network failure, subsequent `getUiPathToken` calls short-circuit (verify by log absence of a second `fetch attempt` line within the window).
- [ ] `POST /orchestrator/uipath-auth/reset` clears both success and failure cache.
- [ ] The user-visible error in the agent chat says "network" or "credentials" or "server", not `"fetch failed"` verbatim.
- [ ] No breaking change to `getUiPathToken`'s existing signature — the executor and the mcpAutoManager both keep working without modification.

## Non-goals

- Do NOT switch away from `client_credentials` grant. Auth flow stays the same.
- Do NOT add token refresh — the current cache-until-expiry-minus-30s pattern is fine.
- Do NOT introduce a circuit breaker library (e.g. `opossum`). A simple negative cache is enough for this scope.
- Do NOT touch UiPath API calls outside the token endpoint. Job triggering, status polling, etc. have their own retry story handled by `withMcpRetry`.
