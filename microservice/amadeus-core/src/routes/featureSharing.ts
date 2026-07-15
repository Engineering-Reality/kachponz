import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { DomainError, type AuthContext } from '../types/domain.js';
import { authenticateRobot } from '../middleware/auth.js';
import { canShareResource, generatePublicHash, type ShareableAgent } from '../lib/sharing.js';

/**
 * Feature Sharing — built from microservice/feature_sharing/README.md (no
 * legacy Python implementation exists to port). Endpoint paths and
 * permission rules mirror the README exactly. Six endpoints require JWT
 * (authenticateRobot, same middleware/token shape as every other human-user
 * route in this repo — see routes/auth.ts's comment on why there's no
 * separate human-auth middleware); the two GET endpoints under
 * /agent-invoke/ are intentionally public, matching legacy Python's
 * PUBLIC_PATH_PREFIXES which already anticipated these exact paths.
 */

const EmailListBody = z.object({
  emails: z.array(z.string().email()).min(1).max(100),
}).strict();

const AgentIdParams = z.object({ agentId: z.string().uuid() }).strict();
const ThreadParams = z.object({ agentId: z.string().uuid(), threadId: z.string().uuid() }).strict();
const HashParams = z.object({ hash: z.string().min(1).max(64) }).strict();

interface ThreadShareInfo {
  share_visitor_with: string[];
  share_editor_with: string[];
  public_hash: string | null;
  is_public: boolean;
}

async function fetchAgentForShare(agentId: string): Promise<(ShareableAgent & { agent_id: string; public_hash: string | null; is_public: boolean }) | null> {
  const res = await query<ShareableAgent & { agent_id: string; public_hash: string | null; is_public: boolean }>(
    `SELECT agent_id, user_id, company_id, share_editor_with, share_visitor_with, public_hash, is_public
       FROM agents WHERE agent_id = $1`,
    [agentId],
  );
  return res.rows[0] ?? null;
}

async function requireAgentShareAccess(auth: AuthContext, agentId: string) {
  const agent = await fetchAgentForShare(agentId);
  if (!agent) {
    throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
  }
  const allowed = await canShareResource(auth, agent);
  if (!allowed) {
    throw new DomainError('FORBIDDEN', 'Tidak berhak membagikan agent ini', 403);
  }
  return agent;
}

/** Adds emails to an existing share list (dedup), never overwrites it wholesale. */
async function addAgentShareEmails(agentId: string, column: 'share_editor_with' | 'share_visitor_with', emails: string[]) {
  const columnSql = column === 'share_editor_with' ? 'share_editor_with' : 'share_visitor_with';
  const res = await query(
    `UPDATE agents
        SET ${columnSql} = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(${columnSql}, '{}') || $2::text[])))
      WHERE agent_id = $1
      RETURNING agent_id, share_editor_with, share_visitor_with, public_hash, is_public`,
    [agentId, emails],
  );
  return res.rows[0];
}

async function ensureAgentPublicLink(agentId: string, existingHash: string | null) {
  const hash = existingHash ?? generatePublicHash();
  const res = await query(
    `UPDATE agents SET is_public = true, public_hash = COALESCE(public_hash, $2)
      WHERE agent_id = $1
      RETURNING agent_id, public_hash, is_public`,
    [agentId, hash],
  );
  return res.rows[0];
}

function getThreadShareInfo(chatHistory: unknown): { arr: unknown[]; info: ThreadShareInfo } {
  const arr = Array.isArray(chatHistory) && chatHistory.length > 0 ? [...chatHistory] : [{}];
  const existing = (arr[0] as Record<string, unknown>)?.share_info as Partial<ThreadShareInfo> | undefined;
  return {
    arr,
    info: {
      share_visitor_with: existing?.share_visitor_with ?? [],
      share_editor_with: existing?.share_editor_with ?? [],
      public_hash: existing?.public_hash ?? null,
      is_public: existing?.is_public ?? false,
    },
  };
}

async function fetchThread(agentId: string, threadId: string) {
  const res = await query<{ agent_log_id: string; agent_id: string; chat_history: unknown; public_hash: string | null; is_public: boolean }>(
    `SELECT agent_log_id, agent_id, chat_history, public_hash, is_public
       FROM agent_logs WHERE agent_log_id = $1 AND agent_id = $2`,
    [threadId, agentId],
  );
  return res.rows[0] ?? null;
}

async function writeThreadShareInfo(threadId: string, arr: unknown[], info: ThreadShareInfo) {
  (arr[0] as Record<string, unknown>).share_info = info;
  const res = await query(
    `UPDATE agent_logs SET chat_history = $1::jsonb, is_public = $2, public_hash = $3
      WHERE agent_log_id = $4
      RETURNING agent_log_id, agent_id, chat_history, is_public, public_hash`,
    [JSON.stringify(arr), info.is_public, info.public_hash, threadId],
  );
  return res.rows[0];
}

