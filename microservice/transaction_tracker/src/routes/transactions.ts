import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authenticateRobot, verifyFinancialSignature } from '../middleware/auth.js';
import {
  CreateTxBody,
  CompleteStepParams,
  CompleteStepBody,
  GetTxParams,
  ListTxQuery,
} from './schemas.js';
import {
  createTransaction,
  completeStep,
  getTransactionWithEvents,
  listTransactions,
} from '../services/transactions.js';
import { DomainError } from '../types/domain.js';
import { pingDb } from '../db/pool.js';

export async function registerTransactionRoutes(app: FastifyInstance): Promise<void> {
  // ---- Health (liveness + DB) — TANPA auth (prompt #5) ----
  app.get('/health', async (_req, reply) => {
    const dbOk = await pingDb();
    return reply.code(dbOk ? 200 : 503).send({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'up' : 'down',
      ts: new Date().toISOString(),
    });
  });

  // ---- Auth hook untuk semua route transaksi ----
  app.register(async (secured) => {
    secured.addHook('preHandler', authenticateRobot);
    secured.addHook('preHandler', verifyFinancialSignature);

    const typedSecured = secured.withTypeProvider<ZodTypeProvider>();

    // POST /transactions
    typedSecured.post('/transactions', {
      schema: { body: CreateTxBody }
    }, async (req, reply) => {
      const body = req.body as CreateTxBody;
      const tx = await createTransaction(req.auth!, {
        type: body.type,
        idempotencyKey: body.idempotencyKey,
        payload: body.payload,
      });
      return reply.code(201).send(tx);
    });

    // POST /transactions/:id/steps/:step/complete
    typedSecured.post('/transactions/:id/steps/:step/complete', {
      schema: { params: CompleteStepParams, body: CompleteStepBody }
    }, async (req, reply) => {
      const params = req.params as { id: string; step: string };
      const body = req.body as CompleteStepBody;
      const result = await completeStep(req.auth!, params.id, {
        step: params.step,
        idempotencyKey: body.idempotencyKey,
        reason: body.reason,
        payload: body.payload,
        targetStep: body.targetStep,
      });
      return reply.code(result.idempotentReplay ? 200 : 201).send(result);
    });

    // GET /transactions/:id
    typedSecured.get('/transactions/:id', {
      schema: { params: GetTxParams }
    }, async (req, reply) => {
      const params = req.params as { id: string };
      const data = await getTransactionWithEvents(params.id);
      if (data.transaction.company_id !== req.auth!.companyId) {
        throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);
      }
      return reply.send(data);
    });

    // GET /transactions?status=&type=&limit=
    typedSecured.get('/transactions', {
      schema: { querystring: ListTxQuery }
    }, async (req, reply) => {
      const q = req.query as ListTxQuery;
      const rows = await listTransactions({
        status: q.status,
        type: q.type,
        companyId: req.auth!.companyId,
        limit: q.limit,
      });
      return reply.send({ items: rows, count: rows.length });
    });
  });
}
