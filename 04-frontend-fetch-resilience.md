# Prompt #4 — Amadeus: Fix Frontend "Failed to fetch" Noise + Workspace Root Warning

## Context you need before touching anything

Read these:

1. `microservice/frontend/src/components/UiPathLiveGraph.tsx` lines 127–157 — the polling `useEffect` that produces the `Failed fetching live trace TypeError: Failed to fetch` you're seeing in your terminal log.
2. `microservice/frontend/src/app/agent-invoke/page.tsx` lines 150–182 — how `apiUrl`/`robotKey` are resolved, and the initial `/agents` + `/tools` fetch on mount.
3. `microservice/transaction_tracker/src/orchestrator/routes.ts` lines 277+ (`/orchestrator/agents/:id/uipath-context`) — the backend endpoint being polled.
4. `microservice/frontend/next.config.ts` — currently empty config, which is why Next.js can't disambiguate the workspace root.
5. The exact terminal output you pasted — note the "Detected additional lockfiles" warning naming three separate `package-lock.json` files: `/home/firania/package-lock.json`, `/home/firania/Downloads/ponzgen/microservice/frontend/package-lock.json`, `/home/firania/Downloads/ponzgen/package-lock.json`.

## Problem 1 — Workspace root ambiguity (the easy, mechanical fix)

Next.js 16 with Turbopack found three `package-lock.json` files in the directory tree above `microservice/frontend` and guessed which one is the real monorepo root. It guessed wrong (picked `/home/firania/package-lock.json`, a stray lockfile at your home directory, not the project). This isn't just cosmetic — an incorrect root can cause Turbopack to resolve modules from the wrong `node_modules`, which explains flaky behavior that "sometimes just fixes itself on restart."

Fix: pin the root explicitly.

```ts
// microservice/frontend/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
```

Then separately: figure out why there's a `package-lock.json` sitting at `/home/firania/package-lock.json` (your home directory) at all — that's almost certainly an accidental `npm install` run from the wrong directory at some point, not an intentional monorepo boundary. Confirm with Jandy whether it's safe to delete; if some other project depends on it, leave it and just keep the `turbopack.root` pin.

## Problem 2 — `UiPathLiveGraph` polling failures are silent and noisy at the same time

Right now, `fetchContext` in `UiPathLiveGraph.tsx`:
- Fails silently to the UI (just `console.error`, no user-visible state) — so Jandy has no idea the sidebar is stale.
- Retries unconditionally every 4 seconds forever, even during a prolonged backend outage — spamming the console with the same `TypeError: Failed to fetch` on a fixed cadence, which is the noise you're seeing.
- Doesn't distinguish "backend is down" from "this specific agentId has no UiPath context yet" (both currently just `return` early or log-and-swallow).

Fix `fetchContext`:

```tsx
const [fetchError, setFetchError] = useState<string | null>(null);
const [consecutiveFailures, setConsecutiveFailures] = useState(0);

const fetchContext = async () => {
  try {
    const res = await fetch(`${apiUrl}/orchestrator/agents/${agentId}/uipath-context`, {
      headers: { 'X-Robot-Key': robotKey }
    });
    if (!res.ok) {
      if (isMounted) {
        setFetchError(`Backend returned ${res.status}`);
        setConsecutiveFailures(f => f + 1);
      }
      return;
    }
    const data = await res.json();
    if (isMounted) {
      setContextData(data);
      setLoading(false);
      setFetchError(null);
      setConsecutiveFailures(0);
    }
  } catch (e) {
    if (isMounted) {
      setFetchError(e instanceof Error ? e.message : 'Unknown fetch error');
      setConsecutiveFailures(f => f + 1);
    }
    // Keep this console.error but make it identify WHICH agent/endpoint,
    // not just a bare stack trace — you're currently debugging blind.
    console.error(`[UiPathLiveGraph] fetch failed for agent ${agentId}:`, e);
  }
};
```

Then:
- Render a small inline banner in the graph panel when `fetchError` is set and `consecutiveFailures >= 2` ("Live trace unavailable — backend unreachable" with the last error string). Don't show a banner on the very first transient failure; only after 2 in a row, to avoid flicker on normal network blips.
- Back off the poll interval when failing: keep 4000ms while healthy, but if `consecutiveFailures >= 3`, switch to 15000ms until a successful fetch resets it. This directly reduces the console spam you're seeing without silencing genuine errors.

```tsx
useEffect(() => {
  if (!agentId) { setContextData(null); setLoading(false); return; }
  let isMounted = true;
  let currentInterval = 4000;
  let timeoutId: ReturnType<typeof setTimeout>;

  const scheduleNext = () => {
    timeoutId = setTimeout(async () => {
      await fetchContext();
      currentInterval = consecutiveFailures >= 3 ? 15000 : 4000;
      if (isMounted) scheduleNext();
    }, currentInterval);
  };

  fetchContext().then(() => { if (isMounted) scheduleNext(); });
  return () => { isMounted = false; clearTimeout(timeoutId); };
}, [agentId, apiUrl, robotKey]);
```

(Adapt closure/state-staleness carefully — `consecutiveFailures` read inside `scheduleNext` needs a ref if you keep it as state, since the closure captures a stale value otherwise. Use `useRef` for the counter, not `useState`, to avoid this trap.)

## Problem 3 — CORS / network errors are indistinguishable from "backend not running" in the UI

`Failed to fetch` in the browser is what you get for CORS rejections, DNS failures, connection refused, AND mixed-content blocks — genuinely ambiguous. Since `apiUrl` defaults to `http://localhost:8080` (`agent-invoke/page.tsx` line 152) and the server log you pasted shows the backend listening on `127.0.0.1:8081`, **check whether `NEXT_PUBLIC_API_URL` is actually set to port 8081 in your `.env.local`** — a port mismatch between the documented default (8080) and what's actually running (8081) would produce exactly this symptom on every request, not just the UiPath sidebar.

Action: audit `microservice/frontend/.env.local` right now and confirm `NEXT_PUBLIC_API_URL=http://localhost:8081` (or whatever port `server.ts` actually binds). If it's missing or wrong, that alone likely explains a chunk of the "sering kayak gini" (frequently like this) pattern you're describing — not a bug to fix in code, but a config drift to fix in your environment.

Once confirmed correct, add one clarifying line to `microservice/frontend/README.md` documenting the actual required env vars (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ROBOT_KEY`) and their expected values for local dev, so this doesn't silently drift again next time the backend port changes.

## Acceptance criteria

- [ ] `turbopack.root` is pinned in `next.config.ts`; the "inferred workspace root" warning no longer appears on `npm run dev`.
- [ ] `.env.local` confirmed to point at the backend's actual bound port.
- [ ] `UiPathLiveGraph` shows a visible "Live trace unavailable" banner after 2 consecutive fetch failures, with the underlying error message.
- [ ] Poll interval backs off to 15s after 3 consecutive failures and resets to 4s on the next success.
- [ ] Console errors now include the agentId and endpoint, not just a bare `TypeError`.
- [ ] README documents required `NEXT_PUBLIC_*` env vars for local dev.

## Non-goals

- Do NOT add a global fetch-retry wrapper across the whole frontend in this PR — scope this to `UiPathLiveGraph` only. If the pattern proves useful, extract it later.
- Do NOT change the backend's CORS config unless the audit in Problem 3 reveals it's actually a CORS rejection (check the Network tab response headers first, don't guess).
- Do NOT delete `/home/firania/package-lock.json` without Jandy's explicit go-ahead — confirm first, it might be intentional.
