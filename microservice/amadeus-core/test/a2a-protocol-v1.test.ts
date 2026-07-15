import { describe, it, expect } from 'vitest';
import { A2A_PROTOCOL_V1, A2A_ERROR } from '../src/orchestrator/a2a/protocol_v1.js';
import type { TaskState, JsonRpcRequest } from '../src/orchestrator/a2a/protocol_v1.js';

describe('A2A Protocol v1 Smoke Test', () => {
  it('constants should be exact strings', () => {
    expect(A2A_PROTOCOL_V1).toBe('amadeus.a2a/1');
    expect(A2A_ERROR.METHOD_NOT_FOUND).toBe(-32601);
  });

  it('types compile correctly', () => {
    // Just a type-level check
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: '1',
      method: 'task.submit',
      params: {}
    };
    expect(req.jsonrpc).toBe('2.0');
    
    const state: TaskState = 'working';
    expect(state).toBe('working');
  });
});
