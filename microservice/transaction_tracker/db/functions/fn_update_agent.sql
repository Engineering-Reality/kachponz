-- Replaces the dynamic `UPDATE agents SET ${fields.join(', ')}` string-building in
-- routes/agents.ts's PUT handler. NULL means "field not supplied" (COALESCE keeps the
-- existing value) — tools/share_editor_with can still be set to an explicit empty
-- array, which is distinct from NULL. No agent_tools join table exists yet, so `tools`
-- stays a plain column here; revisit if that refactor lands.
CREATE OR REPLACE FUNCTION fn_update_agent(
  p_agent_id           UUID,
  p_agent_name         TEXT    DEFAULT NULL,
  p_description        TEXT    DEFAULT NULL,
  p_agent_style        TEXT    DEFAULT NULL,
  p_on_status          BOOLEAN DEFAULT NULL,
  p_tools              TEXT[]  DEFAULT NULL,
  p_share_editor_with  TEXT[]  DEFAULT NULL
)
RETURNS SETOF agents
LANGUAGE sql
AS $$
  UPDATE agents SET
    agent_name        = COALESCE(p_agent_name, agent_name),
    description       = COALESCE(p_description, description),
    agent_style       = COALESCE(p_agent_style, agent_style),
    on_status         = COALESCE(p_on_status, on_status),
    tools             = COALESCE(p_tools, tools),
    share_editor_with = COALESCE(p_share_editor_with, share_editor_with)
  WHERE agent_id = p_agent_id
  RETURNING *;
$$;
