# Amadeus — Missing `src/lib/uipathAuth.ts` Is Crashing the MCP Process Manager Silently

Working directory: `microservice/transaction_tracker/`.

## Root cause (confirmed, not a guess)

`scripts/mcpAutoManager.ts`, `src/orchestrator/executors/uipathExecutor.ts`, and `scripts/e2e-demo.ts` all import from `../src/lib/uipathAuth.js` (or `../../lib/uipathAuth.js`). **This file does not exist anywhere in the repository.** It was supposed to be created by the "consolidate the three UiPath OAuth implementations" refactor, but it's missing from the current working tree.

`mcpAutoManager.ts` is spawned from `src/server.ts`:

```ts
mcpManager = spawn('tsx', [path.join(__dirname, '../scripts/mcpAutoManager.ts')], {
  stdio: 'inherit',
  env: process.env
});
```

Because the import target doesn't exist, this child process crashes immediately with `ERR_MODULE_NOT_FOUND` the moment it starts. **`mcpAutoManager` is the only thing responsible for spawning MCP tool child processes** (UiPath, and any other registered tool). If it crashes at boot, no MCP server ever starts — not because of anything wrong with UiPath, not because of anything wrong with the MCP protocol, but because the one process responsible for launching MCP servers never got past its own import statement.

This is exactly consistent with what you're seeing: `trigger_uipath_job` fails with a generic "fetch failed" because the LangGraph engine tries to connect to a UiPath MCP server that was never spawned — there's nothing listening on the other end.

**Direct answer to your question**: this is not a UiPath problem and not an MCP protocol problem. It's a broken import left over from an incomplete refactor in this codebase.

## Step 1 — Confirm this immediately (30 seconds, do this first)

```bash
ls microservice/transaction_tracker/src/lib/
# if this errors "No such file or directory" or the folder is empty, the diagnosis above is confirmed

cd microservice/transaction_tracker && npm run dev
# watch the terminal output closely — you should see a Node crash stack trace
# mentioning "Cannot find module '.../src/lib/uipathAuth.js'" printed shortly
# after the "Server listening at..." line. This is the smoking gun.
```

If you see that crash, proceed to Step 2. If the file actually exists and the crash isn't there, something else is going on — stop and report what you actually see instead of assuming this diagnosis applies.

## Step 2 — Recreate the missing file

```ts
// microservice/transaction_tracker/src/lib/uipathAuth.ts

/**
 * UiPath OAuth2 client_credentials helper — the single implementation used
 * by everything inside transaction_tracker that needs a UiPath access token.
 * (mcp-uipath / amadeus-uipath-mcp, now an external package, keeps its own
 * copy — that's correct, it's that package's own concern and must remain
 * self-contained so it works when installed standalone via npx.)
 */

export interface UiPathCredentials {
  baseUrl: string;
  org: string;
  tenant: string;
  clientId: string;
  clientSecret: string;
  scopes?: string;
  folderId?: string;
}

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

export async function getUiPathToken(
  cacheKey: string,
  creds: UiPathCredentials,
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > now + 30_000) return cached.accessToken;

  const res = await fetch(`${creds.baseUrl}/identity_/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: creds.scopes ?? 'OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring',
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`UiPath OAuth2 failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  });
  return json.access_token;
}

/**
 * Extract UiPath credentials from a tool's stored registration config.
 * Prefers the env-based format (release.env.UIPATH_*); falls back to the
 * legacy args-JSON-blob format for any tool rows not yet migrated.
 */
export function extractCredentialsFromToolRow(toolRow: any): UiPathCredentials | null {
  let versions = toolRow.versions;
  if (typeof versions === 'string') {
    try { versions = JSON.parse(versions); } catch { return null; }
  }
  const release = versions?.[versions.length - 1]?.released;
  if (!release) return null;

  const env = release.env;
  if (env?.UIPATH_CLIENT_ID && env?.UIPATH_CLIENT_SECRET && env?.UIPATH_ORG && env?.UIPATH_TENANT) {
    return {
      baseUrl: env.UIPATH_BASE_URL || 'https://cloud.uipath.com',
      org: env.UIPATH_ORG,
      tenant: env.UIPATH_TENANT,
      clientId: env.UIPATH_CLIENT_ID,
      clientSecret: env.UIPATH_CLIENT_SECRET,
      scopes: env.UIPATH_SCOPES,
      folderId: env.UIPATH_FOLDER_ID,
    };
  }

  const rawCredsArg: string | undefined = Array.isArray(release.args)
    ? release.args.find((a: string) => typeof a === 'string' && a.trim().startsWith('{'))
    : undefined;
  if (!rawCredsArg) return null;
  try {
    const parsed = JSON.parse(rawCredsArg);
    if (!parsed.clientId || !parsed.clientSecret || !parsed.org || !parsed.tenant) return null;
    return {
      baseUrl: parsed.baseUrl || 'https://cloud.uipath.com',
      org: parsed.org,
      tenant: parsed.tenant,
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      folderId: parsed.folderId,
    };
  } catch {
    return null;
  }
}
```

