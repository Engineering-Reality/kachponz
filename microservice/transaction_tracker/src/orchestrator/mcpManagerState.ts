/**
 * In-memory status of the mcpAutoManager child process, set by server.ts
 * (which spawns it) and read by the /orchestrator/mcp/manager-status route.
 * Exists so a startup crash (e.g. a broken import) surfaces immediately via
 * an endpoint/banner instead of only showing up later as a generic
 * "fetch failed" on the first tool call.
 */
interface McpManagerState {
  running: boolean;
  crashedEarly: boolean;
  lastError: string | null;
}

const state: McpManagerState = {
  running: false,
  crashedEarly: false,
  lastError: null,
};

export function getMcpManagerState(): McpManagerState {
  return { ...state };
}

export function setMcpManagerRunning(): void {
  state.running = true;
  state.crashedEarly = false;
  state.lastError = null;
}

export function setMcpManagerCrashed(error: string, early: boolean): void {
  state.running = false;
  state.crashedEarly = early;
  state.lastError = error;
}
