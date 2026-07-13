# Prompt #9 — Amadeus: Build a "Recipe Executor" (Loop Mode) for the Danantara UiPath Flow

## Context you need before touching anything

1. `microservice/transaction_tracker/src/orchestrator/engine.ts` — `runAgenticStep` /
   `runAgenticStepStream` and `createReactAgent` usage. This prompt does NOT replace
   these — the ReAct agent stays for ad-hoc/conversational requests. This is a NEW,
   separate execution path specifically for the disposable-email/login/OTP/survey loop.
2. `microservice/transaction_tracker/src/orchestrator/executors/uipathExecutor.ts` —
   reuse `getAccessToken` / the OAuth flow, don't duplicate it.
3. The mcp-uipath tools this recipe depends on: `list_uipath_processes`,
   `trigger_uipath_job`, `wait_for_uipath_job`, `get_uipath_asset`,
   `get_uipath_job_status`. Confirm current schemas for each before wiring calls —
   check the canonical `~/Downloads/amadeus-uipath-mcp/src` (per the reconciliation
   done in Prompt 08) for exact parameter names and return shapes.
4. The two concrete bugs this is meant to structurally eliminate, evidenced in a live
   transcript:
   - The agent's own narration referenced a job ID (`394801637`) that didn't match
     the ID it actually received from `trigger_uipath_job` (`110724984`) a few tool
     calls earlier, then used the wrong ID in a subsequent `get_uipath_job_status`
     call.
   - The agent passed the literal string `"Get_DisposableEmail_3"` as `releaseKey`
     to `trigger_uipath_job` instead of the actual GUID it should have resolved via
     an earlier `list_uipath_processes` call, causing "Undefined process."
   Both are class-level bugs, not one-off mistakes — free-form text is not a reliable
   place to carry an ID across many tool calls and multiple user turns. The fix is
   structural: stop asking the model to remember and re-type IDs at all.

## The core idea

