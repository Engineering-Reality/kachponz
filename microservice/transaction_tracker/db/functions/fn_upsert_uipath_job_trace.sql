-- Atomic upsert for uipath_job_trace, called from engine.ts's loadMcpTools() closure
-- after a trigger_uipath_job/get_uipath_job_status tool call, and from the background
-- poller in scripts/mcpAutoManager.ts. ON CONFLICT (job_id) means repeated status
-- polls update the same row instead of creating duplicates. COALESCE on the
-- identity-ish columns (process_name, queue_name) lets the poller's NULL-heavy calls
-- (it doesn't know agent_id/tool_id/process_name) avoid clobbering what the original
-- trigger call already recorded. started_at/ended_at only ever move forward, once.
CREATE OR REPLACE FUNCTION fn_upsert_uipath_job_trace(
  p_agent_id      UUID,
  p_tool_id       UUID,
  p_session_label VARCHAR,
  p_job_id        VARCHAR,
  p_job_key       VARCHAR,
  p_release_key   VARCHAR,
  p_process_name  VARCHAR,
  p_folder_id     VARCHAR,
  p_queue_name    VARCHAR,
  p_state         VARCHAR,
  p_info          TEXT
)
RETURNS uipath_job_trace
LANGUAGE sql
AS $$
  INSERT INTO uipath_job_trace (
    agent_id, tool_id, session_label, job_id, job_key, release_key,
    process_name, folder_id, queue_name, state, info, triggered_at, last_polled_at,
    started_at, ended_at
  )
  VALUES (
    p_agent_id, p_tool_id, p_session_label, p_job_id, p_job_key, p_release_key,
    p_process_name, p_folder_id, p_queue_name, p_state, p_info, now(), now(),
    -- A row's very first write can already report Running/Successful/etc. (e.g.
    -- get_uipath_job_status called with no prior trigger_uipath_job row for
    -- this job_id) — these must be seeded here too, not just in ON CONFLICT,
    -- or such a job would never get a started_at/ended_at at all.
    CASE WHEN p_state = 'Running' THEN now() END,
    CASE WHEN p_state IN ('Successful','Faulted','Stopped') THEN now() END
  )
  ON CONFLICT (job_id) DO UPDATE SET
    state          = EXCLUDED.state,
    info           = COALESCE(EXCLUDED.info, uipath_job_trace.info),
    last_polled_at = now(),
    started_at     = COALESCE(uipath_job_trace.started_at,
                               CASE WHEN EXCLUDED.state = 'Running' THEN now() END),
    ended_at       = CASE WHEN EXCLUDED.state IN ('Successful','Faulted','Stopped')
                          THEN now() ELSE uipath_job_trace.ended_at END,
    process_name   = COALESCE(uipath_job_trace.process_name, EXCLUDED.process_name),
    queue_name     = COALESCE(uipath_job_trace.queue_name, EXCLUDED.queue_name),
    agent_id       = COALESCE(uipath_job_trace.agent_id, EXCLUDED.agent_id),
    tool_id        = COALESCE(uipath_job_trace.tool_id, EXCLUDED.tool_id),
    session_label  = COALESCE(uipath_job_trace.session_label, EXCLUDED.session_label),
    job_key        = COALESCE(uipath_job_trace.job_key, EXCLUDED.job_key),
    release_key    = COALESCE(uipath_job_trace.release_key, EXCLUDED.release_key),
    folder_id      = COALESCE(uipath_job_trace.folder_id, EXCLUDED.folder_id)
  RETURNING *;
$$;
