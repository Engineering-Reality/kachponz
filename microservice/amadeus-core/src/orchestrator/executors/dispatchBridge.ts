/**
 * Bridge antara Executor abstraction ↔ state tracker.
 *
 * Alur:
 *   1. Cari executor terpilih via router.
 *   2. Jalankan executor.
 *   3. Terjemahkan outcome:
 *        - `completed`   → panggil completeStep (state tracker maju).
 *        - `dispatched`  → JANGAN majukan state; robot yang lapor via A2A.
 *        - `failed`      → catat via failStep (bila tersedia) atau lempar
 *                          error terstruktur.
 *        - `refused`     → executor menolak dispatch tanpa mencoba (mis. auth
 *                          ditolak) — sama seperti `failed`, TIDAK majukan state.
 */

import { completeStep, getTransactionWithEvents } from '../../services/transactions.js';
import { chooseExecutor } from './router.js';
import type { AuthContext } from '../../types/domain.js';
import { DomainError } from '../../types/domain.js';
import type { ExecutorOutcome } from './base.js';
import { logger } from '../../lib/logger.js';

export interface StepDispatchResult {
  outcome: ExecutorOutcome['kind'];
  executor: string;
  step: string;
  currentStepAfter: string;
  status: string;
  resultData?: Record<string, unknown>;
  externalJobId?: string;
  reason?: string;
}

/**
 * Jalankan step SEKARANG untuk transaksi tertentu via executor terpilih.
 * Dipanggil dari endpoint /orchestrator/dispatch (lihat routes).
 *
 * `idempotencyKey` dipakai bila outcome=completed (state tracker butuh idem).
 * Bila outcome=dispatched, robot yang menyelesaikan step akan pakai idem-key
 * mereka sendiri.
 */
export async function dispatchCurrentStep(
  auth: AuthContext,
  transactionId: string,
  idempotencyKey: string,
): Promise<StepDispatchResult> {
  const { transaction } = await getTransactionWithEvents(transactionId);
  if (transaction.company_id !== auth.companyId) {
    throw new DomainError('NOT_FOUND', 'Transaksi tidak ditemukan', 404);
  }

  const step = transaction.current_step;
  const decision = chooseExecutor(step, transaction.type);
  if (!decision) {
    throw new DomainError(
      'NO_EXECUTOR',
      `Tidak ada executor terdaftar untuk step=${step} type=${transaction.type}`,
      404,
    );
  }

  const log = logger.child({
    transaction_id: transactionId,
    step,
    executor: decision.executor.descriptor.id,
    route_reason: decision.reason,
  });
  log.info('dispatching step');

  const outcome = await decision.executor.run({
    transactionId,
    step,
    type: transaction.type,
    data: {}, // MVP: payload sisi dispatcher; robot bisa dapat data dari GET /transactions
  });

  if (outcome.kind === 'failed') {
    log.warn({ reason: outcome.reason }, 'executor melaporkan gagal');
    return {
      outcome: 'failed',
      executor: decision.executor.descriptor.id,
      step,
      currentStepAfter: step,
      status: transaction.status,
      reason: outcome.reason,
      resultData: outcome.resultData,
    };
  }

  if (outcome.kind === 'refused') {
    log.warn({ reason: outcome.reason }, 'executor menolak dispatch');
    return {
      outcome: 'refused',
      executor: decision.executor.descriptor.id,
      step,
      currentStepAfter: step, // TIDAK maju — executor menolak, bukan robot yang lapor
      status: transaction.status,
      reason: outcome.reason,
      resultData: outcome.resultData,
    };
  }

  if (outcome.kind === 'dispatched') {
    log.info({ externalJobId: outcome.externalJobId }, 'job dispatched ke executor eksternal');
    return {
      outcome: 'dispatched',
      executor: decision.executor.descriptor.id,
      step,
      currentStepAfter: step, // TIDAK maju; menunggu A2A dari robot
      status: transaction.status,
      externalJobId: outcome.externalJobId,
      resultData: outcome.resultData,
    };
  }

  // outcome.kind === 'completed' → majukan state tracker sekarang.
  const res = await completeStep(auth, transactionId, {
    step,
    idempotencyKey,
    payload: outcome.resultData,
  });

  return {
    outcome: 'completed',
    executor: decision.executor.descriptor.id,
    step,
    currentStepAfter: res.transaction.current_step,
    status: res.transaction.status,
    resultData: outcome.resultData,
  };
}
