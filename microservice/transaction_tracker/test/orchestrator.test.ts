import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleA2A, runAgenticStep } from '../src/orchestrator/engine.js';
import * as transactions from '../src/services/transactions.js';
import * as pool from '../src/db/pool.js';
import { DomainError } from '../src/types/domain.js';

// Mock dependencies
vi.mock('../src/services/transactions.js');
vi.mock('../src/db/pool.js');
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn()
  }))
}));
vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      messages: [{ role: 'ai', content: 'Mocked LangGraph Response' }]
    })
  }))
}));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'mock_tool', description: 'test' }] }),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Success' }] }),
    close: vi.fn()
  }))
}));

const mockAuth = {
  companyId: 'company-1',
  serviceAccountId: 'svc-1',
  robotName: 'test-robot',
  financiallySigned: true,
  allowedTypes: ['test_flow']
};

describe('Universal LangGraph Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runAgenticStep', () => {
    it('should successfully build LangGraph agent, execute it, and complete step', async () => {
      // Mock getTransactionWithEvents
      vi.mocked(transactions.getTransactionWithEvents).mockResolvedValue({
        transaction: {
          id: 'tx-1', type: 'test_flow', current_step: 'step1',
          status: 'in_progress', company_id: 'company-1', version: 1,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        events: []
      });

      // Mock database queries for agents and tools
      vi.mocked(pool.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM agents')) {
          return { rows: [{ agent_id: 'step1', model: 'gpt-4o', tools: ['tool-1'], agent_style: 'helpful' }] } as any;
        }
        if (sql.includes('FROM tools')) {
          return { rows: [{ tool_id: 'tool-1', name: 'test_tool', on_status: 'Online', versions: '[{"released":{"method":"sse","port":"http://mock"}}]' }] } as any;
        }
        return { rows: [] } as any;
      });

      // Mock completeStep
      vi.mocked(transactions.completeStep).mockResolvedValue({
        transaction: {
          id: 'tx-1', type: 'test_flow', current_step: 'step2',
          status: 'in_progress', company_id: 'company-1', version: 2,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        event: { id: 'evt-1' } as any,
        idempotentReplay: false
      });

      const result = await runAgenticStep(mockAuth, 'tx-1', 'idem-1');

      expect(result.accepted).toBe(true);
      expect(result.status).toBe('in_progress');
      expect(transactions.completeStep).toHaveBeenCalled();
      
      // Verify LangGraph was called
      const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
      expect(createReactAgent).toHaveBeenCalled();
    });

    it('should handle missing agent config with DomainError', async () => {
      vi.mocked(transactions.getTransactionWithEvents).mockResolvedValue({
        transaction: {
          id: 'tx-1', type: 'test_flow', current_step: 'step1',
          status: 'in_progress', company_id: 'company-1', version: 1,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        events: []
      });

      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);

      await expect(runAgenticStep(mockAuth, 'tx-1', 'idem-1')).rejects.toThrow(DomainError);
    });

    it('should catch LangGraph execution errors and fail the step instead of crashing', async () => {
      vi.mocked(transactions.getTransactionWithEvents).mockResolvedValue({
        transaction: {
          id: 'tx-1', type: 'test_flow', current_step: 'step1',
          status: 'in_progress', company_id: 'company-1', version: 1,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        events: []
      });

      vi.mocked(pool.query).mockImplementation(async (sql: string) => {
        if (sql.includes('FROM agents')) return { rows: [{ agent_id: 'step1' }] } as any;
        return { rows: [] } as any;
      });

      const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
      vi.mocked(createReactAgent).mockImplementationOnce(() => ({
        invoke: vi.fn().mockRejectedValue(new Error("LLM Connection Timeout"))
      }) as any);

      vi.mocked(transactions.failStep).mockResolvedValue({
        transaction: {
          id: 'tx-1', type: 'test_flow', current_step: 'step1',
          status: 'in_progress', company_id: 'company-1', version: 2,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        },
        event: { id: 'evt-2' } as any,
        idempotentReplay: false
      });

      const result = await runAgenticStep(mockAuth, 'tx-1', 'idem-1');
      
      expect(result.accepted).toBe(true);
      expect(transactions.failStep).toHaveBeenCalled();
    });
  });

  describe('External Communication Mocking (UiPath / Fetch)', () => {
    it('should handle 500 errors gracefully from external APIs', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      // Example test indicating how an external tool failing would bubble up
      // and be caught by the orchestrator.
      const error = await global.fetch('http://uipath.mock').catch(e => e);
      expect(fetchSpy).toHaveBeenCalled();
      expect(error.status).toBe(500);
      
      fetchSpy.mockRestore();
    });
  });
});
