import { withTransaction, query } from '../db/pool.js';
import {
  getFlow,
  isForwardTransition,
  isFinancialStep,
  stepExists,
  stepIndex,
} from '../config/stepFlows.js';
import { DomainError } from '../types/domain.js';
import type { Transaction, TransactionEvent, AuthContext } from '../types/domain.js';
import { txLogger } from '../lib/logger.js';

export interface CreateTxInput {
  type: string;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
}

export async function createTransaction(
  auth: AuthContext,
  input: CreateTxInput,
): Promise<Transaction> {
  const flow = getFlow(input.type);
  if (!flow) {
    throw new DomainError('UNKNOWN_TYPE', `Tipe transaksi tidak dikenal: ${input.type}`, 400);
  }
  if (auth.allowedTypes && !auth.allowedTypes.includes(input.type)) {
    throw new DomainError('TYPE_FORBIDDEN', 'Robot tidak berhak atas tipe transaksi ini', 403);
  }

  return withTransaction(async (client) => {
    const txRes = await client.query<Transaction>(
      `INSERT INTO transactions (type, current_step, status, company_id)
       VALUES ($1, $2, 'in_progress', $3)
       RETURNING id, type, current_step, status, company_id, version, created_at, updated_at`,
      [input.type, flow.initial, auth.companyId],
    );
    const tx = txRes.rows[0];
    if (!tx) throw new DomainError('CREATE_FAILED', 'Gagal membuat transaksi', 500);

    await client.query(
      `INSERT INTO transaction_events
          (transaction_id, step, status, actor, idempotency_key, payload, signed)
       VALUES ($1, $2, 'created', $3, $4, $5, $6)
       ON CONFLICT (transaction_id, idempotency_key) DO NOTHING`,
      [tx.id, flow.initial, auth.robotName, input.idempotencyKey, input.payload ?? {}, false],
    );

    txLogger(tx.id).info({ type: tx.type, actor: auth.robotName }, 'transaction created');
    return tx;
  });
}

export interface CompleteStepInput {
  step: string; // step yang DISELESAIKAN (harus == current_step)
  idempotencyKey: string;
  reason?: string;
  payload?: Record<string, unknown>;
  targetStep?: string;
}

export interface CompleteStepResult {
  transaction: Transaction;
  event: TransactionEvent;
  idempotentReplay: boolean;
}

/**
 * Selesaikan sebuah step dan majukan current_step.
 *
 * Aturan:
 *  - Idempotency: (transaction_id, idempotency_key) unik. Replay → kembalikan
 *    hasil sebelumnya, TIDAK insert ganda. (prompt #8)
 *  - Optimistic lock: UPDATE ... WHERE version = :expected. Concurrent update,
 *    salah satu kalah dan ditolak dengan 409. (prompt #8)
 *  - Transisi: harus MAJU sesuai stepFlows. Mundur/lompat butuh `reason`
 *    eksplisit; lompat maju tetap ditolak. (prompt #8)
 *  - Financial step: caller WAJIB sudah lolos signature (auth.financiallySigned).
 */
