-- Atomically replaces the full set of knowledge bases attached to an agent:
-- delete all existing agent_knowledge_bases rows for p_agent_id, then insert
-- the new set, in one transaction (plpgsql function body is one implicit
-- transaction). Mirrors fn_update_agent.sql's "NULL/empty array means
-- explicit set" semantics — call with an empty array to detach all KBs.
CREATE OR REPLACE FUNCTION fn_set_agent_knowledge_bases(
  p_agent_id UUID,
  p_kb_ids   UUID[]
)
RETURNS SETOF agent_knowledge_bases
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM agent_knowledge_bases WHERE agent_id = p_agent_id;

  RETURN QUERY
  INSERT INTO agent_knowledge_bases (agent_id, kb_id)
  SELECT p_agent_id, unnest(COALESCE(p_kb_ids, ARRAY[]::UUID[]))
  RETURNING *;
END;
$$;
