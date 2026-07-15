import { describe, it, expect, vi, afterEach } from 'vitest';
import { docExamAgent } from '../src/orchestrator/agents/docExamAgent.js';
import { env } from '../src/config/env.js';

describe('docExamAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gagal bila tidak ada imageRef', async () => {
    const outcome = await docExamAgent.handle!({
      transactionId: '123',
      step: 'doc_examined',
      type: 'import_lc',
      data: {},
    });
    expect(outcome.completed).toBe(false);
    expect(outcome.reason).toMatch(/imageRef/);
  });

  describe('Fallback Deterministik', () => {
    it('mengembalikan dokumen REJECT ke distributed_to_analyst dengan reason', async () => {
      const outcome = await docExamAgent.handle!({
        transactionId: '123',
        step: 'doc_examined',
        type: 'import_lc',
        data: { imageRef: 'dokumen_palsu_REJECT.pdf' },
      });
      expect(outcome.completed).toBe(true);
      expect(outcome.targetStep).toBe('distributed_to_analyst');
      expect(outcome.reason).toMatch(/REJECT/);
    });

    it('menyetujui dokumen normal (maju ke langkah selanjutnya)', async () => {
      const outcome = await docExamAgent.handle!({
        transactionId: '123',
        step: 'doc_examined',
        type: 'import_lc',
        data: { imageRef: 'dokumen_asli.pdf' },
      });
      expect(outcome.completed).toBe(true);
      expect(outcome.targetStep).toBeUndefined(); // Lanjut maju normal
    });
  });

  describe('Air-gapped LLM Mode', () => {
    it('memanggil fetch ke AGENT_LLM_URL dan memproses penolakan LLM', async () => {
      env.AGENT_LLM_URL = 'http://localhost:11434/api/generate';
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approved: false,
          reason: 'Tanda tangan pemohon tidak cocok',
          extractedFields: {},
        }),
      });
      global.fetch = mockFetch;

      const outcome = await docExamAgent.handle!({
        transactionId: '123',
        step: 'doc_examined',
        type: 'import_lc',
        data: { imageRef: 'berkas.pdf' },
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(outcome.completed).toBe(true);
      expect(outcome.targetStep).toBe('distributed_to_analyst');
      expect(outcome.reason).toBe('Tanda tangan pemohon tidak cocok');
      
      // Reset env
      env.AGENT_LLM_URL = undefined;
    });
    
    it('menganggap tidak completed bila JSON tidak sesuai Zod schema (hallucination)', async () => {
      env.AGENT_LLM_URL = 'http://localhost:11434/api/generate';
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // schema mengharuskan 'approved' boolean, ini dikembalikan sebagai string
          approved: 'YA TENTU SAJA', 
        }),
      });
      global.fetch = mockFetch;

      const outcome = await docExamAgent.handle!({
        transactionId: '123',
        step: 'doc_examined',
        type: 'import_lc',
        data: { imageRef: 'berkas.pdf' },
      });

      expect(outcome.completed).toBe(false);
      expect(outcome.reason).toMatch(/invalid/i);
      
      env.AGENT_LLM_URL = undefined;
    });
  });
});
