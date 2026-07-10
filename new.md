# Amadeus — Decouple MCP Servers from Monorepo + Eliminate Redundant Code

Working directories: the entire `ponzgen` repo root — this touches `microservice/mcp-uipath/`, `microservice/amadeus-mcp/`, `microservice/transaction_tracker/`, and `microservice/frontend/`.

## Context

Read this before touching anything. These are facts confirmed by reading the current codebase, not assumptions:

**`mcp-uipath`** is already 100% self-contained. Zero imports from anywhere in the monorepo. All credentials via env vars, all UiPath API calls local to the file. It's ready to extract *right now* with only a `package.json` tweak.

**`amadeus-mcp`** is a thin HTTP proxy — every tool in `src/tools/*.ts` calls `trackerClient.ts`, which `fetch()`es the transaction_tracker REST API at `AMADEUS_API_BASE`. Zero direct DB access, zero shared modules with the monorepo except the `@modelcontextprotocol/sdk` and `zod` npm packages (which are public). It too can be extracted immediately.

**`mcpAutoManager.ts`** already reads `{command, args[]}` from the DB's `tools` table and spawns via `spawn(command, args, { shell: false })` — the structured-args refactor from prior work is already in place. So the `npx -y package@latest` pattern works *today* if you just register a tool with `command: "npx", args: ["-y", "amadeus-uipath-mcp@latest"]` in the DB. **No mcpAutoManager code change is needed for this to work.** What IS needed is cleaning up the remnants: hardcoded path references, sample data in the frontend, stale comments, and the three copies of UiPath OAuth logic.

**Three copies of UiPath OAuth2 `client_credentials` flow exist independently:**
1. `microservice/mcp-uipath/src/index.ts` → `getUiPathToken()` — singleton cache, reads from `process.env`
2. `microservice/transaction_tracker/scripts/mcpAutoManager.ts` → `getUipathTokenForTool()` — multi-credential cache keyed by `toolId`, reads from extracted DB config
3. `microservice/transaction_tracker/src/orchestrator/executors/uipathExecutor.ts` → `getAccessToken()` — singleton cache, reads from `process.env`

All three do the exact same thing: `POST /identity_/connect/token` with `grant_type=client_credentials`, cache by `expires_in`, return `access_token`. This triplication is the kind of thing that rots — one gets a bugfix, the others don't.

## Phase 1 — Make both MCP packages npx-ready (no repo split yet, just package.json)

Don't create separate git repos yet — that's an ops/CI concern you'll do manually after the code changes. Just make each package publishable as-is.

### 1a. `microservice/mcp-uipath/package.json`

```json
{
  "name": "amadeus-uipath-mcp",
  "version": "1.0.0",
  "description": "UiPath MCP Server — trigger jobs, manage queues, fetch logs via UiPath Orchestrator Cloud API",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "amadeus-uipath-mcp": "build/index.js"
  },
  "files": ["build/", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

Add `#!/usr/bin/env node` as the first line of `src/index.ts` (before any imports) — this is what makes `npx` work: the `bin` entry points at the built JS, and the shebang tells the OS to run it with Node.

Verify this is enough:
```bash
cd microservice/mcp-uipath
npm run build
node build/index.js  # should start the server, same as before
# Simulate npx: link locally and run as a CLI
npm link
amadeus-uipath-mcp   # should start identically
npm unlink -g
```

### 1b. `microservice/amadeus-mcp/package.json`

Same pattern:

