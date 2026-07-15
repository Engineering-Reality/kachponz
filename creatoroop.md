# Prompt #12 — Amadeus: Generalize Loop Mode into Agent Creator

## Context — read this before touching anything

1. `microservice/amadeus-core/src/orchestrator/recipes/` (Prompt 09/10) — the existing
   Recipe Executor: typed state (`RecipeRunState`), a deterministic `executeStep`, a
   bounded LLM decision point (`classifyFault`), and `pollJobToTerminal` (Prompt 10's
   fix). This prompt generalizes that machinery — it does NOT replace it. The
   `danantaraSurveyLoopRecipe` concrete definition stays exactly as-is, just becomes
   one instance of a now-generic shape instead of the only possible one.
2. `microservice/frontend/src/app/(protected)/agent-creator/page.tsx` — where agents
   get created/configured today.
3. Legacy Python `agent_creator/models.py`'s `Tool` model (`tool_id`, `name`,
   `input_schema`, `output_schema`, `versions`) — useful as a reference shape for
   "what does the system already know about a tool an agent has," even though this
   prompt is TypeScript-only. The legacy Python agent_creator does NOT have a
   loop/flow concept to port — it's autofill for agent config fields, a separate
   concern from what's being built here. Don't go looking for a loop pattern there;
   there isn't one.
4. `microservice/agent_backend` — CRUD for agents; this is where a new recipe
   association needs to be persisted.

## Why generalize now, and how far to take it

Prompt 09 deliberately scoped Loop Mode to one concrete recipe
(`danantara_survey_loop`) and explicitly said not to build a generic recipe language
in that PR — that was the right call at the time, to prove the core mechanism first
(no job-ID hallucination, no wrong releaseKey, no MCP-timeout dead-ends) against one
real, painful case before investing in generalization.

