-- Replaces scripts/mcpAutoManager.ts's markStopped(toolIds): bulk-mark several tools
-- 'stopped' in one statement (used when a sync tick finds tools no longer expected to run).
CREATE OR REPLACE FUNCTION fn_release_mcp_runtime(
  p_tool_ids UUID[]
) RETURNS SETOF mcp_runtime_state LANGUAGE sql AS $$
  UPDATE mcp_runtime_state
     SET status = 'stopped', pid = NULL, updated_at = now()
   WHERE tool_id = ANY(p_tool_ids)
  RETURNING *;
$$;
