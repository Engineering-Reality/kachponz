import { withTransaction, query } from '../db/pool.js';
import { callFn } from '../db/rpc.js';
import { mapPgFunctionError } from '../db/pgErrors.js';
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

// Row shape returned by fn_complete_step / fn_fail_step (db/functions/) —
// both bundle a transaction row + event row + idempotent_replay flag into
// one round trip instead of separate idempotency-check/lock/update/insert calls.
interface StepWriteRow {
  out_tx_id: string;
  out_tx_type: string;
  out_tx_current_step: string;
  out_tx_status: string;
  out_tx_company_id: string;
  out_tx_version: number;
  out_tx_created_at: string;
  out_tx_updated_at: string;
  out_event_id: string;
  out_event_step: string;
  out_event_status: string;
  out_event_actor: string;
  out_event_reason: string | null;
  out_event_idempotency_key: string;
  out_event_payload: Record<string, unknown>;
  out_event_signed: boolean;
  out_event_created_at: string;
  out_idempotent_replay: boolean;
}

function splitStepWriteRow(row: StepWriteRow): {
  transaction: Transaction;
  event: TransactionEvent;
  idempotentReplay: boolean;
} {
  return {
    transaction: {
      id: row.out_tx_id,
      type: row.out_tx_type,
      current_step: row.out_tx_current_step,
      status: row.out_tx_status,
      company_id: row.out_tx_company_id,
      version: row.out_tx_version,
      created_at: row.out_tx_created_at,
      updated_at: row.out_tx_updated_at,
    },
    event: {
      id: row.out_event_id,
      transaction_id: row.out_tx_id,
      step: row.out_event_step,
      status: row.out_event_status,
      actor: row.out_event_actor,
      reason: row.out_event_reason,
      idempotency_key: row.out_event_idempotency_key,
      payload: row.out_event_payload,
      signed: row.out_event_signed,
      created_at: row.out_event_created_at,
    },
    idempotentReplay: row.out_idempotent_replay,
  };
}

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

  // Business-rule validation needs current_step/type up front to decide the next
  // step, so this read can't be skipped even on an idempotent-replay call. It's
  // unlocked (no FOR UPDATE) — fn_complete_step's own idempotency check + optimistic
  // version check (p_expected_version) is what actually guards against races, not
  // this read.
  const curRes = await query<Transaction>(
    `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
       FROM transactions WHERE id = $1`,
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

  // Step yang diselesaikan harus == current_step.
  if (input.step !== tx.current_step) {
    throw new DomainError(
      'STEP_MISMATCH',
      `Step yang diselesaikan (${input.step}) bukan current_step (${tx.current_step})`,
      409,
      { expected: tx.current_step, got: input.step },
    );
  }

  // Tentukan next step (bisa eksplisit lewat targetStep, atau default ke cabang utama).
  const nextStep = input.targetStep ?? flow.steps[tx.current_step]?.next[0];
  const isTerminal = flow.steps[tx.current_step]?.terminal === true;

  // Validasi transisi. MAJU normal OK. MUNDUR/lompat butuh reason.
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

  // Financial gate: step finansial WAJIB sudah signed.
  const financial = isFinancialStep(flow, tx.current_step);
  if (financial && !auth.financiallySigned) {
    throw new DomainError(
      'SIGNATURE_REQUIRED',
      'Step finansial memerlukan signature HMAC-SHA512 (2FA)',
      401,
      { step: tx.current_step },
    );
  }

  const newStep = isTerminal ? tx.current_step : (nextStep ?? tx.current_step);
  const newStatus = isTerminal ? 'completed' : 'in_progress';

  try {
    const res = await callFn<StepWriteRow>('fn_complete_step', [
      transactionId,
      tx.version,
      newStep,
      newStatus,
      auth.robotName,
      input.reason ?? null,
      input.idempotencyKey,
      input.payload ?? {},
      financial,
    ]);
    const result = splitStepWriteRow(res.rows[0]!);
    if (result.idempotentReplay) {
      log.info({ idempotency_key: input.idempotencyKey }, 'idempotent replay');
    } else {
      log.info(
        { from: input.step, to: newStep, actor: auth.robotName, financial },
        'step completed',
      );
    }
    return result;
  } catch (err) {
    throw mapPgFunctionError(err) ?? err;
  }
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

  // Business-rule validation (company/type/step-match) needs the transaction row
  // up front. failStep never advances current_step/version, so there's no
  // optimistic-lock race for fn_fail_step to guard beyond its own idempotency check.
  const curRes = await query<Transaction>(
    `SELECT id, type, current_step, status, company_id, version, created_at, updated_at
       FROM transactions WHERE id = $1`,
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

  try {
    const res = await callFn<StepWriteRow>('fn_fail_step', [
      transactionId,
      input.step,
      auth.robotName,
      input.reason,
      input.idempotencyKey,
      input.payload ?? {},
    ]);
    const result = splitStepWriteRow(res.rows[0]!);
    if (result.idempotentReplay) {
      log.info({ idempotency_key: input.idempotencyKey }, 'idempotent replay (failStep)');
    } else {
      log.warn(
        { step: input.step, actor: auth.robotName, reason: input.reason },
        'step failed recorded',
      );
    }
    return result;
  } catch (err) {
    throw mapPgFunctionError(err) ?? err;
  }
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
