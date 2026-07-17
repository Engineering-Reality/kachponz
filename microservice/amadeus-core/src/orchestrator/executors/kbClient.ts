/**
 * AML/CFT knowledge base retrieval (apu.md Task 3b) — deliberately NOT
 * vector/embedding-based like ragClient.ts's retrievalWithRerank(). The only
 * working embedding path in this repo is DashScope cloud (embeddingClient.ts),
 * which is dev/prototyping-only per the compliance caveat there; sending real
 * counterparty names extracted from live transaction messages to a cloud API
 * at query time was ruled out. This uses Postgres full-text search instead —
 * 100% on-prem, no external calls — so the search_knowledge_base tool
 * registered in engine.ts is real retrieval, not a system-prompt promise.
 */

import { query } from '../../db/pool.js';

export interface KbSearchResult {
  doc_id: string;
  filename: string;
  rank: number;
  snippet: string;
}

export async function searchKnowledgeBase(kbId: string, userQuery: string): Promise<KbSearchResult[]> {
  const result = await query<KbSearchResult>(
    `SELECT
       doc_id,
       filename,
       ts_rank(to_tsvector('simple', raw_text), plainto_tsquery('simple', $2)) AS rank,
       ts_headline('simple', raw_text, plainto_tsquery('simple', $2)) AS snippet
     FROM kb_documents
     WHERE kb_id = $1
       AND status = 'ready'
       AND to_tsvector('simple', raw_text) @@ plainto_tsquery('simple', $2)
     ORDER BY rank DESC
     LIMIT 5`,
    [kbId, userQuery],
  );
  return result.rows;
}

export interface AgentKnowledgeBase {
  kb_id: string;
  name: string;
}

export async function getAgentKnowledgeBases(agentId: string): Promise<AgentKnowledgeBase[]> {
  const result = await query<AgentKnowledgeBase>(
    `SELECT kb.kb_id, kb.name
     FROM agent_knowledge_bases akb
     JOIN knowledge_bases kb ON kb.kb_id = akb.kb_id
     WHERE akb.agent_id = $1
     ORDER BY kb.name ASC`,
    [agentId],
  );
  return result.rows;
}
