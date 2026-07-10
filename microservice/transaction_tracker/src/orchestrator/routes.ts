import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticateRobot, verifyFinancialSignature } from '../middleware/auth.js';
import { handleA2A, runAgenticStep, runAgenticStepStream, fetchAgentUipathContext, fetchQueueTransactionsForTool } from './engine.js';
import { registry } from './agents/base.js';
import { docExamAgent } from './agents/docExamAgent.js';
import { executorRegistry } from './executors/base.js';
import { registerDefaultExecutors } from './executors/executorMap.js';
import { explainRoute } from './executors/router.js';
import { dispatchCurrentStep } from './executors/dispatchBridge.js';
import type { A2AEnvelope } from './a2a/protocol.js';
import { handleRpc } from './a2a/rpcHandler.js';
import { streamHandler } from './a2a/streamHandler.js';
import { buildAgentCard } from './a2a/agentCard.js';
import { getMcpManagerState } from './mcpManagerState.js';

// Daftarkan agent bawaan sekali saat modul dimuat.
try {
  registry.register(docExamAgent);
} catch {
  /* sudah terdaftar (hot reload) */
}
// Daftarkan executor bawaan (Qwen, UiPath, PAD) sekali saat modul dimuat.
registerDefaultExecutors();

const SAFE_SLUG = z.string().min(1).max(64).regex(/^[a-z0-9_]+$/);
const IDEM = z.string().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/);

const A2AEnvelopeSchema = z
  .object({
    protocol: z.literal('amadeus.a2a/0'),
    type: z.enum(['task.assign', 'task.complete', 'task.failed', 'task.status']),
    transactionId: z.string().uuid(),
    step: SAFE_SLUG,
    idempotencyKey: IDEM,
    correlationId: z.string().min(1).max(200),
    reason: z.string().min(1).max(500).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    sentAt: z.string().datetime(),
  })
  .strict();

const RunAgenticSchema = z
  .object({
    transactionId: z.string().uuid().optional(),
    agentId: z.string().uuid().optional(),
    idempotencyKey: IDEM,
    prompt: z.string().optional(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system', 'tool']),
      content: z.union([z.string(), z.array(z.any())])
    })).optional(),
    stream: z.boolean().optional(),
    // 'playground' (default) never touches the `transactions` table — used by
    // the test-drive UI. 'production' requires a real, existing transactionId.
    mode: z.enum(['playground', 'production']).default('playground'),
    // Client-generated chat-session id (agent-invoke's `agent-sessions` localStorage
    // key), forwarded so uipath_job_trace rows can be correlated back to a chat.
    // Best-effort only — never validated against a server-side session table.
    sessionLabel: z.string().max(200).optional(),
  })
  .strict();