```json
{
  "name": "amadeus-orchestrator-mcp",
  "version": "1.0.0",
  "description": "Amadeus Orchestrator MCP Server — transaction tracker + step dispatcher",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "amadeus-orchestrator-mcp": "build/index.js"
  },
  "files": ["build/", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Same shebang addition to `src/index.ts`.

### 1c. Both packages: add a README.md documenting the env vars

Each package's README must list every env var it reads, whether required or optional, what it defaults to, and a one-line example — this is the contract between the orchestrator (which injects env) and the tool (which reads env). The user registering the tool in the Amadeus UI should be able to read this README and fill in the registration form correctly without looking at source code.

For `mcp-uipath`:
```
UIPATH_BASE_URL     (default: https://cloud.uipath.com)
UIPATH_ORG          (required)
UIPATH_TENANT       (required)
UIPATH_CLIENT_ID    (required)
UIPATH_CLIENT_SECRET (required)
UIPATH_FOLDER_ID    (required — numeric, from Orchestrator URL ?fid=XXXXXX)
UIPATH_SCOPES       (default: OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring)
PORT                 (default: 10001, overridden by Amadeus dynamic port allocator)
```

For `amadeus-mcp`:
```
AMADEUS_API_BASE       (default: http://127.0.0.1:8080)
AMADEUS_ROBOT_KEY      (required)
AMADEUS_SIGNATURE_PEPPER (required for financial steps)
PORT                    (default: 10002, overridden by Amadeus dynamic port allocator)
```

## Phase 2 — Eliminate the three copies of UiPath OAuth logic

After Phase 1, `mcp-uipath` will be a standalone package. Its `getUiPathToken()` stays inside it — that's correct, it's the tool's own concern.

The other two copies live inside the orchestrator (`transaction_tracker`) and must be consolidated into one:

### 2a. Extract `src/lib/uipathAuth.ts` in `transaction_tracker`

```ts
/**
 * UiPath OAuth2 client_credentials helper — SINGLE implementation.
 * Replaces the duplicated logic previously in:
 *   - scripts/mcpAutoManager.ts → getUipathTokenForTool()
 *   - src/orchestrator/executors/uipathExecutor.ts → getAccessToken()
 */
interface UiPathCredentials {
  baseUrl: string;
  org: string;
  tenant: string;
  clientId: string;
  clientSecret: string;
  scopes?: string;
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

/** Extract UiPath credentials from a tool's stored registration config. */
export function extractCredentialsFromToolRow(toolRow: any): UiPathCredentials | null {
  let versions = toolRow.versions;
  if (typeof versions === 'string') {
    try { versions = JSON.parse(versions); } catch { return null; }
  }
  const release = versions?.[versions.length - 1]?.released;
  const rawCredsArg: string | undefined = Array.isArray(release?.args)
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
    };
  } catch {
    return null;
  }
}
```

### 2b. Update consumers

**`scripts/mcpAutoManager.ts`**: delete `interface UipathCreds`, `uipathTokenCache`, `extractUipathCreds()`, `getUipathTokenForTool()`, `fetchJobStatus()`. Replace with imports from `../src/lib/uipathAuth.js`:

```ts
import { getUiPathToken, extractCredentialsFromToolRow } from '../src/lib/uipathAuth.js';

// in fetchJobStatus:
const token = await getUiPathToken(toolId, creds);
```

**`src/orchestrator/executors/uipathExecutor.ts`**: delete `getAccessToken()` and its local cache. Import from `../lib/uipathAuth.js` instead:

```ts
import { getUiPathToken } from '../lib/uipathAuth.js';

// Build creds from env (this executor reads from process.env, not from DB):
const creds = {
  baseUrl: env.UIPATH_BASE_URL,
  org: env.UIPATH_ORG!,
  tenant: env.UIPATH_TENANT!,
  clientId: env.UIPATH_CLIENT_ID!,
  clientSecret: env.UIPATH_CLIENT_SECRET!,
};
const token = await getUiPathToken('env-default', creds);
```

The `cacheKey` parameter is what differentiates the two callers: the executor always uses the same env-level credentials (`cacheKey: 'env-default'`), while the poller in mcpAutoManager uses per-tool credentials (`cacheKey: toolId`). One function, one cache, zero duplication.

## Phase 3 — Purge hardcoded monorepo paths and stale references

Run these searches and fix every hit:

```bash
# All hardcoded filesystem paths to the MCP server folders
grep -rn "/mcp-uipath/build/\|/amadeus-mcp/build/\|/mcp-uipath/src/\|/amadeus-mcp/src/" \
  microservice/transaction_tracker/ microservice/frontend/ --include="*.ts" --include="*.tsx"
```

Specifically:

1. **`microservice/frontend/src/app/tools/page.tsx` lines ~355-390** — hardcoded sample/preset configs containing literal paths like `"/home/firania/Downloads/ponzgen/microservice/mcp-uipath/build/index.js"`. Replace these with the npx pattern:

```ts
// BEFORE (still in code):
{ name: "mcp-uipath", versions: [{ released: {
  method: "sse", command: "node",
  args: ["/home/firania/Downloads/ponzgen/microservice/mcp-uipath/build/index.js", ...],
}}]}

// AFTER:
{ name: "UiPath MCP", versions: [{ released: {
  method: "sse", command: "npx",
  args: ["-y", "amadeus-uipath-mcp@latest"],
  env: {
    UIPATH_ORG: "",
    UIPATH_TENANT: "",
    UIPATH_CLIENT_ID: "",
    UIPATH_CLIENT_SECRET: "",
    UIPATH_FOLDER_ID: "",
  },
}}]}
```

2. **`microservice/frontend/src/app/page.tsx` lines ~561, 709-710** — homepage copy mentioning `mcp-uipath` and `amadeus-mcp` as *embedded microservices with hardcoded ports*. Update to reflect the new reality: "Register any MCP-compatible tool via the Tools page — Amadeus discovers it dynamically."

3. **`microservice/frontend/src/app/dashboard/amadeus/page.tsx` line ~371** — stale reference to `amadeus-mcp · port 10002 · SSE transport · app.py not modified`. Remove or update.

4. **`scripts/e2e-demo.ts` lines 6-21** — instructions to `cd amadeus-mcp && npm run start`. Update to reflect the `npx` pattern, or note these are now external packages.

5. **Comments in `mcpAutoManager.ts` lines 104-105** — reference `mcp-uipath/src/index.ts` by path. After Phase 2, this code no longer exists in the monorepo — update the comment to reference the npm package name instead.

## Phase 4 — Chat session agent persistence (the other bug you reported)

This is unrelated to the MCP decoupling but you asked for it in the same breath. The issue: when you click a chat history entry, the agent dropdown resets to blank even though `switchSession()` at line 97 calls `setSelectedAgent(session.agentId)`.

**Root cause** (confirmed by reading the code): there's a race condition in the initial `useEffect` (line 77). On mount, it calls `switchSession(parsed[0].id)` — but `switchSession` references `sessions` state (line 96: `const session = sessions.find(s => s.id === id)`), and `sessions` is still `[]` at this point because `setSessions(parsed)` just fired but React hasn't re-rendered yet. So `session` is `undefined`, and `setSelectedAgent` never fires.

Additionally, the agent select dropdown at line 556 depends on `agents` being populated (fetched async from `/agents` API). If `switchSession` fires before that fetch returns, `selectedAgent` gets set to a UUID but `agents` is still `[]`, so `selectedAgentObj` is `undefined` and the dropdown renders blank — even though the state is correct underneath.

**Fix:**

```tsx
const switchSession = useCallback((id: string) => {
  setCurrentSessionId(id);
  // Read directly from localStorage instead of relying on the potentially-stale
  // `sessions` state — this eliminates the mount-time race condition entirely.
  const raw = localStorage.getItem('agent-sessions');
  const allSessions: ChatSession[] = raw ? JSON.parse(raw) : [];
  const session = allSessions.find(s => s.id === id);
  if (session) {
    setMessages(session.messages);
    setSelectedAgent(session.agentId);
    setInput('');
    setAttachments([]);
  }
}, []);
```

And for the dropdown rendering blank when `agents` hasn't loaded yet — don't show "Select an agent" placeholder when `selectedAgent` has a value but `agents` is empty (loading):

```tsx
// In the Select component's placeholder:
placeholder={agents.length === 0 ? "Loading agents..." : "Select an agent"}
```

## Verification plan

```bash
# Phase 1 — npx-readiness
cd microservice/mcp-uipath && npm run build
node build/index.js  # starts normally
head -1 build/index.js  # prints #!/usr/bin/env node

cd ../amadeus-mcp && npm run build
node build/index.js  # starts normally
head -1 build/index.js  # prints #!/usr/bin/env node

# Phase 2 — no more duplicated OAuth
grep -rn "client_credentials" microservice/transaction_tracker/src/ microservice/transaction_tracker/scripts/
# expect exactly ONE hit: src/lib/uipathAuth.ts
# (mcp-uipath has its own copy, but that's inside the standalone package — correct)

# Phase 3 — no more hardcoded paths
grep -rn "mcp-uipath/build/index\|amadeus-mcp/build/index\|/home/firania" \
  microservice/transaction_tracker/ microservice/frontend/ --include="*.ts" --include="*.tsx"
# expect ZERO hits

# Phase 4 — session agent restore
# Open agent-invoke, select UiPath Iqbal agent, send a message, close tab
# Reopen, click the chat history entry
# Expected: agent dropdown shows "UiPath Iqbal" immediately, not blank
```

## Constraints

- Do NOT create separate git repos or run `git subtree split` — that's a manual ops step the user will do after this code-level work is verified. Only make the packages self-contained and npx-ready within the existing monorepo structure.
- Do NOT delete `microservice/mcp-uipath/` or `microservice/amadeus-mcp/` folders yet — the user will do that after publishing to npm/private registry. Just make them ready to extract and clean all coupling from the consuming side.
- `shell: false` stays on all spawns, forever.
- Migrations additive only.
- Full response body logging on all UiPath API calls (already established, don't regress).
