/**
 * The single `sleep` primitive for the whole codebase.
 *
 * Previously re-declared verbatim in src/lib/uipathAuth.ts and
 * scripts/e2e-demo.ts. A timing primitive has exactly one correct shape, so it
 * lives here and every caller imports it — no more drifting copies.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
