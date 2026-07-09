import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { authenticateRobot, verifyFinancialSignature } from '../middleware/auth.js';
import { handleA2A, runAgenticStep, runAgenticStepStream } from './engine.js';
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
      const body = req.body as { transactionId?: string; agentId?: string; idempotencyKey: string; prompt?: string; messages?: any[]; stream?: boolean; mode: 'playground' | 'production' };
      if (body.stream) {
        reply.hijack();
        await runAgenticStepStream(req.auth!, body.transactionId, body.idempotencyKey, body.prompt, body.messages, body.agentId, body.mode, reply);
        return;
      }
      const result = await runAgenticStep(req.auth!, body.transactionId, body.idempotencyKey, body.prompt, body.messages, body.agentId, body.mode);
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
