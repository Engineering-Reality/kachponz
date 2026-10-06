/**
 * tests/transitions.test.ts
 *
 * Unit tests for the state machine logic in stepFlows.ts.
 * These are pure function tests — no DB, no network.
 */
import { describe, it, expect } from "vitest";
import {
  validateTransition,
  getInitialStep,
  isFinalStep,
  STEP_FLOWS,
} from "../src/config/stepFlows.js";

describe("getInitialStep", () => {
  it("returns 'submitted' for import_lc", () => {
    expect(getInitialStep("import_lc")).toBe("submitted");
  });

  it("returns 'submitted' for skbdn", () => {
    expect(getInitialStep("skbdn")).toBe("submitted");
  });
});

describe("isFinalStep", () => {
  it("returns true for the last step of import_lc", () => {
    expect(isFinalStep("import_lc", "advised")).toBe(true);
  });

  it("returns false for a middle step", () => {
    expect(isFinalStep("import_lc", "doc_examined")).toBe(false);
  });
});

describe("validateTransition — forward (happy path)", () => {
  const flow = STEP_FLOWS.import_lc;

  it("allows each consecutive forward step", () => {
    for (let i = 0; i < flow.length - 1; i++) {
      const result = validateTransition("import_lc", flow[i], flow[i + 1]);
      expect(result.ok).toBe(true);
    }
  });

  it("allows first forward step: submitted → distributed_to_analyst", () => {
    const result = validateTransition("import_lc", "submitted", "distributed_to_analyst");
    expect(result.ok).toBe(true);
  });
});

describe("validateTransition — skipping steps (forbidden)", () => {
  it("rejects skipping one step forward", () => {
    const result = validateTransition("import_lc", "submitted", "doc_examined");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STEP_SKIP_FORBIDDEN");
    }
  });

  it("rejects jumping to a distant step", () => {
    const result = validateTransition("import_lc", "submitted", "swift_released");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("STEP_SKIP_FORBIDDEN");
    }
  });
});

describe("validateTransition — same step", () => {
  it("rejects transitioning to the current step", () => {
    const result = validateTransition("import_lc", "doc_examined", "doc_examined");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SAME_STEP");
    }
  });
});

describe("validateTransition — backward / rewind", () => {
  it("rejects rewind without reason", () => {
    const result = validateTransition(
      "import_lc",
      "doc_examined",
      "submitted",
      undefined
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REWIND_REQUIRES_REASON");
    }
  });

  it("rejects rewind with empty string reason", () => {
    const result = validateTransition(
      "import_lc",
      "doc_examined",
      "submitted",
      "  "
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REWIND_REQUIRES_REASON");
    }
  });

  it("allows rewind with a non-empty reason", () => {
    const result = validateTransition(
      "import_lc",
      "doc_examined",
      "submitted",
      "Documents incomplete, returning to submission stage"
    );
    expect(result.ok).toBe(true);
  });

  it("allows rewind to immediately preceding step with reason", () => {
    const result = validateTransition(
      "import_lc",
      "ee_ntf_created",
      "doc_examined",
      "Notifikasi EE dibatalkan oleh supervisor"
    );
    expect(result.ok).toBe(true);
  });
});

describe("validateTransition — invalid step names", () => {
  it("rejects unknown current step", () => {
    const result = validateTransition("import_lc", "nonexistent_step", "submitted");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CURRENT_STEP");
    }
  });

  it("rejects unknown target step", () => {
    const result = validateTransition("import_lc", "submitted", "nonexistent_step");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_TARGET_STEP");
    }
  });
});

describe("validateTransition — full import_lc happy-path sequence", () => {
  it("validates the entire import_lc flow step-by-step", () => {
    const flow = [...STEP_FLOWS.import_lc];
    for (let i = 0; i < flow.length - 1; i++) {
      const result = validateTransition("import_lc", flow[i], flow[i + 1]);
      expect(result.ok, `Expected ${flow[i]} → ${flow[i + 1]} to be valid`).toBe(true);
    }
  });
});

describe("validateTransition — skbdn flow", () => {
  const flow = [...STEP_FLOWS.skbdn];

  it("validates the entire skbdn flow step-by-step", () => {
    for (let i = 0; i < flow.length - 1; i++) {
      const result = validateTransition("skbdn", flow[i], flow[i + 1]);
      expect(result.ok).toBe(true);
    }
  });
});
