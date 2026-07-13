# Prompt #5 — Amadeus: Fix localhost:3000 Infinite Spinner + Un-Globalize the Orchestration Prompt

## Context you need before touching anything

1. `microservice/frontend/src/app/layout.tsx` — imports `Inter`, `JetBrains_Mono`, `Poppins` from `next/font/google`.
2. `microservice/transaction_tracker/src/orchestrator/engine.ts` — search for `ORCHESTRATION_PATTERN` (added in a previous session). It's currently concatenated into `buildSystemPrompt()` for every agent, unconditionally.
3. `microservice/frontend/src/app/agents/page.tsx` around line 375 — the `agent_style` textarea. This is the per-agent system prompt field, editable per agent in the "Agent Matrix" UI.

## Part A — Diagnose and fix the infinite spinner

### Primary hypothesis (check this first)

`next/font/google` downloads font files from Google's font CDN (`fonts.googleapis.com` / `fonts.gstatic.com`) the first time a page using them is requested in dev mode — this is NOT bundled at `npm install` time, it happens lazily on first render request. In a regulated/air-gapped environment with restricted egress, this fetch hangs with no visible error in the terminal (the dev server still prints "Ready in Xms" because that message fires before the font fetch, which only happens on the first actual page request).

**Confirm this diagnosis first, don't just apply the fix blind:**

```bash
# Terminal 1: start the dev server, then open localhost:3000 in a browser
cd microservice/frontend && npm run dev

# Terminal 2, while the browser tab is still spinning: check if a font-fetch
# is actually the thing hanging
curl -v --max-time 5 https://fonts.googleapis.com/css2 2>&1 | tail -20
curl -v --max-time 5 https://fonts.gstatic.com 2>&1 | tail -20
```

If either `curl` times out or fails to resolve/connect, that confirms the diagnosis — the dev server is blocked on the same network path.

### Fix — self-host the fonts, remove the Google Fonts network dependency entirely

This is the correct fix regardless of whether the network is blocked today, because Bank Mandiri's environment is described as air-gapped/regulated — depending on live Google Fonts access at dev-server-request-time is fragile even if it happens to work today.

1. Download the three font families' `.woff2` files once (from a machine that DOES have internet access, or via `npm install @fontsource/inter @fontsource/jetbrains-mono @fontsource/poppins` if npm registry access is available — check `network_configuration` allowlist first).
2. Replace the `next/font/google` imports with `next/font/local`, pointing at the downloaded files under `microservice/frontend/src/app/fonts/`:

```ts
// layout.tsx
import localFont from "next/font/local";

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-sans",
});
const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-mono",
});
const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Regular.woff2", weight: "400" },
    { path: "./fonts/Poppins-Medium.woff2", weight: "500" },
    { path: "./fonts/Poppins-SemiBold.woff2", weight: "600" },
    { path: "./fonts/Poppins-Bold.woff2", weight: "700" },
  ],
  variable: "--font-ui",
});
```

3. `next/font/local` needs zero network access at request time — it's a build-time asset like any other static file. This permanently removes the class of bug, not just today's instance of it.

### If the fonts aren't actually the cause

Do these checks in order and report findings before changing more code:

1. Watch the `npm run dev` terminal output when you load the page — does it print `Compiling /` and then just sit there forever, or does it print `Compiled / in Xms` and the hang is purely in the browser? These are different bugs (server-side compile hang vs. client-side render/fetch hang).
2. Open browser DevTools → Network tab while the page is loading. Look for any request stuck in "Pending" — that request's URL tells you exactly what's hanging (a font, an API call, a source map, etc.).
3. Check whether `microservice/transaction_tracker` (the backend) is running at all — even though `page.tsx` and `AppShell.tsx` don't fetch anything on mount today, confirm no other component in the render tree (check `AgentContextPanel.tsx`, any provider wrapping `AppShell`) does a blocking fetch. Grep for `fetch(` across `src/app` and `src/components` and manually check each one's `useEffect` dependency array for anything that could run during initial mount of `/`specifically.

## Part B — Un-globalize the orchestration pattern (revert prior session's mistake)

A previous session baked a `ORCHESTRATION_PATTERN` constant directly into `buildSystemPrompt()` in `engine.ts`, which means every agent registered in the system — not just the Danantara CX100 UiPath automation agent — now gets the disposable-email/OTP/survey-loop instructions prepended to its behavior. This is wrong: an agent with a completely different job (e.g. a document-examination agent) has no business being told how to rotate through `Get_DisposableEmail_1/2/3`.

Fix:

1. In `engine.ts`, delete the `ORCHESTRATION_PATTERN` constant and remove it from `buildSystemPrompt()`'s return statement. Keep `ANTI_HALLUCINATION_SUFFIX` — that one is generic tool-integrity guidance ("don't claim you did something you didn't"), appropriate for every agent regardless of domain.

```ts
// Before:
return `${base}${toolContext}\n${ORCHESTRATION_PATTERN}\n${ANTI_HALLUCINATION_SUFFIX}`;

// After:
return `${base}${toolContext}\n${ANTI_HALLUCINATION_SUFFIX}`;
```

2. Confirm nothing else references `ORCHESTRATION_PATTERN` (search the whole `transaction_tracker` package) before deleting it — if `runAgenticStepStream`'s system prompt builder (the second `createReactAgent` call, around what's now line ~1096+) has its own copy, remove it there too.
3. Leave `wait_for_uipath_job`, `get_uipath_asset` (and `set_uipath_asset` if built) as-is — those are still generically useful MCP tools available to ANY agent that has the UiPath tool attached. Only the *prompt text telling an agent when/how to use them for this specific flow* moves out of the backend.
4. The actual per-agent instructions now live in that agent's `agent_style` field, edited via `/agents` in the frontend — see the separate file `danantara-cx100-system-prompt.md` for the exact text to paste into the Danantara CX100 agent's "System Prompt / Agent Persona" box. That's a copy-paste UI action, not a code change — don't try to seed it via a migration or seed script unless Jandy asks for that specifically.

## Acceptance criteria

- [ ] `localhost:3000` renders the home page within a few seconds of `npm run dev`, with no network requests stuck pending in DevTools.
- [ ] Fonts load from local files, zero requests to `fonts.googleapis.com`/`fonts.gstatic.com` in the Network tab.
- [ ] `ORCHESTRATION_PATTERN` no longer appears anywhere in `engine.ts`'s system prompt construction — grep confirms zero references.
- [ ] `ANTI_HALLUCINATION_SUFFIX` still applies to every agent (unchanged).
- [ ] A newly created agent with no custom `agent_style` does NOT mention UiPath disposable emails, OTP, or survey loops anywhere in its effective system prompt.

## Non-goals

- Do NOT remove `wait_for_uipath_job` / `get_uipath_asset` MCP tools — those stay, they're still useful, just not force-narrated to every agent.
- Do NOT add a "default agent_style per tool type" auto-fill feature in this PR — that's a bigger UX decision, flag it as a future idea if Jandy wants it, don't build it unprompted.
- Do NOT change the `agents` page's persistence logic — the UI already saves `agent_style` correctly per the code in `agents/page.tsx`; this PR doesn't touch that path at all.