Check whatever's currently in `mcpAutoManager.ts` and `uipathExecutor.ts` that calls `getUiPathToken`/`extractCredentialsFromToolRow` — confirm the function signatures above match how they're actually being called (cacheKey first arg, creds second). If there's a mismatch, fix the call sites, not this file — this file's shape is the one both callers were written against per the prior refactor's own summary.

## Step 3 — Verify it's actually saved and tracked this time

```bash
ls -la microservice/transaction_tracker/src/lib/uipathAuth.ts
git status microservice/transaction_tracker/src/lib/uipathAuth.ts
# confirm it shows as a new/modified tracked file, not "untracked" sitting outside git's view
git add microservice/transaction_tracker/src/lib/uipathAuth.ts
git commit -m "fix: restore missing uipathAuth.ts (was lost from prior refactor)"
```

Don't skip the `git add`/`commit` step — the leading theory for how this file went missing is that it existed locally but was never actually committed (possibly lost in a `git stash`/`stash pop` cycle from an earlier session), so make sure this time it's actually persisted in version control, not just sitting in the working tree.

## Step 4 — Confirm the build actually catches this class of error going forward

```bash
cd microservice/transaction_tracker
npx tsc --noEmit
```

This **must** fail loudly with `TS2307: Cannot find module` if any import target is missing — if it doesn't (e.g. if it silently passes), something about the tsconfig or the check command is wrong and needs fixing before trusting typecheck results again. Given `moduleResolution: "bundler"` in the current `tsconfig.json`, a genuinely missing file should always surface as a hard error. If a previous verification claimed "tsc exits 0" while this file was missing, figure out why that happened (wrong working directory? wrong tsconfig target? `scripts/` not actually included in that specific run?) and report it — don't just fix the file and move on without explaining the false-positive verification.

## Step 5 — Add a startup safety net so this fails loudly next time, immediately, not three tool calls into a chat

Right now, if `mcpAutoManager` crashes at spawn, the main API server (`transaction_tracker`) keeps running normally and only fails when a user actually tries to use a tool — minutes or hours later, and confusingly (a generic "fetch failed" gives no hint that the actual problem is "the process manager never started"). Fix this in `src/server.ts`:

```ts
mcpManager = spawn('tsx', [path.join(__dirname, '../scripts/mcpAutoManager.ts')], {
  stdio: 'inherit',
  env: process.env
});

let mcpManagerCrashedEarly = false;
const earlyExitTimer = setTimeout(() => {
  // If we get here without the 'exit' handler firing, the manager is alive — clear the flag.
}, 5000);

mcpManager.on('exit', (code, signal) => {
  clearTimeout(earlyExitTimer);
  if (code !== 0 && code !== null) {
    mcpManagerCrashedEarly = true;
    app.log.error(
      { code, signal },
      '🔴 MCP Auto Manager crashed at startup — NO MCP tool servers will be available. ' +
      'Every tool call (UiPath, etc.) will fail with a generic connection error until this is fixed. ' +
      'Check the stack trace immediately above this line for the actual cause.'
    );
  }
});
```

Add `GET /orchestrator/mcp/manager-status` returning `{ running: boolean, crashedEarly: boolean, lastError: string | null }` so the frontend (and you, manually) can check this at a glance instead of inferring it from a confusing chat failure. Surface a persistent banner in the frontend if this endpoint reports `crashedEarly: true` — e.g. at the top of the `agent-invoke` and `tools` pages: "⚠ MCP process manager is not running — tool calls will fail. Check server logs."

## Step 6 — About the double `trigger_uipath_job` call in your transcript

Separate, minor observation: the model called `trigger_uipath_job` twice in a row for the same request — once without an `arguments` field, once with `"arguments":{}`. This is very likely just the model retrying after the first call failed with a connection error (which makes sense given Steps 1-5), not a separate bug. Once the underlying connectivity is fixed, confirm this resolves on its own — if the model still double-calls identical tool invocations after Step 5's fix is verified, that's worth a separate look, but don't chase it before confirming the root cause here is actually fixed.

## Verification

```bash
# 1. Clean restart, watch for the crash — it should be GONE now
cd microservice/transaction_tracker && npm run dev
# confirm no "Cannot find module" stack trace appears

# 2. Confirm the MCP manager is actually alive
curl http://127.0.0.1:8080/orchestrator/mcp/manager-status
# expect { "running": true, "crashedEarly": false, "lastError": null }

# 3. Confirm UiPath tool servers actually spawned
curl http://127.0.0.1:8080/orchestrator/mcp/status
# expect entries with status: "running" for your registered UiPath tool

# 4. Re-run the exact failing scenario from your transcript
#    "trigger Robot1" / "trigger RPA_Challenge"
#    Expect: real success (Job ID returned), not "fetch failed"

# 5. Confirm the safety net actually catches a real crash —
#    deliberately break the import again temporarily, restart, confirm:
#    - the error is logged clearly with the 🔴 prefix
#    - GET /orchestrator/mcp/manager-status reports crashedEarly: true
#    then restore the fix and confirm it goes back to healthy
```

All five must pass. Step 5's safety net matters more than it might seem — this exact failure mode (a silent startup crash three layers away from where the symptom appears) is exactly the kind of bug that will keep recurring across future refactors unless something surfaces it immediately instead of three tool calls into a live chat.
