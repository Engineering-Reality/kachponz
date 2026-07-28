import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MCP_STATUSES, toMcpStatus } from "../src/types/mcpStatus.js";

// The MCP status vocabulary is deliberately duplicated across two independent
// packages (see the header in src/types/mcpStatus.ts for why there is no
// shared import). This guard is the thing that makes that duplication safe:
// it fails loudly the moment the FE copy drifts from the BE source of truth,
// so a mismatch is caught in review instead of shipping as a mislabelled tool.
//
// Extraction is done on the file TEXT (not by importing the FE module) so this
// test never has to resolve a module from outside the amadeus-core package.

const HERE = dirname(fileURLToPath(import.meta.url));
const BE_PATH = join(HERE, "../src/types/mcpStatus.ts");
const FE_PATH = join(HERE, "../../frontend/src/lib/mcpStatus.ts");

function extractStatuses(filePath: string): string[] {
  const src = readFileSync(filePath, "utf8");
  const block = src.match(/MCP_STATUSES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block || block[1] === undefined) {
    throw new Error(`Could not locate the MCP_STATUSES array in ${filePath}`);
  }
  return [...block[1].matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1]!);
}

describe("mcpStatus BE/FE contract", () => {
  it("FE copy's status values are identical (and in order) to the BE source of truth", () => {
    const be = extractStatuses(BE_PATH);
    const fe = extractStatuses(FE_PATH);
    expect(
      fe,
      `MCP status vocabulary DRIFT.\n` +
        `  source of truth: ${BE_PATH}\n` +
        `  drifted copy:    ${FE_PATH}\n` +
        `Re-sync the FE copy's MCP_STATUSES array by hand to match the BE file.`,
    ).toEqual(be);
  });

  it("the BE runtime array matches its own file text (source-of-truth sanity)", () => {
    expect([...MCP_STATUSES]).toEqual(extractStatuses(BE_PATH));
  });

  it("toMcpStatus() falls back to 'unknown' so drift can never crash or mislabel", () => {
    expect(toMcpStatus("running")).toBe("running");
    expect(toMcpStatus("on-demand")).toBe("on-demand");
    expect(toMcpStatus("a-status-only-the-frontend-knows")).toBe("unknown");
    expect(toMcpStatus(null)).toBe("unknown");
    expect(toMcpStatus(undefined)).toBe("unknown");
  });
});
