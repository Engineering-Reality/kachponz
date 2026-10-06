/**
 * routes/transactions.ts — All transaction-related endpoints.
 *
 * Endpoints:
 *   GET  /health
 *   POST /transactions
 *   GET  /transactions
 *   GET  /transactions/:id
 *   POST /transactions/:id/steps/:step/complete
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { v4 as uuidv4 } from "uuid";

import { pool, pingDatabase } from "../db/index.js";
import { registerAuthHook } from "../middleware/auth.js";
import {
  CreateTransactionSchema,
  CompleteStepSchema,
  ListTransactionsQuerySchema,
} from "../schemas/transaction.js";
import {
  STEP_FLOWS,
  SUPPORTED_TYPES,
  TransactionType,
  getInitialStep,
  isFinalStep,
  validateTransition,
} from "../config/stepFlows.js";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  InternalServerError,
  isPgUniqueViolation,
  ApiError,
} from "../errors/index.js";

// ── DB row types ─────────────────────────────────────────────

interface TransactionRow {
  id: string;
  type: string;
  current_step: string;
  status: string;
  company_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface TransactionEventRow {
  id: string;
  transaction_id: string;
  step: string;
  status: string;
  actor: string;
  reason: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// ── Helper: parse & validate request body with Zod ──────────

function parseBody<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    throw new BadRequestError("Request validation failed", { validation_errors: issues });
  }
  return result.data;
}

// ── Route handler factory ────────────────────────────────────

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /health ─────────────────────────────────────────────
  // No auth — health probes must not require credentials.
  fastify.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    const dbOk = await pingDatabase();
    const status = dbOk ? "ok" : "degraded";
    const httpStatus = dbOk ? 200 : 503;
    reply.status(httpStatus).send({
      status,
      db: dbOk ? "connected" : "unreachable",
      timestamp: new Date().toISOString(),
    });
  });

  // ── Apply auth to all routes below ──────────────────────────
  // We use a sub-plugin scope so /health stays unprotected.
  await fastify.register(async (authed) => {
    registerAuthHook(authed);

    // ── POST /transactions ─────────────────────────────────────
    authed.post("/transactions", async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parseBody(CreateTransactionSchema, request.body);
      const log = request.log;

      const type = body.type as TransactionType;
      const initialStep = getInitialStep(type);

      let row: TransactionRow;
      try {
        const result = await pool.query<TransactionRow>(
          `INSERT INTO transactions
             (id, type, current_step, status, company_id, version, created_at, updated_at)
           VALUES
             ($1, $2, $3, 'active', $4, 1, NOW(), NOW())
           RETURNING *`,
          [uuidv4(), type, initialStep, body.company_id]
        );
        row = result.rows[0];
      } catch (err) {
        log.error({ err }, "Failed to insert transaction");
        throw new InternalServerError("Failed to create transaction");
      }

      log.info({ transaction_id: row.id, type, initial_step: initialStep }, "Transaction created");
      reply.status(201).send(row);
    });

    // ── GET /transactions ──────────────────────────────────────
    authed.get("/transactions", async (request: FastifyRequest, reply: FastifyReply) => {
      const query = parseBody(ListTransactionsQuerySchema, request.query);

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.type) {
        params.push(query.type);
        conditions.push(`type = $${params.length}`);
      }
      if (query.company_id) {
        params.push(query.company_id);
        conditions.push(`company_id = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      params.push(query.limit, query.offset);

      const sql = `
        SELECT * FROM transactions
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const result = await pool.query<TransactionRow>(sql, params);
      reply.send({ data: result.rows, count: result.rowCount });
    });

    // ── GET /transactions/:id ──────────────────────────────────
    authed.get("/transactions/:id", async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const log = request.log.child({ transaction_id: id });

      const txResult = await pool.query<TransactionRow>(
        "SELECT * FROM transactions WHERE id = $1",
        [id]
      );

      if (txResult.rowCount === 0) {
        throw new NotFoundError(`Transaction '${id}' not found`, { transaction_id: id });
      }

      const eventsResult = await pool.query<TransactionEventRow>(
        "SELECT * FROM transaction_events WHERE transaction_id = $1 ORDER BY created_at ASC",
        [id]
      );

      log.debug({ event_count: eventsResult.rowCount }, "Transaction fetched");
      reply.send({
        transaction: txResult.rows[0],
        events: eventsResult.rows,
      });
    });

    // ── POST /transactions/:id/steps/:step/complete ────────────
    authed.post(
      "/transactions/:id/steps/:step/complete",
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id, step } = request.params as { id: string; step: string };
        const body = parseBody(CompleteStepSchema, request.body);
        const robot = request.serviceAccount;
        const log = request.log.child({ transaction_id: id, step, actor: robot.robot_name });

        // 1. Fetch transaction
        const txResult = await pool.query<TransactionRow>(
          "SELECT * FROM transactions WHERE id = $1",
          [id]
        );
        if (txResult.rowCount === 0) {
          throw new NotFoundError(`Transaction '${id}' not found`, { transaction_id: id });
        }
        const tx = txResult.rows[0];

        if (tx.status !== "active") {
          throw new BadRequestError(
            `Transaction is already '${tx.status}' and cannot be updated`,
            { transaction_id: id, status: tx.status }
          );
        }

        // 2. Validate step transition
        const transitionResult = validateTransition(
          tx.type as TransactionType,
          tx.current_step,
          step,
          body.reason
        );

        if (!transitionResult.ok) {
          throw new UnprocessableError(transitionResult.reason, {
            code: transitionResult.code,
            current_step: tx.current_step,
            target_step: step,
            transaction_type: tx.type,
          });
        }

        // 3. Idempotency — check if this (transaction_id, idempotency_key) was already processed
        const existingEvent = await pool.query<TransactionEventRow>(
          `SELECT * FROM transaction_events
           WHERE transaction_id = $1 AND idempotency_key = $2`,
          [id, body.idempotency_key]
        );

        if (existingEvent.rowCount !== null && existingEvent.rowCount > 0) {
          // Already processed — return the existing event without side effects
          log.info({ idempotency_key: body.idempotency_key }, "Idempotent replay detected — returning existing event");
          reply.status(200).send({
            idempotent: true,
            event: existingEvent.rows[0],
            transaction: tx,
          });
          return;
        }

        // 4. Optimistic lock + state transition in a DB transaction
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Optimistic lock: only update if version matches what we read
          const expectedVersion = tx.version;
          const isFinal = isFinalStep(tx.type as TransactionType, step);
          const newStatus = body.status === "failed" ? "failed"
            : isFinal ? "completed"
            : "active";

          const updateResult = await client.query<TransactionRow>(
            `UPDATE transactions
             SET current_step = $1,
                 status = $2,
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $3
               AND version = $4
             RETURNING *`,
            [step, newStatus, id, expectedVersion]
          );

          if (updateResult.rowCount === 0) {
            // Another request updated the transaction concurrently
            await client.query("ROLLBACK");
            throw new ConflictError(
              "Transaction was modified by another request — please retry",
              { transaction_id: id, expected_version: expectedVersion }
            );
          }

          // 5. Append event (immutable)
          const eventResult = await client.query<TransactionEventRow>(
            `INSERT INTO transaction_events
               (id, transaction_id, step, status, actor, reason, idempotency_key, payload, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING *`,
            [
              uuidv4(),
              id,
              step,
              body.status,
              robot.robot_name,
              body.reason ?? null,
              body.idempotency_key,
              body.payload ?? {},
            ]
          );

          await client.query("COMMIT");

          const updatedTx = updateResult.rows[0];
          const event = eventResult.rows[0];

          log.info(
            { new_step: step, new_status: newStatus, new_version: updatedTx.version },
            "Step completed"
          );

          reply.status(200).send({ transaction: updatedTx, event });
        } catch (err) {
          await client.query("ROLLBACK");

          // Unique constraint on idempotency_key — race condition on concurrent retries
          if (isPgUniqueViolation(err)) {
            log.warn({ idempotency_key: body.idempotency_key }, "Concurrent idempotent request");
            throw new ConflictError("Duplicate idempotency_key — request is already being processed", {
              idempotency_key: body.idempotency_key,
            });
          }

          if (err instanceof ApiError) throw err;
          log.error({ err }, "Unexpected error in step completion");
          throw new InternalServerError("Failed to complete step");
        } finally {
          client.release();
        }
      }
    );
  });
}
