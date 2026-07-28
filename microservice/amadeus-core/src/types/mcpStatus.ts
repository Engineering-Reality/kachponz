// ─── MCP runtime status vocabulary — SINGLE SOURCE OF TRUTH ────────────────
//
// This file is canonical. The frontend keeps a HAND-SYNCED copy at:
//     microservice/frontend/src/lib/mcpStatus.ts
// Nobody edits the FE copy directly — change this file, then mirror the array
// into the FE copy. A drift guard (test/mcpStatusContract.test.ts) fails
// loudly if the two ever diverge.
//
// Why a copy and not a shared import: the two packages are fully independent
// (no root package.json, no pnpm-workspace/turbo/nx; the FE Next build pins
// its Turbopack root to its own dir specifically to avoid resolving files
// outside the package). Introducing monorepo tooling for six string values
// that change ~once a year isn't worth it. Revisit that decision only when a
// SECOND contract needs to cross the BE/FE boundary (e.g. AmlVerdict) — that
// is the trigger for workspace tooling, not this one.

export const MCP_STATUSES = [
  'running', // process alive AND port verified listening (sse only)
  'starting', // spawned, port not yet proven listening
  'stopped', // intentionally stopped (manual restart, idle-stop, or obsolete)
  'crashed', // exited without being asked to; last_error is set
  'on-demand', // stdio tool — no persistent process, spawned per call
  'unknown', // no data yet, or a reading older than the staleness threshold
] as const;

export type McpStatus = (typeof MCP_STATUSES)[number];

export const MCP_METHODS = ['stdio', 'sse'] as const;
export type McpMethod = (typeof MCP_METHODS)[number];

/**
 * Narrow any raw string (a DB value, a wire value from the API) to a known
 * McpStatus, falling back to 'unknown' for anything unrecognised. Consumers
 * MUST route unknown values through here rather than assuming the union is
 * exhaustive — that is what makes a BE/FE drift a cosmetic one-release bug
 * instead of a crash or a mislabelled-as-running tool.
 */
export function toMcpStatus(value: string | null | undefined): McpStatus {
  return (MCP_STATUSES as readonly string[]).includes(value as string)
    ? (value as McpStatus)
    : 'unknown';
}
