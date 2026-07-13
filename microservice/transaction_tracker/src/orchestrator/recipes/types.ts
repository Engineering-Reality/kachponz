/**
 * Recipe Executor schema — a small state machine, in code, for running the
 * disposable-email/login/OTP/survey loop deterministically. See loop.md for
 * the full rationale: this exists to make job IDs and releaseKeys code-owned
 * data instead of something the LLM has to remember and re-type across many
 * tool calls, which is what caused the two class-level bugs this replaces.
 */

export interface RecipeStepDef {
  id: string; // e.g. "get_disposable_email"
  releaseName: string; // human name, e.g. "Get_DisposableEmail" — the
  // executor resolves the actual variant + GUID, the LLM/config never
  // hardcodes a GUID.
  variantParam?: 'email' | 'otp'; // which rotation counter this step reads, if any
  waitTimeoutSeconds: number;
  onFault: 'rotate_variant' | 'abort_iteration' | 'abort_recipe';
  verifyAsset?: { assetName: string; mustBeNonEmpty: boolean };
}

export interface RecipeDef {
  id: string; // e.g. "danantara_survey_loop"
  folderId: string;
  maxVariants: number; // upper bound to probe for during resolution — the
  // real ceiling is whatever list_uipath_processes actually returns (Step 2),
  // never trusted as a hardcoded fact on its own.
  steps: RecipeStepDef[];
  iterations: number; // overridden by the run request's `iterations` param
  maxConcurrentJobs: 1; // hard invariant, matches the UiPath robot's real
  // concurrency limit — not configurable per recipe, this is an environment fact.
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
  toolId: string;
  folderId: string;
  currentIteration: number;
  currentStepIndex: number;
  currentVariant: number; // 1, 2, or 3 — which _N is active right now
  resolvedReleaseKeys: Record<string, string>; // releaseName(+variant) -> real
  // GUID, resolved ONCE via list_uipath_processes and reused — never re-typed.
  activeJobId: string | null; // the ONE job allowed to be Pending/Running,
  // per the concurrency invariant — code-owned, never derived from LLM text.
  iterationResults: RecipeIterationResult[];
  status: 'running' | 'completed' | 'failed' | 'awaiting_llm_decision';
  error?: string;
}

export type StepOutcome =
  | { outcome: 'success'; detail: string; jobId?: string }
  | { outcome: 'fault'; detail: string; jobId?: string }
  | { outcome: 'timeout'; detail: string; jobId?: string };
