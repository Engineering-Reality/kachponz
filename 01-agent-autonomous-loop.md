# Prompt #1 — Amadeus: Make the Agent Actually Loop (Fix Fire-and-Forget)

## Context you need before touching anything

Read these first, in this order:

1. `microservice/transaction_tracker/src/orchestrator/engine.ts` — pay attention to:
   - Lines 43–55 (`ANTI_HALLUCINATION_SUFFIX`)
   - Lines 100–103 (`buildSystemPrompt`)
   - Lines 271–295 (`extractJobTraceMeta`)
   - Lines 851–880 (`createReactAgent` invocation — this is a single-turn stateless ReAct loop)
2. `microservice/transaction_tracker/src/orchestrator/executors/uipathExecutor.ts` — how job triggering already works via OAuth
3. `microservice/transaction_tracker/src/lib/uipathAuth.ts` — the shared OAuth token cache. Reuse this, do not re-implement.
4. The Amadeus CX100 conversation transcript in `others/prompts/` (or whichever docs folder) if one is present — check the pattern where the agent said "I'll silently monitor" but the turn just ended.

## The problem in one sentence

The Amadeus agent fires off `trigger_uipath_job` for a chain of processes (`Get_DisposableEmail_1` → `Danantara_LoginFlow` → `Get_OTP_Email_1` → `Danantara_InputOTPFlow`) nearly simultaneously, then claims it will "silently monitor and continue the loop" — but the turn ends, nothing monitors anything, downstream jobs run on empty Assets, and everything faults.

Root causes:
- **No `wait_for_uipath_job` MCP tool exists.** The agent cannot poll `get_uipath_job_status` in a bounded loop within one turn; it either fires everything at once or gives up.
- **No `get_uipath_asset` / `set_uipath_asset` MCP tools exist.** The agent cannot verify that `TemptomailFlow_TempMail` and `TemptomailFlow_OTP` are populated before triggering the step that consumes them. It has no way to check preconditions.
- **The system prompt has no execution pattern.** `ANTI_HALLUCINATION_SUFFIX` covers "don't lie" but not "here is how to sequence a chain of jobs with rotating fallback variants."

## What to build

### Part A — Add three MCP tools to the mcp-uipath server

The mcp-uipath server lives outside this repo (referenced as `mcp-uipath/build/index.js` in tool args). You will most likely need to work in that sibling repo. If you can't find it locally, stop and ask Jandy where it lives — do NOT reimplement it inside `transaction_tracker`.

Add these three tools with schemas that match the existing UiPath OData surface:

1. **`wait_for_uipath_job`**
   - Input: `{ jobId: string, timeoutSeconds?: number (default 300), pollIntervalSeconds?: number (default 5) }`
   - Behavior: poll `GET /odata/Jobs({jobId})` until `State` is one of `Successful`, `Faulted`, `Stopped`, or timeout expires.
   - Output: `{ jobId, finalState, info, startedAt, endedAt, durationSeconds, timedOut: boolean }`
   - Server-side implementation, not client-side sleep-in-a-tool-call. The MCP server owns the polling loop.
   - Same OAuth flow as existing tools; reuse the shared token cache in `mcp-uipath`.
   - Attach `finalState` on `_meta` too so it lands in `uipath_job_trace` via the existing `extractJobTraceMeta` path in `engine.ts`.

2. **`get_uipath_asset`**
   - Input: `{ assetName: string, folderId?: string }` (fall back to env `UIPATH_FOLDER_ID` if omitted, matching `list_uipath_processes` behavior)
   - Behavior: `GET /odata/Assets/UiPath.Server.Configuration.OData.GetRobotAssetByRobotKey` OR `GET /odata/Assets?$filter=Name eq '{assetName}'` — pick the endpoint that works for the tenant's asset type (Text assets should work with the second one).
   - Output: `{ assetName, value: string | null, type: 'Text' | 'Bool' | 'Integer' | 'Credential', exists: boolean }`
   - For `Credential` type, DO NOT return the password — return `{ value: '<redacted>', hasValue: boolean }`.

3. **`set_uipath_asset`** *(optional — see non-goals; only add if Jandy confirms he wants the agent to be able to WRITE assets, not just read them)*
   - Input: `{ assetName: string, value: string, folderId?: string }`
   - Behavior: `PUT /odata/Assets({id})` after resolving id by name.
   - Output: `{ assetName, updated: boolean, previousValue?: string }`
   - Guard with a config flag `MCP_UIPATH_ALLOW_ASSET_WRITE=true` — default off. Assets often store credentials; write-access needs an explicit opt-in.