That mechanism is now proven. Generalizing it is the right next step, but the target
for THIS prompt is still bounded: **a step-chain builder scoped to whatever tools are
already attached to an agent**, editable as a structured form (not a visual
drag-and-drop canvas — that's real future work, not this PR), backed by the same
deterministic executor. Don't build a universal workflow language that tries to
anticipate every possible automation pattern — build the generalization that the
Danantara case actually needs generalized, and no further.

## Step 1 — Generalize the Recipe schema to be tool-agnostic

The current `RecipeStepDef` (Prompt 09) has UiPath-specific fields baked in
(`releaseName`, `variantParam`, `waitTimeoutSeconds` implying `wait_for_uipath_job`
semantics). Generalize to:

```ts
export interface RecipeStepDef {
  id: string;
  label: string;                         // human-readable, shown in the UI — e.g. "Get disposable email"
  toolName: string;                      // the MCP tool to call, e.g. "trigger_uipath_job" — must be
                                          // one of the tools already attached to this agent
  argsTemplate: Record<string, unknown>; // args to pass, with {{variant}}, {{prevStepOutput.X}}
                                          // style placeholders resolved at run time — keep this
                                          // templating minimal, don't build a full expression
                                          // language; string substitution on a few known
                                          // placeholder patterns is enough for the Danantara case
                                          // and probably the next few cases after it
  variantCount?: number;                 // if set, this step rotates across N resolved variants
                                          // on fault (generalizes _1/_2/_3), same semantics as
                                          // Prompt 09's variantParam but tool-agnostic
  pollFor?: {                            // optional — if this step's tool call kicks off an
    toolName: string;                    // async job elsewhere, poll a status tool until terminal.
    argsTemplate: Record<string, unknown>; // Generalizes Prompt 10's pollJobToTerminal — same
    terminalField: string;               // mechanism, config-driven instead of UiPath-hardcoded.
    terminalValues: string[];
    timeoutSeconds: number;
    pollIntervalSeconds: number;
  };
  verify?: {                             // optional post-step check, generalizes Prompt 09's
    toolName: string;                    // verifyAsset — call a tool, check a field is non-empty
    argsTemplate: Record<string, unknown>;
    checkField: string;
    mustBeNonEmpty: boolean;
  };
  onFault: "rotate_variant" | "abort_iteration" | "abort_recipe";
}

export interface RecipeDef {
  id: string;
  agentId: string;                       // NEW — ties a recipe to the agent that owns it,
                                          // replacing the old implicit single-recipe assumption
  label: string;
  steps: RecipeStepDef[];
  iterations: number;
  maxConcurrentJobs: 1;                  // still hardcoded — this was an environment fact for
                                          // UiPath, not a recipe-level choice; revisit only if a
                                          // future tool has a genuinely different concurrency model
}
```

Port `danantaraSurveyLoopRecipe` to this new shape as the first concrete instance —
this is also the acceptance test for whether the generalization actually covers the
real case it's generalizing from. If porting it forces awkward compromises, that's a
sign the schema needs adjustment before moving on, not something to push through.

## Step 2 — Persist recipes per-agent

Add a table (or a JSON column on the existing `agents` table, whichever fits
`agent_backend`'s existing schema conventions better — check what's already there
before deciding) to store zero-or-one `RecipeDef` per agent. Not every agent needs a
recipe — an agent created for ad-hoc conversational use simply has none, and its
`/agent-invoke` behavior is completely unchanged.

```sql
-- illustrative — match actual agent_backend schema conventions
create table agent_recipes (
  agent_id uuid primary key references agents(id),
  recipe jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## Step 3 — Agent Creator UI: a structured step editor, not a canvas

In `agent-creator/page.tsx`, add an optional "Loop Mode" section, only enabled once
at least one tool is attached to the agent being created/edited:

- A list of steps, each backed by a form: pick `toolName` from the agent's attached
  tools (reuse whatever tool-picker component already exists for tool attachment),
  fill `argsTemplate` fields based on that tool's `input_schema` (this is where the
  legacy Python `Tool.input_schema` shape is a useful reference for what metadata
  should already be available per tool — reuse the equivalent TS shape from wherever
  `amadeus-core`/`agent_backend` already stores tool schemas, don't invent a new one).
  - A raw JSON textarea is an acceptable fallback for `argsTemplate` if a fully
    schema-driven form is too much scope for this PR — ship the simpler version
    first, upgrade to schema-driven inputs later if it proves worth the investment.
- Toggle per step: "wait for async completion" (fills `pollFor`, prompting for which
  status-check tool and terminal field/values) and "verify after completion" (fills
  `verify`).
- A field for `iterations` (default 1).
- Save persists the `RecipeDef` via Step 2's storage, associated with the agent being
  edited.

This is explicitly a form, not a node-graph canvas. A canvas is a much bigger,
separate investment (dragging/connecting nodes, layout, etc.) — don't attempt it here.

## Step 4 — Generalize the execution endpoint

Replace Prompt 09's hardcoded `/orchestrator/recipes/danantara_survey_loop/run` with:

```
POST /orchestrator/agents/:agentId/recipe/run
Body: { iterations?: number }  // overrides the recipe's stored default if provided
```

Handler: load the agent's `RecipeDef` from Step 2's storage (404 if none exists — not
every agent has one), run it through the same `executeStep`/`pollJobToTerminal`
machinery from Prompt 09/10 (now operating on the generalized `RecipeStepDef` shape),
stream `RecipeRunState` over SSE exactly as before.

## Step 5 — Frontend: Loop Mode toggle becomes agent-driven, not Danantara-specific

On `/agent-invoke`, the "Loop Mode" toggle (from Prompt 09) should only appear when
the currently-selected agent has a stored recipe (check via a lightweight `GET
/orchestrator/agents/:agentId/recipe` call, 404 = no toggle shown). This makes Loop
Mode a property of whichever agent has one configured, not a Danantara-only UI
special-case.

## Acceptance criteria

- [ ] `danantaraSurveyLoopRecipe` successfully re-expressed in the new generalized
      `RecipeStepDef`/`RecipeDef` shape, and a live run against it behaves identically
      to Prompt 09/10's behavior (same job-ID correctness, same polling behavior, same
      fault-rotation logic) — this is the regression test for the generalization.
- [ ] A second, genuinely different recipe (pick a simple one — even a 2-step,
      1-iteration test recipe using a different tool entirely) can be created through
      the Agent Creator UI without any code changes, proving the generalization
      actually generalizes and isn't secretly still UiPath-shaped underneath.
- [ ] An agent with no recipe configured shows no "Loop Mode" toggle on
      `/agent-invoke` and behaves exactly as it does today.
- [ ] `POST /orchestrator/agents/:agentId/recipe/run` returns 404 cleanly for an
      agent with no recipe, rather than erroring unhelpfully.
- [ ] The `classifyFault` LLM decision point (Prompt 09) still receives only the fault
      string, nothing tool-specific or agent-specific baked into its prompt — it stays
      generic across every recipe, not just Danantara's.

## Non-goals

- Do NOT build a visual node/canvas editor in this PR — the structured form (Step 3)
  is the whole UI scope. A canvas is real future work, flagged, not attempted here.
- Do NOT build a general-purpose expression/templating language for `argsTemplate` —
  simple placeholder substitution (`{{variant}}`, `{{prevStepOutput.field}}`) is
  enough; anything fancier (conditionals, loops-within-steps, arithmetic) is out of
  scope until a real recipe actually needs it.
- Do NOT let a recipe span multiple agents or call another agent as a step — a
  recipe belongs to exactly one agent and only calls that agent's own attached tools.
  Cross-agent orchestration is a different, bigger feature.
- Do NOT remove or rename the `danantara_survey_loop` recipe's `id` or behavior as
  experienced by an end user — this is a refactor of the underlying mechanism, the
  Danantara CX100 agent's actual loop behavior should be unchanged from the outside.