export const registerFeatureSharingRoutes: FastifyPluginAsync = async (rootApp: FastifyInstance) => {
  // ─── Protected: six share endpoints (JWT required) ──────────────────
  await rootApp.register(async (app) => {
    app.addHook('preHandler', authenticateRobot);
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.post('/feature-sharing/agent/share-editor-with/:agentId', {
      schema: { params: AgentIdParams, body: EmailListBody },
    }, async (req, reply) => {
      const { agentId } = req.params as z.infer<typeof AgentIdParams>;
      const { emails } = req.body as z.infer<typeof EmailListBody>;
      await requireAgentShareAccess(req.auth!, agentId);
      const agent = await addAgentShareEmails(agentId, 'share_editor_with', emails);
      return reply.send(agent);
    });

    typed.post('/feature-sharing/agent/share-visitor-with/:agentId', {
      schema: { params: AgentIdParams, body: EmailListBody },
    }, async (req, reply) => {
      const { agentId } = req.params as z.infer<typeof AgentIdParams>;
      const { emails } = req.body as z.infer<typeof EmailListBody>;
      await requireAgentShareAccess(req.auth!, agentId);
      const agent = await addAgentShareEmails(agentId, 'share_visitor_with', emails);
      return reply.send(agent);
    });

    typed.post('/feature-sharing/agent/share-anyone-with-link/:agentId', {
      schema: { params: AgentIdParams },
    }, async (req, reply) => {
      const { agentId } = req.params as z.infer<typeof AgentIdParams>;
      const agent = await requireAgentShareAccess(req.auth!, agentId);
      const result = await ensureAgentPublicLink(agentId, agent.public_hash);
      return reply.send(result);
    });

    typed.post('/feature-sharing/thread/share-editor-with/:agentId/:threadId', {
      schema: { params: ThreadParams, body: EmailListBody },
    }, async (req, reply) => {
      const { agentId, threadId } = req.params as z.infer<typeof ThreadParams>;
      const { emails } = req.body as z.infer<typeof EmailListBody>;
      await requireAgentShareAccess(req.auth!, agentId);
      const thread = await fetchThread(agentId, threadId);
      if (!thread) throw new DomainError('NOT_FOUND', 'Thread tidak ditemukan', 404);
      const { arr, info } = getThreadShareInfo(thread.chat_history);
      info.share_editor_with = Array.from(new Set([...info.share_editor_with, ...emails]));
      const result = await writeThreadShareInfo(threadId, arr, info);
      return reply.send(result);
    });

    typed.post('/feature-sharing/thread/share-visitor-with/:agentId/:threadId', {
      schema: { params: ThreadParams, body: EmailListBody },
    }, async (req, reply) => {
      const { agentId, threadId } = req.params as z.infer<typeof ThreadParams>;
      const { emails } = req.body as z.infer<typeof EmailListBody>;
      await requireAgentShareAccess(req.auth!, agentId);
      const thread = await fetchThread(agentId, threadId);
      if (!thread) throw new DomainError('NOT_FOUND', 'Thread tidak ditemukan', 404);
      const { arr, info } = getThreadShareInfo(thread.chat_history);
      info.share_visitor_with = Array.from(new Set([...info.share_visitor_with, ...emails]));
      const result = await writeThreadShareInfo(threadId, arr, info);
      return reply.send(result);
    });

    typed.post('/feature-sharing/thread/share-anyone-with-link/:agentId/:threadId', {
      schema: { params: ThreadParams },
    }, async (req, reply) => {
      const { agentId, threadId } = req.params as z.infer<typeof ThreadParams>;
      await requireAgentShareAccess(req.auth!, agentId);
      const thread = await fetchThread(agentId, threadId);
      if (!thread) throw new DomainError('NOT_FOUND', 'Thread tidak ditemukan', 404);
      const { arr, info } = getThreadShareInfo(thread.chat_history);
      info.is_public = true;
      info.public_hash = info.public_hash ?? thread.public_hash ?? generatePublicHash();
      const result = await writeThreadShareInfo(threadId, arr, info);
      return reply.send(result);
    });
  });

  // ─── Public: no auth, per README + legacy PUBLIC_PATH_PREFIXES ──────
  await rootApp.register(async (app) => {
    const typed = app.withTypeProvider<ZodTypeProvider>();

    typed.get('/agent-invoke/shared-agent/:hash', {
      schema: { params: HashParams },
    }, async (req, reply) => {
      const { hash } = req.params as z.infer<typeof HashParams>;
      const res = await query(
        `SELECT agent_id, agent_name, description, agent_style, on_status, tools
           FROM agents WHERE public_hash = $1 AND is_public = true`,
        [hash],
      );
      if (res.rowCount === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan atau tidak public', 404);
      }
      return reply.send(res.rows[0]);
    });

    typed.get('/agent-invoke/shared-thread/:hash', {
      schema: { params: HashParams },
    }, async (req, reply) => {
      const { hash } = req.params as z.infer<typeof HashParams>;
      const res = await query(
        `SELECT agent_log_id, agent_id, chat_history, date
           FROM agent_logs WHERE public_hash = $1 AND is_public = true`,
        [hash],
      );
      if (res.rowCount === 0) {
        throw new DomainError('NOT_FOUND', 'Thread tidak ditemukan atau tidak public', 404);
      }
      return reply.send(res.rows[0]);
    });
  });
};
