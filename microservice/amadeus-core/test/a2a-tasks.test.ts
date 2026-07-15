import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { truncateAll, seedRobot, closeTestPool } from './helpers.js';
import { submitTask, getTaskWithMessages, markTaskWorking, markTaskCompleted, markTaskFailed, cancelTask, provideInput, markTaskInputRequired } from '../src/services/a2aTasks.js';
import { createTransaction } from '../src/services/transactions.js';

describe('a2aTasks Service', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('submitTask should create task and message', async () => {
    const robot = await seedRobot({ allowedTypes: ['import_lc'] });
    const tx = await createTransaction(robot.auth, { type: 'import_lc', idempotencyKey: 'test1' });
    
    const task = await submitTask({
      transactionId: tx.id,
      step: 'submitted',
      correlationId: 'corr1',
      submittedBy: robot.auth.serviceAccountId,
      clientMessageBody: { hello: 'world' }
    });

    expect(task.state).toBe('submitted');
    expect(task.step).toBe('submitted');

    const { messages } = await getTaskWithMessages(task.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.message_type).toBe('task.submit');
  });

  it('state transitions: submitted -> working -> input_required -> working -> completed', async () => {
    const robot = await seedRobot({ allowedTypes: ['import_lc'] });
    const tx = await createTransaction(robot.auth, { type: 'import_lc', idempotencyKey: 'test2' });
    
    let task = await submitTask({
      transactionId: tx.id,
      step: 'submitted',
      correlationId: 'corr2',
      submittedBy: robot.auth.serviceAccountId,
      clientMessageBody: {}
    });

    await markTaskWorking(task.id, robot.auth.serviceAccountId);
    task = (await getTaskWithMessages(task.id)).task;
    expect(task.state).toBe('working');

    await markTaskInputRequired(task.id, 'Need docs');
    task = (await getTaskWithMessages(task.id)).task;
    expect(task.state).toBe('input_required');
    expect(task.input_required_msg).toBe('Need docs');

    await provideInput(task.id, robot.auth.serviceAccountId, { doc: 'here' });
    task = (await getTaskWithMessages(task.id)).task;
    expect(task.state).toBe('working');

    await markTaskCompleted(task.id, { result: 'ok' }, robot.auth);
    task = (await getTaskWithMessages(task.id)).task;
    expect(task.state).toBe('completed');
    
    // Test terminal state error
    await expect(
      cancelTask(task.id, robot.auth.serviceAccountId, 'too late')
    ).rejects.toMatchObject({ code: 'TASK_TERMINAL' });
  });
  
  it('fail transition', async () => {
    const robot = await seedRobot({ allowedTypes: ['import_lc'] });
    const tx = await createTransaction(robot.auth, { type: 'import_lc', idempotencyKey: 'test3' });
    
    let task = await submitTask({
      transactionId: tx.id,
      step: 'submitted',
      correlationId: 'corr3',
      submittedBy: robot.auth.serviceAccountId,
      clientMessageBody: {}
    });

    await markTaskFailed(task.id, 'some error');
    task = (await getTaskWithMessages(task.id)).task;
    expect(task.state).toBe('failed');
    expect(task.fail_reason).toBe('some error');
  });
});
