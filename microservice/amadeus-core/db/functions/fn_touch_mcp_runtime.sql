-- Called by engine.ts right before opening an SSE connection to an 'sse'
-- MCP tool. Marks the tool as recently used so mcpAutoManager.ts's
-- idle-timeout sweep (MCP_IDLE_TIMEOUT_MS) doesn't stop it out from under an
-- active caller, and — for a tool that was previously idle-stopped — signals
-- the next sync tick (<=10s later) that it's wanted again and should respawn.
CREATE OR REPLACE FUNCTION fn_touch_mcp_runtime(p_tool_id UUID) RETURNS VOID LANGUAGE sql AS $$
  UPDATE mcp_runtime_state SET last_used_at = now() WHERE tool_id = p_tool_id;
$$;
