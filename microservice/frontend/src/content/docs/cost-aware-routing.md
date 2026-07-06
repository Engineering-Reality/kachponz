# Cost-Aware Executor Routing

The core cost-reduction idea of the settlement stack: **any step can be reassigned to a
cheaper executor without touching application code.**

## The Executor abstraction

`transaction_tracker/src/orchestrator/executors/base.ts` defines one contract for three
kinds of executor:

| Kind     | Cost unit (typical) | Completes... | Example |
|----------|---------------------|--------------|---------|
| `llm`    | ~3                  | synchronously (in-process) | Qwen VL document examination |
| `pad`    | ~10                 | asynchronously (fire-and-track) | Power Automate Desktop flow |
| `uipath` | ~100                | asynchronously (fire-and-track) | UiPath Orchestrator job |

An executor's `run(ctx)` returns one of three outcomes:
- `completed` — engine advances the state machine immediately (LLM executors only).
- `dispatched` — a job was handed to an external robot; the state machine does **not**
  advance until that robot reports back via `complete_step` or an A2A `task.complete`
  message.
- `failed` — with a `reason` string.

## The router

`executors/router.ts`'s `chooseExecutor(step, type)`:
1. Finds all registered executors whose capabilities match `(step, type)`.
2. If an `EXECUTOR_PREFERENCES` env entry exists for this step, honor it.
3. Otherwise picks the executor with the **lowest `costUnit`**.
4. Ties fall back to registration order.

`explain_route` (REST: `GET /orchestrator/route?step=&type=`, MCP tool: `explain_route`)
exposes this decision for introspection — exactly what the demo script's routing table
prints.

## Today's wiring (`executorMap.ts`)

| Step                     | Executor                        | Kind   | Cost |
|--------------------------|----------------------------------|--------|------|
| `submitted`              | *(none — manual, Contact Point)* | —      | 0    |
| `distributed_to_analyst` | `executor.pad.distribute`        | pad    | 10   |
| `doc_examined`           | `executor.qwen_vl.doc_exam`      | llm    | 3    |
| `ee_ntf_created`         | `executor.pad.ee_create`         | pad    | 10   |
| `ee_ntf_approved`        | *(none — manual, checker)*       | —      | 0    |
| `mt_converted`           | `executor.uipath.mt_convert`     | uipath | 100  |
| `swift_released`         | `executor.uipath.swift_release`  | uipath | 100  |
| `settled`                | `executor.uipath.settle`         | uipath | 100  |
| `advised`                | `executor.pad.advise`            | pad    | 10   |

**Total per LC: ~333 cost units, vs. ~900 if every step ran on UiPath — a 63% reduction**,
achieved purely by the router preferring cheaper executors, with zero code changes to
the state machine itself.

## Moving a step to a cheaper executor

No code change needed — set an env var and restart:

```bash
EXECUTOR_PREFERENCES="mt_converted=executor.pad.mt_convert"
```

The moment a PAD-based (or LLM-based) alternative executor for a step exists and is
registered, this env var alone reroutes that step to it.

## What's real vs. what's a stub today

- **UiPath executor** (`uipathExecutor.ts`): real OAuth2 + Orchestrator Jobs API calls —
  verified end-to-end against a live tenant.
- **Qwen VL executor** (`qwenDocExamExecutor.ts`): real 2-stage LLM pipeline (image
  extraction → compliance screening), but `dispatch_step` currently always passes an
  **empty** payload (`data: {}`), so it fails with "imageRef dokumen tidak tersedia"
  unless a caller supplies `imageRef` some other way — a known MVP gap noted directly in
  `dispatchBridge.ts`.
- **PAD executor** (`padExecutor.ts`): generic HTTP dispatcher, but `PAD_DISPATCH_MODE`
  defaults to `queued_only` (no real trigger — just records intent) until a team
  confirms the actual PAD trigger mechanism. No `mcp-pad` MCP server exists yet; adding
  one would follow the exact same pattern as `mcp-uipath`.
