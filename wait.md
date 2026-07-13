# Prompt #7 — mcp-uipath: Make `wait_for_uipath_job` Actually Wait

## Context — read this before touching anything

This is for the **mcp-uipath** MCP server repo (separate from `transaction_tracker` —
locate it first; it's referenced elsewhere as a sibling path like
`microservice/mcp-uipath` or similar, spawned via `node .../mcp-uipath/build/index.js`).
If you can't find it in the current workspace, stop and ask Jandy for its path before
doing anything else — do not attempt to recreate it from scratch inside
`transaction_tracker`.

### The evidence this bug is based on

A live agent transcript shows this exact tool-call sequence, all in one turn:

```
wait_for_uipath_job {"jobId":"110710779"}
get_uipath_job_status {"jobId":"110710779"}
get_uipath_job_status {"jobId":"110710779"}
get_uipath_job_status {"jobId":"110710779"}
```

`wait_for_uipath_job` was called once, then the model immediately followed up with
three manual `get_uipath_job_status` calls for the same job in the same turn — which
is exactly what a model does when a "wait" tool returns instantly without the job
actually being in a terminal state. If `wait_for_uipath_job` genuinely polled
server-side until the job reached `Successful`/`Faulted`/`Stopped`, there would be no
reason for the model to immediately re-check the same job manually afterward — it
would already have the terminal state in the `wait_for_uipath_job` result.

The agent also stated, unprompted, in its own words: **"saya tidak punya tool untuk
menunggu secara aktif di background"** ("I don't have a tool that can actively wait in
the background") — meaning the model itself concluded, from the tool's actual
behavior, that `wait_for_uipath_job` does not wait. Trust this as behavioral evidence,
not just a hunch — go verify the implementation against it.

## Step 1 — Locate and read the current implementation

Find the tool handler for `wait_for_uipath_job` in the mcp-uipath source (likely
alongside `trigger_uipath_job` and `get_uipath_job_status` handlers — probably in a
single tools/handlers file). Read it end to end before changing anything. Specifically
check:

1. Does it call the UiPath Jobs OData endpoint (`GET /odata/Jobs({jobId})`) exactly
   once and return immediately, regardless of the job's `State`? — this is the bug, if
   present.
2. Or does it loop, but with a bug that makes the loop exit immediately (e.g. an
   `await` missing inside a `setTimeout`, a loop condition that's already false on
   first check, a timeout value of `0` or an unparsed env var, a `Promise.race` against
   a timer that always wins)?
3. Check the tool's declared `inputSchema` — does it even accept `timeoutSeconds` /
   `pollIntervalSeconds` params? If the schema doesn't declare them, the model can't
   pass them even if the handler would otherwise respect them — check both ends.

Report which of these it actually is before writing the fix — don't assume, confirm
from the code, since the fix differs depending on which bug it actually is.

## Step 2 — Implement a genuine server-side polling loop

Whatever the current state, the correct implementation is:

