import { completeStep, getTransactionWithEvents, failStep as txFailStep } from '../services/transactions.js';
import { getFlow } from '../config/stepFlows.js';
import { registry } from './agents/base.js';
import { DomainError } from '../types/domain.js';
import type { AuthContext } from '../types/domain.js';
import type { A2AEnvelope, A2AResult } from './a2a/protocol.js';
import { txLogger } from '../lib/logger.js';

/**
 * Inti orchestrator (Layer 2/3).
 *
 * Menerima A2A envelope dari agent/robot, menerjemahkannya ke operasi state
 * tracker, dan menghitung HANDOFF: step berikutnya + siapa (hint) yang mengambil.
 *
 * State tracker tetap satu-satunya sumber kebenaran; engine ini TIDAK menyimpan
 * state paralel. Semua invariant (transisi, idempotency, optimistic lock,
 * financial gate) ditegakkan di Layer 1 — engine hanya mengorkestrasi.
 */
export async function handleA2A(
  auth: AuthContext,
  env: A2AEnvelope,
): Promise<A2AResult> {
  const log = txLogger(env.transactionId);

  if (env.protocol !== 'amadeus.a2a/0') {
    throw new DomainError('PROTOCOL_UNSUPPORTED', `Protokol tidak didukung: ${env.protocol}`, 400);
  }

  switch (env.type) {
    case 'task.complete':
      return completeAndHandoff(auth, env, log);
    case 'task.failed':
      return failStep(auth, env, log);
    case 'task.status':
      return statusOf(env);
    case 'task.assign':
      // assign bersifat informasional pada MVP: koordinator mencatat niat.
      // Handoff sebenarnya terjadi saat task.complete. Kembalikan status kini.
      return statusOf(env);
    default:
      throw new DomainError('BAD_MESSAGE_TYPE', `Tipe pesan A2A tidak dikenal`, 400);
  }
}

async function completeAndHandoff(
  auth: AuthContext,
  env: A2AEnvelope,
  log: ReturnType<typeof txLogger>,
): Promise<A2AResult> {
  const result = await completeStep(auth, env.transactionId, {
    step: env.step,
    idempotencyKey: env.idempotencyKey,
    reason: env.reason,
    payload: env.data,
    targetStep: env.targetStep,
  });

  const flow = getFlow(result.transaction.type);
  const nextStep = result.transaction.status === 'completed'
    ? null
    : flow?.steps[result.transaction.current_step]
      ? result.transaction.current_step
      : null;
  const nextActorHint = nextStep ? (flow?.steps[nextStep]?.actorHint ?? null) : null;

  log.info(
    { correlationId: env.correlationId, nextStep, nextActorHint },
    'A2A handoff computed',
  );

  return {
    accepted: true,
    transactionId: result.transaction.id,
    currentStep: result.transaction.current_step,
    status: result.transaction.status,
    nextStep,
    nextActorHint,
    idempotentReplay: result.idempotentReplay,
  };
}

async function failStep(
  auth: AuthContext,
  env: A2AEnvelope,
  log: ReturnType<typeof txLogger>,
): Promise<A2AResult> {
  if (!env.reason) {
    throw new DomainError('REASON_REQUIRED', 'task.failed wajib menyertakan reason', 422);
  }
  
  const result = await txFailStep(auth, env.transactionId, {
    step: env.step,
    idempotencyKey: env.idempotencyKey,
    reason: env.reason,
    payload: env.data,
  });

  return {
    accepted: true,
    transactionId: result.transaction.id,
    currentStep: result.transaction.current_step,
    status: result.transaction.status,
    nextStep: result.transaction.current_step, // tetap di step yang sama untuk retry
    nextActorHint: null,
    idempotentReplay: result.idempotentReplay,
  };
}

async function statusOf(env: A2AEnvelope): Promise<A2AResult> {
  const { transaction } = await getTransactionWithEvents(env.transactionId);
  const flow = getFlow(transaction.type);
  const nextActorHint =
    flow?.steps[transaction.current_step]?.actorHint ?? null;
  return {
    accepted: true,
    transactionId: transaction.id,
    currentStep: transaction.current_step,
    status: transaction.status,
    nextStep: transaction.status === 'completed' ? null : transaction.current_step,
    nextActorHint,
    idempotentReplay: false,
  };
}

/**
 * Jalankan agent AGENTIC in-process untuk step saat ini (bila ada agent yang
 * mendaftar untuk step+type tsb). Ini jalur "orchestrator menjalankan agent
 * sendiri" — dipakai sandbox CLI & bisa dipicu koordinator.
 */
export async function runAgenticStep(
  auth: AuthContext,
  transactionId: string,
  idempotencyKey: string,
): Promise<A2AResult> {
  const { transaction } = await getTransactionWithEvents(transactionId);
  const step = transaction.current_step;
  const agent = registry.findForStep(step, transaction.type);
  if (!agent || !agent.handle) {
    throw new DomainError(
      'NO_AGENT',
      `Tidak ada agent agentic in-process untuk step ${step}`,
      404,
    );
  }
  const outcome = await agent.handle({
    transactionId,
    step,
    type: transaction.type,
  });
  if (!outcome.completed) {
    throw new DomainError('AGENT_INCOMPLETE', outcome.reason ?? 'agent gagal', 422);
  }
  return completeAndHandoff(
    auth,
    {
      protocol: 'amadeus.a2a/0',
      type: 'task.complete',
      transactionId,
      step,
      idempotencyKey,
      correlationId: `agentic:${agent.descriptor.id}`,
      reason: outcome.reason,
      targetStep: outcome.targetStep,
      data: outcome.resultData,
      sentAt: new Date().toISOString(),
    },
    txLogger(transactionId),
  );
}
