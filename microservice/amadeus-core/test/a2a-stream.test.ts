import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { truncateAll, seedRobot, closeTestPool } from './helpers.js';
import { submitTask, markTaskWorking, watchTask } from '../src/services/a2aTasks.js';
import { createTransaction } from '../src/services/transactions.js';

describe('A2A Stream (EventEmitter)', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('watchTask should receive updates', async () => {
    const robot = await seedRobot({ allowedTypes: ['import_lc'] });
    const tx = await createTransaction(robot.auth, { type: 'import_lc', idempotencyKey: 's1' });
    
    const task = await submitTask({
      transactionId: tx.id,
      step: 'submitted',
      correlationId: 'c1',
      submittedBy: robot.auth.serviceAccountId,
      clientMessageBody: {}
    });

    const ac = new AbortController();
    const updates: any[] = [];
    
    await watchTask(task.id, (t) => {
      updates.push(t);
    }, ac.signal);

    // First update should be initial state
    expect(updates).toHaveLength(1);
    expect(updates[0].state).toBe('submitted');

    // Trigger update
    await markTaskWorking(task.id, robot.auth.serviceAccountId);

    // Need to yield to event loop
    await new Promise(r => setTimeout(r, 50));

    expect(updates).toHaveLength(2);
    expect(updates[1].state).toBe('working');

    // Abort
    ac.abort();

    await markTaskWorking(task.id, robot.auth.serviceAccountId); // some other update
    await new Promise(r => setTimeout(r, 50));

    // Should not receive further updates
    expect(updates).toHaveLength(2);
  });
});
