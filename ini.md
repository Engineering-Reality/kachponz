# Prompt #16 — Amadeus: Remove Transaction Tracker Dashboard, Refocus on Agent Automation

## Why (context, not instructions to act on)

Pivoting focus toward agent tools / automation (Loop Mode, Recipe Executor, MCP
integrations — the "Automation Anywhere"-style direction), away from the SWIFT/
trade-finance transaction-tracking dashboard. Doing this in a branch, so code-level
mistakes are recoverable — but the database is not automatically protected by a git
branch, so Part D below (data) gets handled more conservatively than the code parts.

## Step 0 — MANDATORY audit before deleting anything

Do not skip this. The word "transaction" is used by what looks like two different
subsystems in this codebase, and deleting the wrong one breaks the automation agents
this pivot is trying to preserve.

1. Confirm whether `microservice/amadeus-core/src/orchestrator/engine.ts`'s
   agent-invoke path (`runAgenticStep`, `runAgenticStepStream`, `loadMcpTools`,
   `createReactAgent` — the code actually used by Danantara CX100, Recipe Executor,
   and general `/agent-invoke` chat) imports anything from:
   - `orchestrator/executors/dispatchBridge.ts`
   - `orchestrator/executors/base.ts`
   - `orchestrator/agents/base.ts`
   - `orchestrator/a2a/*`
   - `services/transactions.ts`
   - `routes/transactions.ts`
   - `config/stepFlows.ts`

   ```bash
   grep -n "dispatchBridge\|from.*executors/base\|from.*agents/base\|from.*a2a/\|from.*services/transactions\|from.*stepFlows" microservice/amadeus-core/src/orchestrator/engine.ts
   ```

   If this returns NOTHING, that confirms the hypothesis: the ReAct/MCP agent system
   and the Transaction/A2A dispatch system are cleanly separate, and the transaction
   subsystem can be removed as one bounded unit. **Report this result explicitly**
   before proceeding to Step 1 — don't silently assume and move on.

2. If it DOES import something, stop and identify exactly what's shared. That shared
   piece needs to be decoupled (extracted to somewhere both systems can use, with the
   transaction-specific parts removed from it) BEFORE the rest of the transaction
   subsystem can be safely deleted. Do not proceed with bulk deletion while a real
   import dependency exists — that will break agent-invoke.

3. Check the three executors that also matched "transaction" —
   `orchestrator/executors/uipathExecutor.ts`, `padExecutor.ts`,
   `qwenDocExamExecutor.ts`. For each, determine: does Danantara CX100 (or any other
   agent meant to survive this pivot) actually call this executor class, or does it
   only call UiPath/PAD/Qwen-doc-exam via MCP tools directly through `engine.ts`
   instead? If an executor here is ONLY ever invoked through the `dispatchBridge`/
   transaction-step dispatch path and never through the MCP/ReAct path, it's part of
   the subsystem being removed. If any agent actually depends on it outside that
   dispatch path, it needs to be preserved and re-pointed, not deleted.

   ```bash
   grep -rln "uipathExecutor\|padExecutor\|qwenDocExamExecutor" microservice/amadeus-core/src --include="*.ts" | grep -v node_modules
   ```

   Read every result and classify it before deciding what to delete.

Only proceed past this point once Step 0's findings are clear and reported.

## Step 1 — Frontend: remove the transaction-tracking views

Assuming Step 0 confirms isolation:

1. Delete `microservice/frontend/src/app/(protected)/dashboard/page.tsx` (the page
   that renders `TransactionGraph.tsx`) — confirm first that this page is genuinely
   the transaction-tracking view and not something with unrelated content mixed in.
2. Delete `microservice/frontend/src/components/TransactionGraph.tsx`.
3. **Keep** `dashboard/robots/page.tsx` and `dashboard/amadeus/page.tsx` unless the
   investigation shows they also depend on the transaction/A2A subsystem — these look
   like robot-fleet/automation views, which fit the direction this pivot is heading
   toward, not away from. Verify before touching them; don't delete by association
   just because they share a parent folder with the page being removed.
4. Remove any nav links/sidebar entries pointing at the deleted dashboard page.
5. Grep the frontend for any other `TransactionGraph` or transaction-dashboard
   references left dangling after the deletion:
   ```bash
   grep -rln "TransactionGraph\|transaction.*dashboard" microservice/frontend/src --include="*.tsx" --include="*.ts"
   ```

## Step 2 — Backend: remove the dispatch/A2A/stepFlow subsystem

Only the files confirmed isolated in Step 0:

