# Prompt #10 — Amadeus: Fix Recipe Executor's Job-Waiting Strategy (MCP -32001 Timeout)

## Context — read this before touching anything

1. `microservice/transaction_tracker/src/orchestrator/recipes/` (from Prompt 09) —
   specifically the `executeStep` function that calls `wait_for_uipath_job`.
2. Whatever MCP client library/adapter this codebase uses to call mcp-uipath tools
   (check imports in `mcpAdapters.ts` / wherever `mcpClient.callTool` is defined) —
   find its request timeout configuration. Libraries built on the MCP TypeScript SDK
   typically have a default per-request timeout (often 60s) separate from anything a
   tool's own internal logic does.

## The problem

A live Recipe Executor run failed with `MCP error -32001: Request timed out` while
waiting on `Get_DisposableEmail_1` (job ID `110733831` — correctly tracked, not
hallucinated, confirming Prompt 09's core fix works). The error code `-32001` is a
JSON-RPC-level "Request timed out" — this fires at the **transport/client layer**,
independent of whatever timeout logic exists inside `wait_for_uipath_job`'s own
handler. Even if `wait_for_uipath_job` is correctly polling server-side toward its own
`timeoutSeconds` (120-300s in the recipe definition), the MCP client making that one
call gives up and errors out first if its own default request timeout is shorter.

## The fix — stop relying on one long-lived MCP call for waiting

The Recipe Executor already owns a loop in plain TypeScript (`executeStep`, from
Prompt 09). It doesn't need `wait_for_uipath_job` to block server-side at all — it can
poll `get_uipath_job_status` itself, in its own `while` loop, with each individual MCP
call being fast (well under any transport timeout), and let Node's own `setTimeout`
own the waiting between calls. This sidesteps the -32001 ceiling entirely, since no
single MCP call is ever open for more than a few seconds.

Replace the `wait_for_uipath_job` call in `executeStep` (Prompt 09, Step 3) with:

```ts
async function pollJobToTerminal(
  jobId: string,
  timeoutSeconds: number,
  mcpClient: McpClient,
): Promise<{ state: string; info: string | null; timedOut: boolean }> {
  const TERMINAL_STATES = new Set(["Successful", "Faulted", "Stopped"]);
  const pollIntervalMs = 5000; // well under any MCP transport's request timeout
  const deadline = Date.now() + timeoutSeconds * 1000;

  let lastState = "Unknown";
  let lastInfo: string | null = null;

  while (Date.now() < deadline) {
    try {
      const status = await mcpClient.callTool("get_uipath_job_status", { jobId });
      lastState = status.state;
      lastInfo = status.info ?? null;
      if (TERMINAL_STATES.has(lastState)) {
        return { state: lastState, info: lastInfo, timedOut: false };
      }
    } catch (err) {
      // A single flaky call mid-poll shouldn't abort the whole wait — log it and
      // keep polling until the deadline, same principle as Prompt 07's server-side
      // loop, just now living in the executor instead of the MCP server.
      log.warn({ jobId, err: String(err) }, "get_uipath_job_status call failed mid-poll, retrying");
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { state: lastState, info: lastInfo, timedOut: true };
}
```

Update `executeStep` to call `pollJobToTerminal` instead of the `wait_for_uipath_job`
tool:

```ts
// Before:
// const waitResult = await mcpClient.callTool("wait_for_uipath_job", { jobId, timeoutSeconds: step.waitTimeoutSeconds });

// After:
const waitResult = await pollJobToTerminal(jobId, step.waitTimeoutSeconds, mcpClient);
```

`state.activeJobId` bookkeeping and the rest of `executeStep`'s logic (timeout
handling, fault detection, asset verification) stays exactly the same — only the
mechanism for "how do we wait" changes, from one long MCP call to many short ones
driven by the executor's own loop.

## Note — this only applies to the Recipe Executor, not the ReAct chat path

The plain ReAct/chat path (`/orchestrator/run-agentic`) still calls
`wait_for_uipath_job` directly as an MCP tool, because in that path there's no
executor-owned loop to poll from instead — the LLM has to call *some* tool that waits.
If that path also starts hitting `-32001` in practice, the actual fix there is
different: either raise the MCP client's default request timeout for that specific
tool call (check whether the client library supports a per-call timeout override), or
shorten `wait_for_uipath_job`'s own internal `timeoutSeconds` default so it always
finishes comfortably inside whatever the transport ceiling is, and let the LLM re-call
it repeatedly for longer waits (accepting that as an acceptable, if clunkier, pattern
for the conversational path specifically — the Recipe Executor path is what's meant
to handle long unattended waits properly).

## Separately, flag but do not attempt to fix in this PR: the stuck Get_DisposableEmail_2 job

Job `110724984` has been stuck in `Running` state for hours across multiple test
sessions (confirmed via the UiPath Orchestrator dashboard directly, not just MCP
tooling). Its execution log shows a repeating cycle: "Get Temp Mail" → "Click Delete
Mail" → "Last Temp Mail: [empty]" — consistent with an actual logic bug inside that
specific UiPath workflow (e.g. waiting on a page element that never appears, or
looping on an empty scrape result without a bounded retry count). This is a UiPath
Studio-side automation bug, not something fixable from the Amadeus/MCP side. Recommend
to Jandy:

1. Manually stop/cancel job `110724984` directly in UiPath Orchestrator (Amadeus has
   no cancel-job MCP tool, so this has to be done in the Orchestrator UI or via a
   human with Orchestrator access).
2. Flag the underlying `Get_DisposableEmail_2` workflow to whoever maintains the
   UiPath Studio project — it likely needs a bounded retry count or a proper timeout
   around its temp-mail-scraping logic, so that a bad scrape result doesn't loop
   forever inside the robot itself.
3. Once cancelled, re-run the Recipe Executor test — a fresh `_2` job should behave
   like `_1` and `_3` unless the underlying workflow bug is systemic to that specific
   release (worth testing `_1` and `_3` again too, now that the polling fix is in
   place, to get a clean read on whether `_2`'s workflow itself is uniquely broken).

## Acceptance criteria

- [ ] `executeStep` no longer calls the `wait_for_uipath_job` MCP tool — it uses
      `pollJobToTerminal`'s own `get_uipath_job_status` loop instead.
- [ ] A Recipe Executor run against a job that takes 60-90 seconds to complete
      succeeds without any `-32001` error, with the executor's own poll loop handling
      the wait entirely in Node, not via one long MCP call.
- [ ] A single flaky `get_uipath_job_status` call mid-poll doesn't abort the whole
      wait — confirmed by temporarily forcing one call to throw and observing the
      loop continues.
- [ ] The stuck `110724984` job is confirmed cancelled (via Orchestrator, not code)
      before the next full test run, so it doesn't skew results.
- [ ] A clean 3-iteration Recipe Executor run completes end-to-end with correct job
      IDs and correct releaseKeys tracked throughout (re-confirming Prompt 09's
      original goal, now that the timeout issue is out of the way).

## Non-goals

- Do NOT change `wait_for_uipath_job`'s own implementation in mcp-uipath — it's still
  correct and still used by the ReAct chat path. This PR only changes what the Recipe
  Executor calls internally.
- Do NOT attempt to fix the `Get_DisposableEmail_2` UiPath workflow itself from this
  codebase — that lives in UiPath Studio, outside this repo's scope. Flag it, don't
  fix it here.
- Do NOT add a cancel-job MCP tool in this PR just to handle the stuck job — that's a
  separate, real feature request if Jandy wants it, not an emergency fix bundled in
  here.