Today, running the full loop ("trigger disposable email → wait → verify asset →
login → wait → OTP → wait → verify asset → input OTP → wait → survey → repeat N
times") is entirely the LLM's job to orchestrate turn-by-turn, via free-form
tool-calling, re-deriving what to do next from its own prior text every single step.
That's why a single "loop 3x" request needed four separate manual chat nudges to
actually finish, and why job IDs/releaseKeys got garbled along the way.

Instead: build a **Recipe Executor** — a small state machine, in code, that:

- Holds the actual state (current iteration, current step, real job IDs, real
  releaseKeys, retry counts) as **typed data**, not as something the LLM has to keep
  straight in prose.
- Executes the mechanical parts (trigger → wait → verify → advance) **without any LLM
  call at all** — these steps are fully deterministic given the recipe definition.
- Calls the LLM **only at bounded decision points** that genuinely need judgment —
  e.g. "this job Faulted with this error message, is this a retry-worthy transient
  failure or a permanent one?" — and feeds the LLM a small, structured snapshot of
  state for that one decision, not the entire conversation history.
- Runs the whole N-iteration loop within a single backend-driven execution, streaming
  progress to the frontend, rather than requiring the user to re-invoke the agent
  after every pause.

## Step 1 — Define the Recipe schema

Add `microservice/transaction_tracker/src/orchestrator/recipes/types.ts`:

```ts
export interface RecipeStepDef {
  id: string;                       // e.g. "get_disposable_email"
  releaseName: string;              // human name, e.g. "Get_DisposableEmail" — the
                                     // executor resolves the actual variant + GUID,
                                     // the LLM/config never hardcodes a GUID.
  variantParam?: "email" | "otp";   // which rotation counter this step reads, if any
  waitTimeoutSeconds: number;
  onFault: "rotate_variant" | "abort_iteration" | "abort_recipe";
  verifyAsset?: { assetName: string; mustBeNonEmpty: boolean };
}

export interface RecipeDef {
  id: string;                       // e.g. "danantara_survey_loop"
  folderId: string;
  maxVariants: number;               // e.g. 3, for _1/_2/_3 rotation — but see Step 2,
                                     // this must come from the real process list, not
                                     // be hardcoded here either
  steps: RecipeStepDef[];
  iterations: number;                 // how many times to repeat the whole step chain
  maxConcurrentJobs: 1;               // hard invariant, matches the UiPath robot's
                                     // real concurrency limit — not configurable per
                                     // recipe, this is an environment fact
}

export interface RecipeRunState {
  recipeId: string;
  runId: string;                     // generated at start, used for all logging/SSE
  currentIteration: number;
  currentStepIndex: number;
  currentVariant: number;             // 1, 2, or 3 — which _N is active right now
  resolvedReleaseKeys: Record<string, string>; // releaseName+variant -> real GUID,
                                                // resolved ONCE via list_uipath_processes
                                                // and reused — never re-typed
  activeJobId: string | null;         // the ONE job allowed to be Pending/Running,
                                     // per the concurrency invariant — code-owned,
                                     // never derived from LLM text
  iterationResults: Array<{
    iteration: number;
    status: "success" | "failed" | "aborted";
    detail: string;
  }>;
  status: "running" | "completed" | "failed" | "awaiting_llm_decision";
}
```

## Step 2 — Resolve releaseKeys ONCE, programmatically, at recipe start

This directly fixes Bug #2. Before executing any step, call `list_uipath_processes`
once, build `resolvedReleaseKeys` from the actual returned GUIDs matching each
`releaseName` + variant number (e.g. `"Get_DisposableEmail" + 3` → look up the process
named `Get_DisposableEmail_3` in the list, take its real `key` field). If a variant
doesn't exist in the returned list (like the missing `_3` in the transcript), that's
detected HERE, deterministically, before any job is triggered for it — not discovered
by triggering a job and getting "Undefined process" back.

```ts
async function resolveReleaseKeys(recipe: RecipeDef, mcpClient: McpClient): Promise<Record<string, string>> {
  const processes = await mcpClient.callTool("list_uipath_processes", { folderId: recipe.folderId });
  const resolved: Record<string, string> = {};
  const missingVariants: string[] = [];

  for (const step of recipe.steps) {
    for (let variant = 1; variant <= recipe.maxVariants; variant++) {
      const expectedName = step.variantParam ? `${step.releaseName}_${variant}` : step.releaseName;
      const match = processes.find((p: any) => p.name === expectedName);
      if (match) {
        resolved[`${step.releaseName}_${variant}`] = match.key;
      } else if (step.variantParam) {
        missingVariants.push(expectedName);
      }
    }
  }

  if (missingVariants.length > 0) {
    // Surface this as a KNOWN LIMIT before the recipe even starts, instead of
    // discovering it mid-loop after already burning an iteration on it.
    log.warn({ missingVariants }, "Some recipe variants not found in UiPath folder — rotation will skip these");
  }

  return resolved;
}
```

Then `recipe.maxVariants` for THIS specific Danantara recipe should be derived from
however many `Get_DisposableEmail_N` processes actually exist in the folder, not
hardcoded to 3 — the transcript showed only `_1` and `_2` actually exist despite the
process list document elsewhere implying `_3` exists too; trust the live
`list_uipath_processes` call over any stale assumption.

## Step 3 — The deterministic step executor (no LLM involved)

```ts
async function executeStep(
  step: RecipeStepDef,
  state: RecipeRunState,
  mcpClient: McpClient,
): Promise<{ outcome: "success" | "fault" | "timeout"; detail: string }> {
  // Hard concurrency invariant, enforced in code, not requested of the model:
  if (state.activeJobId !== null) {
    throw new Error(`Recipe invariant violated: attempted to trigger a new job while ${state.activeJobId} is still active. This should never happen — it's a bug in the executor, not something to work around.`);
  }

  const releaseKey = state.resolvedReleaseKeys[`${step.releaseName}_${state.currentVariant}`]
    ?? state.resolvedReleaseKeys[step.releaseName]; // non-variant steps like Danantara_LoginFlow
  if (!releaseKey) {
    return { outcome: "fault", detail: `No resolved releaseKey for ${step.releaseName} variant ${state.currentVariant} — variant does not exist in this UiPath folder.` };
  }

  const triggerResult = await mcpClient.callTool("trigger_uipath_job", { releaseKey, folderId: state.recipeFolderId });
  const jobId = triggerResult.jobId; // from the actual tool result, never re-typed
  state.activeJobId = jobId; // code owns this now — the LLM is never asked to recall it

  const waitResult = await mcpClient.callTool("wait_for_uipath_job", { jobId, timeoutSeconds: step.waitTimeoutSeconds });
  state.activeJobId = null; // freed as soon as the job reaches a terminal state OR times out

  if (waitResult.timedOut) {
    return { outcome: "timeout", detail: `Job ${jobId} did not finish within ${step.waitTimeoutSeconds}s` };
  }
  if (waitResult.state !== "Successful") {
    return { outcome: "fault", detail: waitResult.info ?? `Job ${jobId} ended with state ${waitResult.state}` };
  }

  if (step.verifyAsset) {
    const asset = await mcpClient.callTool("get_uipath_asset", { assetName: step.verifyAsset.assetName, folderId: state.recipeFolderId });
    if (step.verifyAsset.mustBeNonEmpty && !asset.value) {
      return { outcome: "fault", detail: `Asset ${step.verifyAsset.assetName} is empty after a Successful job — treating as a fault.` };
    }
  }

  return { outcome: "success", detail: `Job ${jobId} completed successfully` };
}
```

Every `jobId` and `releaseKey` used here comes from a tool result or from
`resolvedReleaseKeys` — never from LLM-generated text. This structurally makes both
transcript bugs impossible, not just less likely.

## Step 4 — LLM decision points only where judgment is genuinely needed

Only ONE decision point in this specific recipe needs a model: **interpreting an
unfamiliar fault reason to decide whether it's retry-worthy.** Everything else
(rotate on fault per `onFault: "rotate_variant"`, abort after exhausting variants,
verify assets, advance iteration) is handled by the deterministic executor with no
LLM call.

```ts
async function classifyFault(detail: string, model: ChatModel): Promise<"retry" | "abort"> {
  const KNOWN_RETRYABLE = ["not authorized", "rate limit", "quota"];
  if (KNOWN_RETRYABLE.some(k => detail.toLowerCase().includes(k))) return "retry"; // no LLM call needed for known patterns
  // Only call the LLM for genuinely novel error text:
  const response = await model.invoke([
    { role: "system", content: "You classify UiPath job fault reasons as either 'retry' (transient, worth trying the next email variant) or 'abort' (permanent, retrying won't help). Respond with exactly one word: retry or abort." },
    { role: "user", content: detail },
  ]);
  return response.content.trim().toLowerCase() === "retry" ? "retry" : "abort";
}
```

This is a single, narrow, stateless LLM call — not the whole ReAct loop. It gets a
short string in, returns one word out. It cannot hallucinate a job ID because it never
sees one.

## Step 5 — Wire it as a new endpoint, separate from the existing agentic path

Add `POST /orchestrator/recipes/:recipeId/run` in
`microservice/transaction_tracker/src/orchestrator/routes.ts`, alongside (not
replacing) `/orchestrator/run-agentic`. Body: `{ folderId, iterations }`. Response:
Server-Sent Events streaming `RecipeRunState` updates as the recipe progresses —
reuse the existing SSE infrastructure (`EventEmitter`, per the existing in-memory SSE
pattern already used elsewhere in this codebase) rather than building a new one.

Frontend: add a "Loop Mode" toggle/button on `/agent-invoke` for the Danantara CX100
agent specifically — when active, it calls this new endpoint instead of
`/orchestrator/run-agentic`, and renders `RecipeRunState` updates as a structured
progress view (iteration N of M, current step, current variant) rather than a raw
chat transcript. This is a genuinely different UI from the chat view — it's a
progress tracker, not a conversation.

## Step 6 — Define the actual Danantara recipe as data

```ts
export const danantaraSurveyLoopRecipe: RecipeDef = {
  id: "danantara_survey_loop",
  folderId: "999269",
  maxVariants: 3, // will be corrected down to what list_uipath_processes actually
                  // returns, per Step 2 — this is just the upper bound to check for
  steps: [
    { id: "get_email", releaseName: "Get_DisposableEmail", variantParam: "email", waitTimeoutSeconds: 120, onFault: "rotate_variant", verifyAsset: { assetName: "TemptomailFlow_TempMail", mustBeNonEmpty: true } },
    { id: "login", releaseName: "Danantara_LoginFlow", waitTimeoutSeconds: 120, onFault: "abort_iteration" },
    { id: "get_otp", releaseName: "Get_OTP_Email", variantParam: "otp", waitTimeoutSeconds: 120, onFault: "abort_iteration", verifyAsset: { assetName: "TemptomailFlow_OTP", mustBeNonEmpty: true } },
    { id: "input_otp_and_survey", releaseName: "Danantara_InputOTPFlow", waitTimeoutSeconds: 180, onFault: "abort_iteration" },
  ],
  iterations: 3, // overridden by the request body's `iterations` param at run time
  maxConcurrentJobs: 1,
};
```

## Acceptance criteria

- [ ] A `POST /orchestrator/recipes/danantara_survey_loop/run` request with
      `{ iterations: 3 }` completes (or reports a clean partial result) without any
      manual chat follow-up — no "lanjutkan", no "iya betul yang pertama" needed.
- [ ] `resolvedReleaseKeys` is populated once at recipe start from a real
      `list_uipath_processes` call; a missing variant (like the absent `_3` in the
      transcript) is detected before any job is triggered for it, not after a failed
      `trigger_uipath_job` call.
- [ ] `activeJobId` is always code-derived from an actual `trigger_uipath_job`/
      `wait_for_uipath_job` result — grep the implementation to confirm no code path
      accepts a job ID from LLM-generated text.
- [ ] The `classifyFault` LLM call is only invoked for fault reasons not matching the
      known-pattern list, and receives only the fault string — not the full
      conversation or job ID history.
- [ ] SSE progress updates show iteration/step/variant progress in the frontend's Loop
      Mode view, distinct from the regular chat transcript.
- [ ] The existing `/orchestrator/run-agentic` ReAct path is completely unchanged —
      this is an additive, separate execution path, not a replacement.

## Non-goals

- Do NOT try to generalize this into a fully generic "recipe language" covering every
  possible UiPath workflow in this PR — build it specifically for the
  `danantara_survey_loop` case. Generalizing prematurely is how the original
  system-prompt approach became unmaintainable; ship the concrete case first.
- Do NOT remove or disable the existing ReAct agentic path — ad-hoc, conversational
  requests to the Danantara CX100 agent (e.g. "check the status of job X") still go
  through `/orchestrator/run-agentic` as before. This new path is only for the
  specific "run the full loop N times" case.
- Do NOT let the `classifyFault` LLM call see or influence `activeJobId`,
  `resolvedReleaseKeys`, or any other state field — it takes a string in, returns one
  word out, nothing else.
