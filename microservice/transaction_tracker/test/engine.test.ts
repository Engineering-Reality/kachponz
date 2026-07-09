import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAgenticStep } from '../src/orchestrator/engine.js';
import * as transactions from '../src/services/transactions.js';
import * as pool from '../src/db/pool.js';

// Mock dependencies — same pattern as test/orchestrator.test.ts.
vi.mock('../src/services/transactions.js');
vi.mock('../src/db/pool.js');
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn(),
  })),
}));
vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      messages: [{ role: 'ai', content: 'Mocked LangGraph Response' }],
    }),
  })),
}));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'mock_tool', description: 'test' }] }),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] }),
    close: vi.fn(),
  })),
}));

const mockAuth = {
  companyId: 'company-1',
  serviceAccountId: 'svc-1',
  robotName: 'test-robot',
  financiallySigned: true,
  allowedTypes: ['test_flow'],
} as any;

describe('runAgenticStep — invocation mode semantics (bugfix1.md Bug 2)', () => {
  beforeEach(() => {
    // clearAllMocks (not restoreAllMocks): the module-level vi.mock() factory
    // implementations for createReactAgent/ChatOpenAI/Client aren't
    // vi.spyOn-based, so restoreAllMocks would wipe them back to bare
    // vi.fn() stubs after the first test that exercises them.
    vi.clearAllMocks();
  });

  it('Case A: playground mode with no transactionId never touches the transactions table', async () => {
    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM agents')) {
        return { rows: [{ agent_id: 'agent-1', model: 'gpt-4o', tools: ['tool-1'], agent_style: 'helpful' }] } as any;
      }
      if (sql.includes('FROM tools')) {
        return {
          rows: [{
            tool_id: 'tool-1',
            name: 'test_tool',
            on_status: 'Online',
            versions: '[{"released":{"method":"sse","command":"node","args":[]}}]',
          }],
        } as any;
      }
      if (sql.includes('FROM mcp_runtime_state')) {
        return { rows: [{ port: 19999, status: 'running' }] } as any;
      }
      throw new Error(`Unexpected query in playground mode: ${sql}`);
    });

    const result = await runAgenticStep(mockAuth, undefined, 'idem-1', 'hello', undefined, 'agent-1', 'playground');

    expect(result.accepted).toBe(true);
    expect(result.transactionId).toMatch(/^playground-/);
    expect(transactions.completeStep).not.toHaveBeenCalled();
    expect(transactions.failStep).not.toHaveBeenCalled();

    const calledSql = vi.mocked(pool.query).mock.calls.map((c) => String(c[0]));
    expect(calledSql.some((sql) => sql.includes('FROM transactions'))).toBe(false);
    expect(calledSql.some((sql) => sql.includes('INSERT INTO transactions'))).toBe(false);
  });

  it('Case B: production mode with an unknown transactionId is rejected before any agent/LLM invocation', async () => {
    vi.mocked(transactions.getTransactionWithEvents).mockRejectedValue(
      new Error('Transaksi tidak ditemukan'),
    );

    await expect(
      runAgenticStep(mockAuth, '52d5d8fa-3952-4c6e-8bba-529f1e43f03a', 'idem-2', 'hello', undefined, 'agent-1', 'production'),
    ).rejects.toMatchObject({ code: 'TRANSACTION_NOT_FOUND', httpStatus: 400 });

    const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
    expect(createReactAgent).not.toHaveBeenCalled();
    expect(transactions.completeStep).not.toHaveBeenCalled();
  });

  it('Case C: production mode with a valid transactionId completes the step exactly once', async () => {
    vi.mocked(transactions.getTransactionWithEvents).mockResolvedValue({
      transaction: {
        id: 'tx-1', type: 'test_flow', current_step: 'step1',
        status: 'in_progress', company_id: 'company-1', version: 1,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      events: [],
    });

    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM agents')) {
        return { rows: [{ agent_id: 'agent-1', model: 'gpt-4o', tools: [], agent_style: 'helpful' }] } as any;
      }
      return { rows: [] } as any;
    });

    vi.mocked(transactions.completeStep).mockResolvedValue({
      transaction: {
        id: 'tx-1', type: 'test_flow', current_step: 'step2',
        status: 'in_progress', company_id: 'company-1', version: 2,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      event: { id: 'evt-1' } as any,
      idempotentReplay: false,
    });
    const result = await runAgenticStep(mockAuth, 'tx-1', 'idem-3', 'hello', undefined, 'agent-1', 'production');

    expect(result.accepted).toBe(true);
    expect(transactions.completeStep).toHaveBeenCalledTimes(1);
  });
});

describe('runAgenticStep — MCP tool health / fail-loud semantics (bugfix1.md Bug 3)', () => {
  beforeEach(() => {
    // clearAllMocks (not restoreAllMocks): the module-level vi.mock() factory
    // implementations for createReactAgent/ChatOpenAI/Client aren't
    // vi.spyOn-based, so restoreAllMocks would wipe them back to bare
    // vi.fn() stubs after the first test that exercises them.
    vi.clearAllMocks();
  });

  it('throws NO_TOOLS_AVAILABLE (424) when every registered MCP server fails to connect', async () => {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    vi.mocked(Client).mockImplementation(() => ({
      connect: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      listTools: vi.fn(),
      callTool: vi.fn(),
      close: vi.fn(),
    }) as any);

    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM agents')) {
        return { rows: [{ agent_id: 'agent-1', tools: ['tool-1'], agent_style: 'helpful' }] } as any;
      }
      if (sql.includes('FROM tools')) {
        return {
          rows: [{
            tool_id: 'tool-1',
            name: 'broken_tool',
            on_status: 'Online',
            versions: '[{"released":{"method":"sse","command":"node","args":[]}}]',
          }],
        } as any;
      }
      if (sql.includes('FROM mcp_runtime_state')) {
        return { rows: [{ port: 19999, status: 'running' }] } as any;
      }
      return { rows: [] } as any;
    });

    await expect(
      runAgenticStep(mockAuth, undefined, 'idem-4', 'hello', undefined, 'agent-1', 'playground'),
    ).rejects.toMatchObject({ code: 'NO_TOOLS_AVAILABLE', httpStatus: 424 });
  }, 10000);
});
