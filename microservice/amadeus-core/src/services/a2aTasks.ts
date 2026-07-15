import { query, withTransaction } from '../db/pool.js';
import { DomainError } from '../types/domain.js';
import { getFlow, isKnownType, stepExists } from '../config/stepFlows.js';
import { getTransactionWithEvents, completeStep } from './transactions.js';
import type { TaskState } from '../orchestrator/a2a/protocol_v1.js';
import { txLogger } from '../lib/logger.js';
import { EventEmitter } from 'node:events';

// In-memory event emitter for SSE (MVP B2)
export const a2aEventEmitter = new EventEmitter();
// Increase max listeners since each SSE connection might add one
a2aEventEmitter.setMaxListeners(100);

export interface TaskRow {
  id: string;
  transaction_id: string;
  step: string;
  state: TaskState;
  submitted_by: string;
  assignee_hint: string | null;
  correlation_id: string;
  input_required_msg: string | null;
  result_data: Record<string, unknown> | null;
  fail_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TaskMessageRow {
  id: string;
  task_id: string;
  seq: number;
  role: 'client' | 'agent';
  message_type: string;
  content: Record<string, unknown>;
  signature: string | null;
  sent_at: Date;
  received_at: Date;
}

export interface SubmitTaskInput {
  transactionId: string;
  step: string;
  correlationId: string;
  submittedBy: string;
  assigneeHint?: string;
  data?: Record<string, unknown>;
  clientMessageBody: unknown; // raw for audit
  signatureHmac?: string;
  signatureTimestamp?: string;
}

function notifyTaskUpdate(task: TaskRow) {
  a2aEventEmitter.emit(`task:${task.id}`, task);
}

export async function submitTask(input: SubmitTaskInput): Promise<TaskRow> {
  // Validate transaction and step
  const { transaction } = await getTransactionWithEvents(input.transactionId);
  const flow = getFlow(transaction.type);
  if (!flow || !stepExists(flow, input.step)) {
    throw new DomainError('INVALID_STEP', `Step ${input.step} is invalid`, 400);
  }
  if (transaction.current_step !== input.step) {
    throw new DomainError('STEP_MISMATCH', `Cannot submit task for step ${input.step}, transaction is at ${transaction.current_step}`, 409);
  }

  // TODO: Add Signature Verification for financial steps here or at route level. 
  // It is handled by `verifyFinancialSignature` middleware in routes.ts which sets `auth.financiallySigned`.
  // We rely on route handler to reject if signature is missing for financial steps.

  return withTransaction(async (client) => {
    // Insert task
    const taskRes = await client.query<TaskRow>(
      `INSERT INTO a2a_tasks (
         transaction_id, step, state, submitted_by, assignee_hint, correlation_id
       ) VALUES ($1, $2, 'submitted', $3, $4, $5)
       RETURNING *`,
      [input.transactionId, input.step, input.submittedBy, input.assigneeHint || null, input.correlationId]
    );
    const task = taskRes.rows[0];
    if (!task) throw new Error('Failed to create task');

    // Insert first message
    await client.query(
      `INSERT INTO a2a_task_messages (
         task_id, seq, role, message_type, content, signature, sent_at
       ) VALUES ($1, 1, 'client', 'task.submit', $2, $3, $4)`,
      [
        task.id,
        JSON.stringify(input.clientMessageBody || {}),
        input.signatureHmac || null,
        input.signatureTimestamp ? new Date(Number(input.signatureTimestamp) * 1000) : new Date()
      ]
    );

    notifyTaskUpdate(task);
    txLogger(task.transaction_id).info({ taskId: task.id, step: task.step }, 'A2A Task submitted');
    return task;
  });
}

export async function getTaskWithMessages(taskId: string): Promise<{ task: TaskRow; messages: TaskMessageRow[] }> {
  const taskRes = await query<TaskRow>('SELECT * FROM a2a_tasks WHERE id = $1', [taskId]);
  const task = taskRes.rows[0];
  if (!task) throw new DomainError('TASK_NOT_FOUND', 'Task not found', 404);

  const msgRes = await query<TaskMessageRow>(
    'SELECT * FROM a2a_task_messages WHERE task_id = $1 ORDER BY seq ASC',
    [taskId]
  );
  
  return { task, messages: msgRes.rows };
}

async function appendMessageAndState(
  taskId: string, 
  newState: TaskState, 
  role: 'client' | 'agent',
  messageType: string,
  content: Record<string, unknown>,
  updates: Partial<TaskRow> = {}
): Promise<TaskRow> {
  return withTransaction(async (client) => {
    // Lock task
    const taskRes = await client.query<TaskRow>('SELECT * FROM a2a_tasks WHERE id = $1 FOR UPDATE', [taskId]);
    const task = taskRes.rows[0];
    if (!task) throw new DomainError('TASK_NOT_FOUND', 'Task not found', 404);
    
    if (['completed', 'failed', 'canceled'].includes(task.state)) {
      throw new DomainError('TASK_TERMINAL', `Task is already in terminal state: ${task.state}`, 409);
    }

    // Check valid transitions
    if (newState === 'input_required' && task.state !== 'working') {
        throw new DomainError('INVALID_STATE', `Cannot move to input_required from ${task.state}`, 409);
    }

    // Get max seq
    const seqRes = await client.query<{max: number}>('SELECT COALESCE(MAX(seq), 0) as max FROM a2a_task_messages WHERE task_id = $1', [taskId]);
    const nextSeq = seqRes.rows[0]!.max + 1;

    // Build update query dynamically
    const updateKeys = Object.keys(updates);
    let updateSql = `UPDATE a2a_tasks SET state = $1, updated_at = NOW()`;
    const params: any[] = [newState, taskId];
    
    updateKeys.forEach((k, idx) => {
      params.push(updates[k as keyof TaskRow]);
      updateSql += `, ${k} = $${params.length}`;
    });
    updateSql += ` WHERE id = $2 RETURNING *`;

    const updRes = await client.query<TaskRow>(updateSql, params);
    const updatedTask = updRes.rows[0]!;

    await client.query(
      `INSERT INTO a2a_task_messages (task_id, seq, role, message_type, content, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [taskId, nextSeq, role, messageType, JSON.stringify(content)]
    );

    notifyTaskUpdate(updatedTask);
    return updatedTask;
  });
}

export async function cancelTask(taskId: string, actor: string, reason: string): Promise<TaskRow> {
  return appendMessageAndState(taskId, 'canceled', 'client', 'task.cancel', { reason, actor }, { fail_reason: reason });
}

export async function provideInput(taskId: string, actor: string, data: Record<string, unknown>): Promise<TaskRow> {
  // Move back to working
  return appendMessageAndState(taskId, 'working', 'client', 'task.provideInput', { ...data, actor });
}

export async function markTaskWorking(taskId: string, agentSubject: string): Promise<void> {
  await appendMessageAndState(taskId, 'working', 'agent', 'task.progress', { agentSubject });
}

export async function markTaskInputRequired(taskId: string, msg: string): Promise<void> {
  await appendMessageAndState(taskId, 'input_required', 'agent', 'task.input', { msg }, { input_required_msg: msg });
}

export async function markTaskFailed(taskId: string, reason: string): Promise<TaskRow> {
  return appendMessageAndState(taskId, 'failed', 'agent', 'task.fail', { reason }, { fail_reason: reason });
}

export async function markTaskCompleted(
  taskId: string, 
  resultData: Record<string, unknown>,
  auth: { companyId: string; allowedTypes: string[] | null; robotName: string; serviceAccountId: string; financiallySigned: boolean }
): Promise<TaskRow> {
  const task = await appendMessageAndState(taskId, 'completed', 'agent', 'task.complete', { resultData }, { result_data: resultData });
  
  // Trigger LC state machine to move forward
  // This abstracts away the need for the agent to manually complete the step
  const { computeHandoffAfterTaskCompletion } = await import('../orchestrator/engine.js');
  await computeHandoffAfterTaskCompletion(auth, task.transaction_id, task.id, task.step, task.correlation_id, resultData);
  
  return task;
}

export async function watchTask(
  taskId: string,
  onUpdate: (task: TaskRow) => void,
  signal: AbortSignal,
): Promise<void> {
  const eventName = `task:${taskId}`;
  const listener = (task: TaskRow) => onUpdate(task);
  
  a2aEventEmitter.on(eventName, listener);
  
  signal.addEventListener('abort', () => {
    a2aEventEmitter.off(eventName, listener);
  });
  
  // Send current state immediately
  try {
    const { task } = await getTaskWithMessages(taskId);
    onUpdate(task);
  } catch (e) {
    // Task might not exist yet or deleted, just wait for events
  }
}