export async function registerOrchestratorRoutes(app: FastifyInstance): Promise<void> {
  // GET /.well-known/amadeus-agent-card.json (Public discovery)
  app.get('/.well-known/amadeus-agent-card.json', async (_req, reply) => {
    return reply.send(buildAgentCard());
  });

  app.register(async (secured) => {
    secured.addHook('preHandler', authenticateRobot);
    secured.addHook('preHandler', verifyFinancialSignature);

    const typedSecured = secured.withTypeProvider<ZodTypeProvider>();

    // POST /a2a — terima envelope A2A dari robot/agent.
    // Legacy amadeus.a2a/0 — dipertahankan untuk backwards compat.
    typedSecured.post('/a2a', {
      schema: { body: A2AEnvelopeSchema }
    }, async (req, reply) => {
      const env = req.body as A2AEnvelope;
      const result = await handleA2A(req.auth!, env);
      return reply.send(result);
    });

    // POST /a2a/rpc — Endpoint utama amadeus.a2a/1 (JSON-RPC 2.0)
    typedSecured.post('/a2a/rpc', async (req, reply) => {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
      const result = await handleRpc(req.body as any, req.auth!, rawBody);
      // Ensure HTTP status is 200 for JSON-RPC even if it contains a JSON-RPC error
      return reply.code(200).send(result);
    });

    // GET /a2a/tasks/:id/stream — SSE endpoint untuk task update
    typedSecured.get('/a2a/tasks/:id/stream', streamHandler);

    // POST /orchestrator/run-agentic — jalankan agent agentic in-process
    // untuk current_step transaksi (mis. Document Examination Agent).
    typedSecured.post('/orchestrator/run-agentic', {
      schema: { body: RunAgenticSchema }
    }, async (req, reply) => {
      const body = req.body as { transactionId?: string; agentId?: string; idempotencyKey: string; prompt?: string; messages?: any[]; stream?: boolean; mode: 'playground' | 'production'; sessionLabel?: string };
      if (body.stream) {
        reply.hijack();
        await runAgenticStepStream(req.auth!, body.transactionId, body.idempotencyKey, body.prompt, body.messages, body.agentId, body.mode, reply, body.sessionLabel);
        return;
      }
      const result = await runAgenticStep(req.auth!, body.transactionId, body.idempotencyKey, body.prompt, body.messages, body.agentId, body.mode, body.sessionLabel);
      return reply.send(result);
    });

    // GET /orchestrator/agents — daftar agent terdaftar & kapabilitasnya.
    typedSecured.get('/orchestrator/agents', async (_req, reply) => {
      return reply.send({
        agents: registry.all().map((a) => a.descriptor),
      });
    });

    // GET /orchestrator/mcp/status — live process state for every MCP tool
    // that has ever been (re)started, sourced from mcp_runtime_state (the
    // only place a currently-live SSE port is ever recorded). Polled by the
    // Tools page to show "running on :PORT" / "stopped" without the user
    // having to track ports themselves.
    typedSecured.get('/orchestrator/mcp/status', async (_req, reply) => {
      const res = await query<{
        tool_id: string;
        tool_name: string;
        method: string;
        port: number | null;
        status: string;
        pid: number | null;
        started_at: string | null;
        last_error: string | null;
      }>(
        `SELECT t.tool_id, t.name AS tool_name, mrs.method, mrs.port, mrs.status, mrs.pid, mrs.started_at, mrs.last_error
         FROM mcp_runtime_state mrs
         JOIN tools t ON t.tool_id = mrs.tool_id
         ORDER BY t.name ASC`,
      );
      return reply.send(
        res.rows.map((r) => ({
          toolId: r.tool_id,
          toolName: r.tool_name,
          method: r.method,
          port: r.port,
          status: r.status,
          pid: r.pid,
          startedAt: r.started_at,
          lastError: r.last_error,
        })),
      );
    });

    // GET /orchestrator/mcp/manager-status — is the mcpAutoManager child
    // process (spawned by server.ts) actually alive? If it crashed at boot
    // (e.g. a broken import), no MCP tool server is ever spawned and every
    // tool call fails with a generic connection error — this endpoint lets
    // the frontend surface that immediately instead of the user discovering
    // it three tool calls into a chat.
    typedSecured.get('/orchestrator/mcp/manager-status', async (_req, reply) => {
      return reply.send(getMcpManagerState());
    });

    // POST /orchestrator/mcp/:toolId/restart — manual restart escape hatch for
    // cases the mtime-based auto-restart in mcpAutoManager can't catch (e.g.
    // env var / DB config changes with no entry-file change). Kills the
    // currently-tracked process by pid (works cross-process since the daemon
    // that actually spawned it lives in a separate node process from this
    // API server) and clears its runtime row; the daemon's next sync tick
    // (≤10s) sees the tool is no longer running and respawns it fresh.
    typedSecured.post('/orchestrator/mcp/:toolId/restart', {
      schema: { params: z.object({ toolId: z.string().uuid() }) },
    }, async (req, reply) => {
      const { toolId } = req.params as { toolId: string };

      const res = await query<{ pid: number | null }>(
        `SELECT pid FROM mcp_runtime_state WHERE tool_id = $1`,
        [toolId],
      );
      const row = res.rows[0];
      if (!row) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No runtime state for this tool' } });
      }

      const { pid } = row;
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // Already dead — fine, we just want it gone either way.
        }
      }

      await query(
        `UPDATE mcp_runtime_state SET status = 'stopped', pid = NULL, updated_at = now() WHERE tool_id = $1`,
        [toolId],
      );

      return reply.code(202).send({ status: 'restarting' });
    });

    // ── EXECUTOR endpoints (meta-orchestrator: LLM + UiPath + PAD) ──────
    // GET /orchestrator/executors — semua executor terdaftar.
    typedSecured.get('/orchestrator/executors', async (_req, reply) => {
      return reply.send({
        executors: executorRegistry.all().map((e) => e.descriptor),
      });
    });

    // GET /orchestrator/route?step=&type= — introspeksi keputusan router.
    typedSecured.get('/orchestrator/route', {
      schema: {
        querystring: z.object({ step: SAFE_SLUG, type: SAFE_SLUG }).strict(),
      },
    }, async (req, reply) => {
      const q = req.query as { step: string; type: string };
      const decision = explainRoute(q.step, q.type);
      if (!decision) return reply.code(404).send({ error: { code: 'NO_EXECUTOR', message: 'Tidak ada executor cocok' } });
      return reply.send(decision);
    });

    // GET /orchestrator/uipath-jobs — recent uipath_job_trace rows, joined with
    // agent name, for the Robots dashboard (frontend/dashboard/robots). Plain
    // SELECT — this is a simple read, no conditional write-path logic, so no
    // RPC function per the "don't convert simple reads" convention.
    typedSecured.get('/orchestrator/uipath-jobs', {
      schema: {
        querystring: z.object({
          agentId: z.string().uuid().optional(),
          state: z.enum(['Pending', 'Running', 'Successful', 'Faulted', 'Stopped']).optional(),
          sessionLabel: z.string().max(200).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }).strict(),
      },
    }, async (req, reply) => {
      const q = req.query as { agentId?: string; state?: string; sessionLabel?: string; limit: number };
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (q.agentId) { params.push(q.agentId); conditions.push(`ujt.agent_id = $${params.length}`); }
      if (q.state) { params.push(q.state); conditions.push(`ujt.state = $${params.length}`); }
      if (q.sessionLabel) { params.push(q.sessionLabel); conditions.push(`ujt.session_label = $${params.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(q.limit);
      const res = await query(
        `SELECT ujt.*, a.agent_name
         FROM uipath_job_trace ujt
         LEFT JOIN agents a ON a.agent_id = ujt.agent_id
         ${where}
         ORDER BY ujt.triggered_at DESC
         LIMIT $${params.length}`,
        params,
      );
      return reply.send({ items: res.rows, count: res.rows.length });
    });

    // GET /orchestrator/tools/:toolId/uipath-queue-transactions — row-expand
    // drill-down on the Robots dashboard: live queue items for the queue a
    // given job trace row was associated with.
    typedSecured.get('/orchestrator/tools/:toolId/uipath-queue-transactions', {
      schema: {
        params: z.object({ toolId: z.string().uuid() }).strict(),
        querystring: z.object({ queueName: z.string().min(1), folderId: z.string().optional() }).strict(),
      },
    }, async (req, reply) => {
      const { toolId } = req.params as { toolId: string };
      const { queueName, folderId } = req.query as { queueName: string; folderId?: string };
      try {
        const items = await fetchQueueTransactionsForTool(toolId, queueName, folderId);
        return reply.send({ items });
      } catch (e) {
        return reply.code(502).send({ error: { code: 'UIPATH_QUEUE_FETCH_FAILED', message: e instanceof Error ? e.message : String(e) } });
      }
    });

    // GET /orchestrator/agents/:id/uipath-context — proactive sidebar summary
    // (Part 2.3): processes + queues for every UiPath tool linked to this agent,
    // fetched live through the already-connected MCP client, no LLM turn spent.
    typedSecured.get('/orchestrator/agents/:id/uipath-context', {
      schema: { params: z.object({ id: z.string().uuid() }).strict() },
    }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const context = await fetchAgentUipathContext(id);
      return reply.send({ agentId: id, tools: context });
    });

    // POST /orchestrator/uipath/folders — one-time "Test & List Folders" call
    // used by the Tools registration form (Part 2.2). Credentials are the
    // request body, never a query string, so they never land in access logs /
    // browser history / proxy logs.
    typedSecured.post('/orchestrator/uipath/folders', {
      schema: {
        body: z.object({
          clientId: z.string().min(1),
          clientSecret: z.string().min(1),
          baseUrl: z.string().url().default('https://cloud.uipath.com'),
          org: z.string().min(1),
          tenant: z.string().min(1),
        }).strict(),
      },
    }, async (req, reply) => {
      const b = req.body as { clientId: string; clientSecret: string; baseUrl: string; org: string; tenant: string };
      try {
        const tokenRes = await fetch(`${b.baseUrl}/identity_/connect/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: b.clientId,
            client_secret: b.clientSecret,
            scope: 'OR.Folders.Read',
          }).toString(),
        });
        const tokenText = await tokenRes.text();
        req.log.info({ status: tokenRes.status }, 'UiPath folder-test OAuth response');
        if (!tokenRes.ok) {
          return reply.code(502).send({ error: { code: 'UIPATH_AUTH_FAILED', message: `UiPath OAuth2 failed ${tokenRes.status}: ${tokenText.slice(0, 300)}` } });
        }
        const { access_token } = JSON.parse(tokenText) as { access_token: string };

        const foldersRes = await fetch(`${b.baseUrl}/${b.org}/${b.tenant}/orchestrator_/odata/Folders`, {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const foldersText = await foldersRes.text();
        req.log.info({ status: foldersRes.status, body: foldersText.slice(0, 2000) }, 'UiPath Folders raw response');
        if (!foldersRes.ok) {
          return reply.code(502).send({ error: { code: 'UIPATH_FOLDERS_FAILED', message: `UiPath Folders failed ${foldersRes.status}: ${foldersText.slice(0, 300)}` } });
        }
        const data = JSON.parse(foldersText) as { value?: Array<{ Id: number; FullyQualifiedName?: string; DisplayName?: string }> };
        const folders = (data.value ?? []).map((f) => ({ id: String(f.Id), fullyQualifiedName: f.FullyQualifiedName ?? f.DisplayName ?? String(f.Id) }));
        return reply.send({ folders });
      } catch (e) {
        return reply.code(502).send({ error: { code: 'UIPATH_REQUEST_FAILED', message: e instanceof Error ? e.message : String(e) } });
      }
    });

    // POST /orchestrator/dispatch — jalankan step saat ini via executor terpilih.
    typedSecured.post('/orchestrator/dispatch', {
      schema: { body: RunAgenticSchema },
    }, async (req, reply) => {
      const body = req.body as { transactionId: string; idempotencyKey: string };
      const result = await dispatchCurrentStep(req.auth!, body.transactionId, body.idempotencyKey);
      return reply.send(result);
    });
  });
}