```ts
// Adjust import paths / OAuth helper name to match this repo's actual structure —
// this is illustrative of the shape, not a drop-in.
server.tool(
  "wait_for_uipath_job",
  "Poll a UiPath job until it reaches a terminal state (Successful, Faulted, Stopped) or times out. Blocks server-side — the tool call itself does not return until the job is terminal or the timeout expires.",
  {
    jobId: z.string().describe("The UiPath job ID returned by trigger_uipath_job"),
    folderId: z.string().optional(),
    timeoutSeconds: z.number().optional().default(300),
    pollIntervalSeconds: z.number().optional().default(5),
  },
  async (args) => {
    const timeoutMs = (args.timeoutSeconds ?? 300) * 1000;
    const pollMs = (args.pollIntervalSeconds ?? 5) * 1000;
    const deadline = Date.now() + timeoutMs;
    const TERMINAL_STATES = new Set(["Successful", "Faulted", "Stopped"]);

    let lastState = "Unknown";
    let lastInfo: string | null = null;
    let startedAt: string | null = null;

    while (Date.now() < deadline) {
      const token = await getUiPathToken(/* ...same creds path as the other tools... */);
      const res = await fetch(
        `${baseUrl}/${org}/${tenant}/odata/Jobs(${args.jobId})`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        // Transient fetch failure mid-poll — don't abort the whole wait, just
        // skip this tick and retry on the next interval. Only give up on the
        // deadline, not on a single flaky response.
        await sleep(pollMs);
        continue;
      }
      const job = await res.json();
      lastState = job.State;
      lastInfo = job.Info ?? null;
      startedAt = job.StartTime ?? startedAt;

      if (TERMINAL_STATES.has(lastState)) {
        return {
          content: [{
            type: "text",
            text: `Job ${args.jobId} reached terminal state: ${lastState}${lastInfo ? ` (${lastInfo})` : ''}`
          }],
          _meta: {
            jobId: args.jobId,
            state: lastState,
            info: lastInfo,
            timedOut: false,
          },
        };
      }
      await sleep(pollMs);
    }

    // Timed out without reaching a terminal state — this is NOT an error result,
    // it's a legitimate outcome the model needs to see clearly so it doesn't
    // treat a timeout as a success.
    return {
      content: [{
        type: "text",
        text: `Job ${args.jobId} did not reach a terminal state within ${args.timeoutSeconds ?? 300}s — last known state: ${lastState}`
      }],
      _meta: {
        jobId: args.jobId,
        state: lastState,
        info: lastInfo,
        timedOut: true,
      },
    };
  }
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Key requirements, regardless of exact code shape in this repo's conventions:

- **The `await` chain inside the tool handler must genuinely suspend** until either a
  terminal state is reached or the deadline passes. The MCP tool call itself is what
  blocks — the calling agent's turn waits on this promise. This is the whole point:
  the agent should NOT need to call this tool multiple times or manually follow up
  with `get_uipath_job_status` for the same job.
- **Distinguish `timedOut: true` from a terminal state** clearly in both the
  human-readable `content[0].text` and the structured `_meta`. A timeout is not a
  failure of the underlying job — the job might still be running — so don't word it
  as "job failed."
- **Don't let one flaky HTTP response abort the whole wait.** Skip and retry within
  the same deadline rather than throwing on the first non-200 response mid-poll —
  otherwise a single transient network blip turns a legitimate wait into a spurious
  tool error.
- **Reuse this repo's existing OAuth token helper and retry patterns** — do not
  hand-roll a second token-fetch implementation. If mcp-uipath already has an
  equivalent to `transaction_tracker`'s `getUiPathToken` (shared cache, retry/backoff
  per Prompt 02 Part D if that was already done here), call into it. If it doesn't
  have retry/backoff yet, that's Prompt 02 Part D's scope — don't silently duplicate
  it here, just note it as unaddressed if you find the auth call has no retry logic.

## Step 3 — Guard against a genuinely long-running job blocking the whole MCP connection

If this MCP server handles more than one concurrent tool call over the same
connection/transport, confirm that a long `wait_for_uipath_job` call (up to 300s by
default) doesn't block other tool calls on the same connection from being processed.
For stdio transport, each client connection typically gets its own process, so this is
usually fine — for SSE transport shared across multiple agents, verify tool calls are
handled concurrently, not serialized behind whichever one happens to be waiting the
longest. If they ARE serialized under SSE, cap the default `timeoutSeconds` lower
(e.g. 60s) for SSE-mode registrations specifically, or flag this as a reason to prefer
stdio for this particular tool (ties back to Prompt 03).

## Step 4 — Verify the fix against the exact scenario that surfaced the bug

Don't just unit test in isolation — reproduce the actual failure mode:

1. Trigger a real (or sandboxed test) UiPath job that's known to take at least 20-30
   seconds to complete.
2. Call `wait_for_uipath_job` with that job's ID and a `pollIntervalSeconds` of 5.
3. Time the tool call itself. It should take roughly as long as the job actually took
   to finish (± one poll interval), NOT return in under a second.
4. Confirm the returned `_meta.state` matches the job's actual final state from the
   UiPath Orchestrator UI, and `_meta.timedOut` is `false`.
5. Separately, test the timeout path: call it with a `timeoutSeconds` shorter than the
   job's actual runtime (e.g. `timeoutSeconds: 5` against a job that takes 30s).
   Confirm it returns at ~5s with `timedOut: true` and the last known non-terminal
   state, not an error.

## Step 5 — Tell the agent it can rely on this now (separate follow-up, not this PR)

Once this is fixed and verified, the Danantara CX100 agent's system prompt (the
`agent_style` text in `/agents`, per the earlier per-agent-not-global decision) can
stop telling the agent to ask the user for permission before re-checking status — that
was a workaround for `wait_for_uipath_job` not actually waiting. Flag this to Jandy as
a follow-up once Step 4 confirms the fix works; don't edit the agent's system prompt
text as part of this mcp-uipath PR — that's a separate, UI-side change he makes
himself.

## Acceptance criteria

- [ ] Root cause confirmed and stated explicitly (single-check-only vs. broken loop vs.
      schema not accepting timeout params) — not assumed.
- [ ] `wait_for_uipath_job`'s tool call duration in a live test matches the actual job
      runtime (± one poll interval), not near-instant return regardless of job state.
- [ ] Timeout path returns `timedOut: true` with the last known state, distinct from a
      terminal-state result.
- [ ] A single flaky HTTP response mid-poll does not abort the wait early.
- [ ] Concurrent tool call handling on the transport this server actually uses (stdio
      vs SSE) is confirmed not to be blocked by an in-flight long wait — or, if it is
      blocked under SSE, that's called out explicitly as a known limitation.
- [ ] No duplicate OAuth implementation introduced — reuses whatever token-fetch
      helper mcp-uipath already has.

## Non-goals

- Do NOT touch the Danantara CX100 agent's system prompt text in this PR — that's a
  UI-side edit Jandy makes at `/agents`, not a code change here.
- Do NOT add `wait_for_uipath_job` retry/backoff for the OAuth call itself if it
  doesn't already exist in this repo — that's Prompt 02 Part D's scope. Just flag it
  if you notice it's missing while you're in this file.
- Do NOT change `trigger_uipath_job` or `get_uipath_job_status` — this PR is scoped to
  `wait_for_uipath_job` only, since that's the tool the evidence points at.
