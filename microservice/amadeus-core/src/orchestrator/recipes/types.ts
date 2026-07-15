/**
 * Recipe Executor schema — a small state machine, in code, for running any
 * trigger->wait->verify MCP tool chain deterministically, per-agent. See
 * loop.md/creatoroop.md for the full rationale: job IDs, release keys, and
 * any other machine-readable identifier stay code-owned data, resolved once
 * from a tool's `_meta`, never re-typed by an LLM across many tool calls.
 *
 * This schema is tool-agnostic: a `RecipeDef` only knows MCP tool names and
 * JSON args, never a specific integration's field shapes. The one exception
 * is `RecipeResolverDef`, which generalizes "resolve a human-readable name to
 * a real ID via a one-time list call" — needed because some tools (e.g.
 * UiPath's trigger_uipath_job) hard-require a resolved ID and reject a name.
 */

export interface RecipeResolverDef {
  id: string; // referenced by RecipeStepDef.resolve.resolverId
  toolName: string; // a "list" style MCP tool, called ONCE at run start,
  // before any iteration — never re-called mid-run.
  argsTemplate: Record<string, unknown>; // static args only — no placeholder
  // substitution here, this runs before `currentVariant`/`lastStepOutput` exist.
  extract:
    | { kind: 'text_lines'; itemPattern: string; nameGroup: number; valueGroup: number }
    // Applies `itemPattern` (a RegExp source, flags 'gm') over the tool
    // result's joined `content` text — generalizes the old
    // parseProcessListText hack for tools with no structured list response.
    | { kind: 'meta_array'; metaField: string; nameField: string; valueField: string };
  // For a tool that already returns structured data: reads
  // `_meta[metaField]` as an array of `{ [nameField]: ..., [valueField]: ... }`.
}

export interface RecipeStepDef {
  id: string; // e.g. "get_disposable_email"
  label: string; // human-readable, shown in the UI
  toolName: string; // the MCP tool to call — must be exposed by one of this
  // agent's attached tools, checked once at run start (Step 2 in creatoroop.md).
  argsTemplate: Record<string, unknown>; // args passed to `toolName`, with
  // {{variant}}, {{prevStepOutput.field}}, {{resolved}} placeholders resolved
  // at run time — deliberately minimal string substitution, not an expression
  // language.
  variantCount?: number; // if set, this step rotates across N variants on
  // fault — generalizes the old variantParam/maxVariants, tool-agnostic.
  resolve?: {
    // Optional: this step's {{resolved}} placeholder comes from a resolver's
    // name->value map, looked up by a name built from `nameTemplate` (which
    // may itself contain {{variant}}).
    resolverId: string;
    nameTemplate: string;
  };
  pollFor?: {
    // Optional — if this step's tool call kicks off an async job elsewhere,
    // poll a status tool until terminal. Generalizes pollJobToTerminal:
    // same mechanism (own setTimeout loop, never one long-lived MCP call,
    // to avoid the MCP transport's request timeout), config-driven.
    toolName: string;
    argsTemplate: Record<string, unknown>;
    terminalField: string;
    terminalValues: string[];
    successValues?: string[]; // subset of terminalValues that means success;
    // if omitted, every terminal value counts as success (a step with no
    // verify block and only one terminal value has nothing else to check).
    timeoutSeconds: number;
    pollIntervalSeconds: number;
  };
  verify?: {
    // Optional post-step check — call a tool, check a field is non-empty.
    toolName: string;
    argsTemplate: Record<string, unknown>;
    checkField: string;
    mustBeNonEmpty: boolean;
  };
  onFault: 'rotate_variant' | 'abort_iteration' | 'abort_recipe';
}

export interface RecipeDef {
  id: string; // e.g. "danantara_survey_loop" — stable across the schema
  // generalization, never renamed just because the underlying shape changed.
  agentId: string; // ties this recipe to the agent that owns it — a recipe
  // belongs to exactly one agent and only calls that agent's own tools.
  label: string;
  steps: RecipeStepDef[];
  iterations: number;
  maxConcurrentJobs: 1; // still hardcoded — an environment fact about how
  // many jobs an attached tool's backing system can run at once, not a
  // recipe-level choice; revisit only if a future tool has a genuinely
  // different concurrency model.
  resolvers?: RecipeResolverDef[]; // name->value resolution passes, run once
  // at recipe start, before the first iteration. Absent entirely for a
  // recipe whose tools take human-readable names/args directly.
}

export interface RecipeIterationResult {
  iteration: number;
  status: 'success' | 'failed' | 'aborted';
  detail: string;
}

export interface RecipeRunState {
  recipeId: string;
  runId: string; // generated at start, used for all logging/SSE
  agentId: string;
  currentIteration: number;
  currentStepIndex: number;
  currentVariant: number; // which rotation is active right now, 1-based
  resolved: Record<string, Record<string, string>>; // resolverId -> name ->
  // value, resolved ONCE via each resolver's tool call and reused — never
  // re-typed.
  activeStepId: string | null; // the ONE step allowed to have an in-flight
  // pollFor loop right now, per the concurrency invariant — code-owned,
  // generalizes the old activeJobId re-entrancy guard.
  lastStepOutput: Record<string, unknown>; // merged _meta from the most
  // recently completed tool call (trigger/poll/verify) — the source for
  // {{prevStepOutput.field}} placeholders, and what the UI shows in place of
  // a single hardcoded "active job" field.
  iterationResults: RecipeIterationResult[];
  status: 'running' | 'completed' | 'failed' | 'awaiting_llm_decision';
  error?: string;
}

export type StepOutcome =
  | { outcome: 'success'; detail: string }
  | { outcome: 'fault'; detail: string }
  | { outcome: 'timeout'; detail: string };