export async function completeStep(
  auth: AuthContext,
  transactionId: string,
  input: CompleteStepInput,
): Promise<CompleteStepResult> {
  const log = txLogger(transactionId);

  return withTransaction(async (client) => {
    // 1) Idempotency check lebih dulu (di dalam tx untuk konsistensi).
    const existing = await client.query<TransactionEvent>(
      `SELECT id, transaction_id, step, status, actor, reason, idempotency_key,
              payload, signed, created_at
         FROM transaction_events
        WHERE transaction_id = $1 AND idempotency_key = $2`,
      [transactionId, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      const txRes = await client.query<Transaction>(
        `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
           FROM transactions WHERE id = $1`,
        [transactionId],
      );
      const tx = txRes.rows[0];
      if (!tx) throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);
      log.info({ idempotency_key: input.idempotencyKey }, 'idempotent replay');
      return { transaction: tx, event: existing.rows[0], idempotentReplay: true };
    }

    // 2) Ambil transaksi + kunci baris (FOR UPDATE) untuk hindari race dalam tx ini.
    const curRes = await client.query<Transaction>(
      `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
         FROM transactions WHERE id = $1 FOR UPDATE`,
      [transactionId],
    );
    const tx = curRes.rows[0];
    if (!tx) throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);

    if (tx.company_id !== auth.companyId) {
      throw new DomainError('COMPANY_MISMATCH', 'Transaksi milik company lain', 403);
    }
    if (auth.allowedTypes && !auth.allowedTypes.includes(tx.type)) {
      throw new DomainError('TYPE_FORBIDDEN', 'Robot tidak berhak atas tipe transaksi ini', 403);
    }

    const flow = getFlow(tx.type);
    if (!flow) throw new DomainError('UNKNOWN_TYPE', `Flow hilang untuk tipe ${tx.type}`, 500);

    if (!stepExists(flow, input.step)) {
      throw new DomainError('UNKNOWN_STEP', `Step tidak dikenal: ${input.step}`, 400, {
        step: input.step,
      });
    }

    // 3) Step yang diselesaikan harus == current_step.
    if (input.step !== tx.current_step) {
      throw new DomainError(
        'STEP_MISMATCH',
        `Step yang diselesaikan (${input.step}) bukan current_step (${tx.current_step})`,
        409,
        { expected: tx.current_step, got: input.step },
      );
    }

    // 4) Tentukan next step (bisa eksplisit lewat targetStep, atau default ke cabang utama).
    const nextStep = input.targetStep ?? flow.steps[tx.current_step]?.next[0];
    const isTerminal = flow.steps[tx.current_step]?.terminal === true;

    // 5) Validasi transisi. MAJU normal OK. MUNDUR/lompat butuh reason.
    if (!isTerminal && nextStep) {
      const forward = isForwardTransition(flow, tx.current_step, nextStep);
      const backwardOrJump =
        stepIndex(flow, nextStep) <= stepIndex(flow, tx.current_step);
      if (!forward) {
        throw new DomainError('INVALID_TRANSITION', 'Transisi tidak sah', 422, {
          from: tx.current_step,
          to: nextStep,
        });
      }
      if (backwardOrJump && !input.reason) {
        throw new DomainError(
          'REASON_REQUIRED',
          'Transisi mundur/non-linear membutuhkan `reason`',
          422,
          { from: tx.current_step, to: nextStep },
        );
      }
    }

    // 6) Financial gate: step finansial WAJIB sudah signed.
    const financial = isFinancialStep(flow, tx.current_step);
    if (financial && !auth.financiallySigned) {
      throw new DomainError(
        'SIGNATURE_REQUIRED',
        'Step finansial memerlukan signature HMAC-SHA512 (2FA)',
        401,
        { step: tx.current_step },
      );
    }

    // 7) Optimistic lock update.
    const newStep = isTerminal ? tx.current_step : (nextStep ?? tx.current_step);
    const newStatus = isTerminal ? 'completed' : 'in_progress';
    const upd = await client.query<Transaction>(
      `UPDATE transactions
          SET current_step = $1, status = $2, version = version + 1, updated_at = now()
        WHERE id = $3 AND version = $4
        RETURNING id, type, current_step, status, company_id, version, created_at, updated_at`,
      [newStep, newStatus, transactionId, tx.version],
    );
    if (upd.rowCount === 0) {
      throw new DomainError('VERSION_CONFLICT', 'Update konkuren ditolak (optimistic lock)', 409, {
        expectedVersion: tx.version,
      });
    }
    const updatedTx = upd.rows[0]!;

    // 8) Append event (immutable).
    const evtRes = await client.query<TransactionEvent>(
      `INSERT INTO transaction_events
          (transaction_id, step, status, actor, reason, idempotency_key, payload, signed)
       VALUES ($1, $2, 'completed', $3, $4, $5, $6, $7)
       RETURNING id, transaction_id, step, status, actor, reason, idempotency_key,
                 payload, signed, created_at`,
      [
        transactionId,
        input.step,
        auth.robotName,
        input.reason ?? null,
        input.idempotencyKey,
        input.payload ?? {},
        financial,
      ],
    );
    const event = evtRes.rows[0]!;

    log.info(
      { from: input.step, to: newStep, actor: auth.robotName, financial },
      'step completed',
    );
    return { transaction: updatedTx, event, idempotentReplay: false };
  });
}

export interface FailStepInput {
  step: string;
  idempotencyKey: string;
  reason: string;
  payload?: Record<string, unknown>;
}

export interface FailStepResult {
  transaction: Transaction;
  event: TransactionEvent;
  idempotentReplay: boolean;
}

