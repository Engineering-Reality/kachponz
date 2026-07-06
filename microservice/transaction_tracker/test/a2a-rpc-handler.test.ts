import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { truncateAll, seedRobot, closeTestPool } from './helpers.js';
import { handleRpc } from '../src/orchestrator/a2a/rpcHandler.js';
import { createTransaction } from '../src/services/transactions.js';
import type { JsonRpcRequest } from '../src/orchestrator/a2a/protocol_v1.js';

describe('RPC Handler', () => {
  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('method not found', async () => {
    const robot = await seedRobot();
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: '1', method: 'unknown' as any, params: {} };
    const res = await handleRpc(req, robot.auth, JSON.stringify(req));
    expect('error' in res && res.error.code).toBe(-32601);
  });

  it('task.submit and task.get success', async () => {
    const robot = await seedRobot({ allowedTypes: ['import_lc'] });
    const tx = await createTransaction(robot.auth, { type: 'import_lc', idempotencyKey: 't1' });
    
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: '2',
      method: 'task.submit',
      params: {
        transactionId: tx.id,
        step: 'submitted',
        correlationId: 'c1'
      }
    };
    
    const res = await handleRpc(req, robot.auth, JSON.stringify(req));
    expect('result' in res).toBeTruthy();
    const taskId = (res as any).result.taskId;
    expect(taskId).toBeTruthy();

    const reqGet: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: '3',
      method: 'task.get',
      params: { taskId }
    };
    
    const resGet = await handleRpc(reqGet, robot.auth, JSON.stringify(reqGet));
    expect('result' in resGet).toBeTruthy();
    expect((resGet as any).result.state).toBe('submitted');
    expect((resGet as any).result.messages).toHaveLength(1);
  });

  it('task.cancel terminal error', async () => {
    const robot = await seedRobot({ allowedTypes: ['import_lc'] });
    const tx = await createTransaction(robot.auth, { type: 'import_lc', idempotencyKey: 't2' });
    
    const reqSubmit: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: '4',
      method: 'task.submit',
      params: { transactionId: tx.id, step: 'submitted', correlationId: 'c2' }
    };
    const resSubmit = await handleRpc(reqSubmit, robot.auth, JSON.stringify(reqSubmit));
    const taskId = (resSubmit as any).result.taskId;

    const reqCancel: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: '5',
      method: 'task.cancel',
      params: { taskId, reason: 'test cancel' }
    };
    const resCancel = await handleRpc(reqCancel, robot.auth, JSON.stringify(reqCancel));
    expect('result' in resCancel).toBeTruthy();
    expect((resCancel as any).result.state).toBe('canceled');

    // Try cancel again
    const resCancel2 = await handleRpc(reqCancel, robot.auth, JSON.stringify(reqCancel));
    expect('error' in resCancel2 && resCancel2.error.code).toBe(-32002);
  });
});
