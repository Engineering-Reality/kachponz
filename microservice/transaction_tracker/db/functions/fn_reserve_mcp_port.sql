-- Replaces scripts/mcpAutoManager.ts's upsertRuntimeState(), which built its INSERT..ON
-- CONFLICT with ternary string interpolation for started_at (`fields.startedAt ? 'now()' : ...`).
-- That was already a single round trip / atomic upsert — this function keeps that
-- property while removing the string-built SQL. p_set_started_at=true means "this is a
-- fresh (re)spawn, stamp started_at=now()"; false preserves the existing started_at
-- (used when only status/pid/last_error change, e.g. crash-detection).
CREATE OR REPLACE FUNCTION fn_reserve_mcp_port(
  p_tool_id         UUID,
  p_method          VARCHAR,
  p_port            INT,
  p_pid             INT,
  p_status          VARCHAR,
  p_last_error      TEXT,
  p_entry_mtime     BIGINT,
  p_set_started_at  BOOLEAN
)
RETURNS mcp_runtime_state
LANGUAGE plpgsql
AS $$
DECLARE
  v_row mcp_runtime_state;
BEGIN
  INSERT INTO mcp_runtime_state (tool_id, method, port, pid, status, last_error, entry_mtime, started_at, updated_at)
  VALUES (
    p_tool_id, p_method, p_port, p_pid, p_status, p_last_error, p_entry_mtime,
    CASE WHEN p_set_started_at THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (tool_id) DO UPDATE SET
    method      = EXCLUDED.method,
    port        = EXCLUDED.port,
    pid         = EXCLUDED.pid,
    status      = EXCLUDED.status,
    last_error  = EXCLUDED.last_error,
    entry_mtime = COALESCE(EXCLUDED.entry_mtime, mcp_runtime_state.entry_mtime),
    started_at  = CASE WHEN p_set_started_at THEN now() ELSE mcp_runtime_state.started_at END,
    updated_at  = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
