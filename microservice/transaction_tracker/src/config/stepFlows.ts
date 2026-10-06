/**
 * stepFlows.ts — Data-driven state machine graph.
 *
 * ALL step transition logic lives here — never hardcoded in routes
 * or tests. Adding a new transaction type means adding one entry
 * to STEP_FLOWS below, nothing else.
 *
 * Design:
 *   - Each transaction type maps to an ordered array of steps.
 *   - The array order IS the canonical sequence.
 *   - Forward transitions: index of nextStep = index of currentStep + 1.
 *   - Backward transitions: allowed but require an explicit `reason`.
 *   - Skipping steps (index gap > 1) is never allowed.
 */

export type TransactionType = "import_lc" | "skbdn" | "sblc";

/**
 * Canonical step sequences per transaction type.
 * Index 0 is the initial step (used when creating a transaction).
 */
export const STEP_FLOWS: Record<TransactionType, readonly string[]> = {
  import_lc: [
    "submitted",
    "distributed_to_analyst",
    "doc_examined",
    "ee_ntf_created",
    "ee_ntf_approved",
    "mt_converted",
    "swift_released",
    "settled",
    "advised",
  ],

  // SKBDN (Surat Kredit Berdokumen Dalam Negeri) — domestic equivalent
  skbdn: [
    "submitted",
    "distributed_to_analyst",
    "doc_examined",
    "ee_ntf_created",
    "ee_ntf_approved",
    "swift_released",
    "settled",
    "advised",
  ],

  // SBLC (Standby Letter of Credit)
  sblc: [
    "submitted",
    "distributed_to_analyst",
    "doc_examined",
    "claim_evaluated",
    "claim_approved",
    "swift_released",
    "settled",
    "advised",
  ],
} as const;

export const SUPPORTED_TYPES = Object.keys(STEP_FLOWS) as TransactionType[];

/** Get the initial step for a transaction type */
export function getInitialStep(type: TransactionType): string {
  return STEP_FLOWS[type][0];
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; reason: string; code: string };

/**
 * Validate whether a step transition is allowed.
 *
 * Rules:
 *  1. Both currentStep and targetStep must be valid steps for the type.
 *  2. targetStep must be exactly ONE step ahead (forward transition).
 *  3. targetStep may be any earlier step IF reason is provided (rewind).
 *  4. Skipping steps forward is never allowed.
 *  5. Transitioning to the same step is not allowed.
 */
export function validateTransition(
  type: TransactionType,
  currentStep: string,
  targetStep: string,
  reason?: string | null
): TransitionResult {
  const flow = STEP_FLOWS[type];

  const currentIdx = flow.indexOf(currentStep);
  const targetIdx = flow.indexOf(targetStep);

  if (currentIdx === -1) {
    return {
      ok: false,
      code: "INVALID_CURRENT_STEP",
      reason: `Step '${currentStep}' is not valid for transaction type '${type}'`,
    };
  }

  if (targetIdx === -1) {
    return {
      ok: false,
      code: "INVALID_TARGET_STEP",
      reason: `Step '${targetStep}' is not a recognised step for transaction type '${type}'. Valid steps: ${flow.join(", ")}`,
    };
  }

  if (currentIdx === targetIdx) {
    return {
      ok: false,
      code: "SAME_STEP",
      reason: `Transaction is already at step '${currentStep}'`,
    };
  }

  if (targetIdx === currentIdx + 1) {
    // Normal forward transition — always allowed
    return { ok: true };
  }

  if (targetIdx > currentIdx + 1) {
    return {
      ok: false,
      code: "STEP_SKIP_FORBIDDEN",
      reason: `Cannot skip from '${currentStep}' to '${targetStep}'. Next allowed step is '${flow[currentIdx + 1]}'`,
    };
  }

  // targetIdx < currentIdx — backward / rewind
  if (!reason || reason.trim() === "") {
    return {
      ok: false,
      code: "REWIND_REQUIRES_REASON",
      reason: `Rewinding from '${currentStep}' to '${targetStep}' requires an explicit 'reason' in the request body`,
    };
  }

  return { ok: true };
}

/** Check whether a step is the final step for the given type */
export function isFinalStep(type: TransactionType, step: string): boolean {
  const flow = STEP_FLOWS[type];
  return flow[flow.length - 1] === step;
}