/**
 * Mencatat kegagalan pada suatu step tanpa memajukan current_step.
 */
export async function failStep(
  auth: AuthContext,
  transactionId: string,
  input: FailStepInput,
): Promise<FailStepResult> {
  const log = txLogger(transactionId);

  return withTransaction(async (client) => {
    // 1) Idempotency check
    const existing = await client.query<TransactionEvent>(
      `SELECT id, transaction_id, step, status, actor, reason, idempotency_key,
              payload, signed, created_at
         FROM transaction_events
        WHERE transaction_id = $1 AND idempotency_key = $2`,
      [transactionId, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      const txRes = await client.query<Transaction>(
        `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
           FROM transactions WHERE id = $1`,
        [transactionId],
      );
      const tx = txRes.rows[0];
      if (!tx) throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);
      log.info({ idempotency_key: input.idempotencyKey }, 'idempotent replay (failStep)');
      return { transaction: tx, event: existing.rows[0], idempotentReplay: true };
    }

    // 2) Kunci baris (FOR UPDATE)
    const curRes = await client.query<Transaction>(
      `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
         FROM transactions WHERE id = $1 FOR UPDATE`,
      [transactionId],
    );
    const tx = curRes.rows[0];
    if (!tx) throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);

    if (tx.company_id !== auth.companyId) {
      throw new DomainError('COMPANY_MISMATCH', 'Transaksi milik company lain', 403);
    }
    if (auth.allowedTypes && !auth.allowedTypes.includes(tx.type)) {
      throw new DomainError('TYPE_FORBIDDEN', 'Robot tidak berhak atas tipe transaksi ini', 403);
    }

    // 3) Validasi step harus == current_step
    if (input.step !== tx.current_step) {
      throw new DomainError(
        'STEP_MISMATCH',
        `Step yang dilaporkan gagal (${input.step}) bukan current_step (${tx.current_step})`,
        409,
        { expected: tx.current_step, got: input.step },
      );
    }

    if (!input.reason) {
      throw new DomainError('REASON_REQUIRED', 'failStep wajib menyertakan reason', 422);
    }

    // 4) Append event failed
    const evtRes = await client.query<TransactionEvent>(
      `INSERT INTO transaction_events
          (transaction_id, step, status, actor, reason, idempotency_key, payload, signed)
       VALUES ($1, $2, 'failed', $3, $4, $5, $6, $7)
       RETURNING id, transaction_id, step, status, actor, reason, idempotency_key,
                 payload, signed, created_at`,
      [
        transactionId,
        input.step,
        auth.robotName,
        input.reason,
        input.idempotencyKey,
        input.payload ?? {},
        false, // failure event tidak butuh signature finansial
      ],
    );
    const event = evtRes.rows[0]!;

    log.warn(
      { step: input.step, actor: auth.robotName, reason: input.reason },
      'step failed recorded',
    );
    return { transaction: tx, event, idempotentReplay: false };
  });
}

export async function getTransactionWithEvents(
  transactionId: string,
): Promise<{ transaction: Transaction; events: TransactionEvent[] }> {
  const txRes = await query<Transaction>(
    `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
       FROM transactions WHERE id = $1`,
    [transactionId],
  );
  const tx = txRes.rows[0];
  if (!tx) throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);

  const evRes = await query<TransactionEvent>(
    `SELECT id, transaction_id, step, status, actor, reason, idempotency_key,
            payload, signed, created_at
       FROM transaction_events
      WHERE transaction_id = $1
      ORDER BY created_at ASC`,
    [transactionId],
  );
  return { transaction: tx, events: evRes.rows };
}

export async function listTransactions(filter: {
  status?: string;
  type?: string;
  companyId: string;
  limit: number;
}): Promise<Transaction[]> {
  // Query berparameter; filter opsional dibangun aman tanpa string interpolation.
  const clauses: string[] = ['company_id = $1'];
  const params: unknown[] = [filter.companyId];
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filter.type) {
    params.push(filter.type);
    clauses.push(`type = $${params.length}`);
  }
  params.push(filter.limit);
  const limitIdx = params.length;

  const res = await query<Transaction>(
    `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
       FROM transactions
      WHERE ${clauses.join(' AND ')}
      ORDER BY updated_at DESC
      LIMIT $${limitIdx}`,
    params,
  );
  return res.rows;
}
