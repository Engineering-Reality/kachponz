The Amadeus platform introduces a core operational efficiency feature for the LC Settlement Stack: **Cost-Aware Routing**. Any execution step can be seamlessly reassigned to a cheaper automation executor without touching or redeploying the core application state machine.

## The Executor Abstraction

`transaction_tracker/src/orchestrator/executors/base.ts` defines a uniform contract for three primary kinds of automated executors:

| Executor Kind | Cost Unit (Relative) | Execution Mode | Example Use Case |
|---|---|---|---|
| `llm` | ~3 | Synchronous (In-Process) | Qwen VL document examination |
| `pad` | ~10 | Asynchronous (Fire-and-Track) | Power Automate Desktop flow |
| `uipath` | ~100 | Asynchronous (Fire-and-Track) | UiPath Orchestrator job |

An executor's `run(ctx)` function is guaranteed to return one of three deterministic outcomes:
- `completed` — The engine advances the state machine immediately (Typically for LLM or instant API executors).
- `dispatched` — A job was successfully handed to an external asynchronous robot. The state machine pauses and will **not** advance until that robot reports back via a `complete_step` REST call or an A2A `task.complete` message.
- `failed` — The execution failed immediately, returning a detailed `reason` string.

---

## The Routing Engine

The router (`executors/router.ts`) utilizes a strict evaluation matrix in `chooseExecutor(step, type)`:

1. **Capability Matching**: Identifies all registered executors whose capabilities match the requested `(step, type)`.
2. **Preference Override**: Checks if an explicit `EXECUTOR_PREFERENCES` environment variable exists for this step. If found, it forces the selection.
3. **Cost Optimization**: If no explicit override exists, it automatically selects the executor with the **lowest `costUnit`**.
4. **Tiebreaker**: Falls back to the order of registration.

> [!TIP]
> You can audit the router's real-time decisions via the `explain_route` endpoint (`GET /orchestrator/route?step=&type=`), which is also exposed to LangGraph agents as the `explain_route` MCP tool.

---

## Default Wiring (`executorMap.ts`)

| Step | Assigned Executor | Kind | Cost |
|---|---|---|---|
| `submitted` | *(None — manual/Contact Point)* | — | 0 |
| `distributed_to_analyst` | `executor.pad.distribute` | pad | 10 |
| `doc_examined` | `executor.qwen_vl.doc_exam` | llm | 3 |
| `ee_ntf_created` | `executor.pad.ee_create` | pad | 10 |
| `ee_ntf_approved` | *(None — manual/checker)* | — | 0 |
| `mt_converted` | `executor.uipath.mt_convert` | uipath | 100 |
| `swift_released` | `executor.uipath.swift_release` | uipath | 100 |
| `settled` | `executor.uipath.settle` | uipath | 100 |
| `advised` | `executor.pad.advise` | pad | 10 |

**ROI Impact**: Utilizing this dynamic map brings the total base cost per LC down to **~333 units**, compared to ~900 units if every step ran exclusively on premium UiPath robots—a **63% reduction** achieved with zero structural code changes.

---

## Re-Routing Steps Dynamically

To re-route a step to a cheaper executor, no code modification is required. Simply set the environment variable and restart the `transaction_tracker`:

```bash
export EXECUTOR_PREFERENCES="mt_converted=executor.pad.mt_convert"
```

The moment a PAD-based alternative executor is registered for `mt_converted`, this environment variable instantly forces the router to utilize it over UiPath, immediately reducing execution costs.