- `orchestrator/executors/dispatchBridge.ts`
- `orchestrator/executors/base.ts` (unless Step 0.3 found a surviving dependent)
- `orchestrator/agents/base.ts` (same caveat)
- `orchestrator/a2a/protocol.ts`, `protocol_v1.ts`, `rpcHandler.ts`, `streamHandler.ts`
- `services/transactions.ts`
- `routes/transactions.ts`
- `config/stepFlows.ts`
- `orchestrator/executors/uipathExecutor.ts`, `padExecutor.ts`,
  `qwenDocExamExecutor.ts` — ONLY those confirmed in Step 0.3 to have no surviving
  caller outside the removed dispatch path. If Danantara or any kept agent turns out
  to route through `uipathExecutor.ts` specifically (as opposed to calling
  `trigger_uipath_job` etc. directly as an MCP tool), that file must be kept and
  re-pointed, not deleted — re-verify this explicitly, don't assume from the name
  alone.

Remove the route registration for `routes/transactions.ts` from wherever routes get
mounted (`server.ts` or similar) so the app doesn't fail to start on a missing import.

## Step 3 — `types/domain.ts`

Remove `Transaction` and `TransactionEvent` interfaces ONLY after confirming (via
grep across the whole `amadeus-core/src`, not just the files listed above) that
nothing outside the removed subsystem imports them:

```bash
grep -rln "Transaction\b\|TransactionEvent" microservice/amadeus-core/src --include="*.ts" | grep -v node_modules
```

Review every remaining hit individually — don't bulk-delete the type and let the
TypeScript compiler "find" the breakage; check first, since a compile error after
mass deletion makes it hard to tell which breakage is expected (fine to fix by
removing the caller too) versus unexpected (a sign Step 0's isolation assumption was
wrong somewhere).

## Step 4 — Database: archive, do not drop

This is a bank. Historical transaction records may carry audit/compliance retention
obligations even after the feature sunsets in the application. **Do not `DROP TABLE`
anything in this step.**

1. Identify the actual tables backing `Transaction`/`TransactionEvent` (check
   `services/transactions.ts`'s queries and the `fn_complete_step`/`fn_fail_step` DB
   functions referenced there for the real table names).
2. Stop the application from writing to them (a natural side effect of removing the
   code paths above) — but leave the tables and their existing data in place.
3. If a rename makes the sunset state clearer for anyone looking at the schema later,
   rename (not drop) — e.g. `transactions` → `transactions_archived_2026`. Confirm
   this with Jandy before doing even that, since it's still a schema change with
   downstream implications (any BI/reporting tooling pointed at the old name would
   break) — flag it as a question rather than doing it unprompted.
4. Do NOT touch `fn_complete_step`/`fn_fail_step` DB functions in this PR beyond
   confirming the application no longer calls them — dropping DB functions is a
   separate, lower-priority cleanup that can happen later once it's clear nothing
   references them anymore.

## Acceptance criteria

- [ ] Step 0's audit findings are reported explicitly (imports found or not found)
      before any deletion happened — this should be visible in the PR description,
      not just implied by the diff.
- [ ] `npm run build` (or equivalent) succeeds on both `amadeus-core` and `frontend`
      after all deletions — no dangling imports.
- [ ] Danantara CX100's full loop (trigger → wait → verify → survey) still works
      end-to-end after this change — this is the regression test that actually
      matters, since it's the concrete proof the automation-agent path was untouched.
- [ ] `dashboard/robots` and `dashboard/amadeus` pages still load and function
      normally.
- [ ] No `DROP TABLE` or `DROP FUNCTION` statements anywhere in this PR's migrations.
- [ ] Any executor (`uipathExecutor.ts`, `padExecutor.ts`, `qwenDocExamExecutor.ts`)
      that's deleted has a documented reason (confirmed no surviving caller) in the
      PR description, not just silently removed.

## Non-goals

- Do NOT drop or truncate any database table in this PR — archiving/renaming only,
  and only after explicit confirmation, per Step 4.
- Do NOT delete `dashboard/robots` or `dashboard/amadeus` without first confirming
  independently (not by assumption) that they don't depend on the removed subsystem.
- Do NOT proceed past Step 0 if the audit finds engine.ts's agent path actually
  imports something from the transaction/dispatch subsystem — decouple first, delete
  second, never the other order.
- Do NOT treat this as a green light to also remove SWIFT-related UI copy/labels
  elsewhere in the app in this same PR — that was already scoped as a separate,
  lower-risk item in earlier planning (rename to "Trade Service Branching"). Keep
  this PR focused on the transaction-dispatch subsystem specifically.