For all three, follow the existing pattern in mcp-uipath: OAuth via `getUiPathToken`, `_meta` side-channel for structured data, human-readable `content[0].text` for the LLM.

### Part B — Change the agent's system prompt to a Recipe pattern

Edit `buildSystemPrompt` in `microservice/transaction_tracker/src/orchestrator/engine.ts` to append a new "Multi-step orchestration pattern" section BEFORE `ANTI_HALLUCINATION_SUFFIX`. The new section must teach the agent to:

1. **Plan before triggering.** When the user describes a multi-step chain, first list the sequence explicitly in the response ("Plan: A → wait → verify → B → wait → verify → C"). Do not start firing tools until the plan is stated.
2. **Never trigger two dependent jobs in the same tool-call turn.** Trigger step N, then `wait_for_uipath_job` for step N, then `get_uipath_asset` to verify preconditions for step N+1, THEN trigger step N+1.
3. **Rotate on failure.** If `Get_DisposableEmail_1` faults with an authorization/rate-limit error, retry with `_2`, then `_3`. If all three fault, STOP and surface the failure. Do not proceed to `Danantara_LoginFlow` when the temp-mail asset was never populated.
4. **Verify assets before consuming them.** Before triggering `Danantara_LoginFlow`, call `get_uipath_asset` for `TemptomailFlow_TempMail` and confirm `value` is non-empty. Same for `TemptomailFlow_OTP` before `Danantara_InputOTPFlow`.
5. **Report actual state, not aspirational state.** No "I'll silently monitor" — either the agent polls now, in this turn, using `wait_for_uipath_job`, or it says "job triggered, current state: Pending" and stops.

The prompt should include one concrete example — the disposable-email → login → OTP → survey → loop chain — worked all the way through in pseudo-code with tool names, so the model has a template to imitate.

### Part C — Raise the LangGraph recursion limit for these longer chains

At the `createReactAgent` invocation (engine.ts line ~871 and again around ~1096 for the streaming variant), the default `recursionLimit` is 25, which is barely enough for a 4-step chain with plan → trigger → wait → verify per step (that's ~16 tool calls minimum). Pass `{ recursionLimit: 75 }` in the `invoke` / `stream` call config:

```ts
const result = await agent.invoke(
  { messages: inputMessages },
  { recursionLimit: 75 }
);
```

75 is enough for one full disposable-email chain plus one retry variant. Do NOT go higher without a paired timeout, or a runaway loop can burn tokens for hours.

Add a hard wall-clock timeout on the whole `runAgenticStep` call — 15 minutes is generous for a survey chain. Use `Promise.race` against `setTimeout`.

### Part D — Wire the new tools into the health/context sidebar

`UiPathLiveGraph.tsx` reads `contextData.tools[].processes` etc. Extend the `/orchestrator/agents/:id/uipath-context` endpoint (routes.ts:280+) to also surface a recent `wait_for_uipath_job` outcomes list, so the sidebar visualizes which step of the chain is currently blocking. This is optional polish — don't do it if it expands scope beyond one PR.

## Acceptance criteria

- [ ] `wait_for_uipath_job` and `get_uipath_asset` appear in the mcp-uipath tool list and can be called from the Amadeus agent.
- [ ] Given the prompt `"loop the disposable email → login → OTP → survey chain 3 times"`, the agent produces a plan, triggers step 1, WAITS (visible in the transcript: an actual `wait_for_uipath_job` tool call, not a text claim), verifies the asset, then continues.
- [ ] When `Get_DisposableEmail_1` faults with "You are not authorized", the agent rotates to `_2` automatically, without user intervention.
- [ ] The transcript never contains "silently monitor", "I'll wait in the background", or any promise the agent can't keep in the current turn.
- [ ] The 4-step chain completes end-to-end for at least one variant without the user having to type "yes, go".
- [ ] `recursionLimit: 75` + 15-min wall-clock timeout are both in place.

## Non-goals (do not do these in this PR)

- Do NOT add background job scheduling, cron, or persistent workers. All orchestration stays inside a single agent turn — that is the whole point of `wait_for_uipath_job` living on the MCP server.
- Do NOT touch the Python legacy code in `microservice/mcp_2/mcp_auto_manager.py` or `microservice/mcp_tools/`.
- Do NOT change the OAuth flow. Reuse `getUiPathToken`.
- Do NOT `set_uipath_asset` unless Jandy confirms he wants write access. Ask first.
- Do NOT refactor `createReactAgent` to a custom graph. The prompt change is enough for now.
