import { z } from 'zod';
import { env } from '../../config/env.js';
import type { Agent, AgentContext, AgentOutcome } from './base.js';

const LlmResponseSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
  extractedFields: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Contoh agent AGENTIC: Document Examination.
 * Padanan "New RPA > Agentic AI" di diagram usulan:
 *   1. Scan aplikasi berformat image → format digital.
 *   2. Completion di sistem EE berdasarkan aplikasi yang telah dibaca.
 *
 * LLM/VLM invocation SENGAJA belum diisi: konteks air-gapped, pilihan model &
 * deployment adalah keputusan terpisah. Di sini kita sediakan slot yang jelas
 * plus jalur deterministik fallback, agar orchestrator bisa diuji end-to-end
 * tanpa model.
 */
export const docExamAgent: Agent = {
  descriptor: {
    id: 'agent.doc_exam.v0',
    displayName: 'Document Examination Agent (agentic)',
    agentic: true,
    capabilities: [
      { step: 'doc_examined', types: ['import_lc', 'skbdn', 'sblc'], financial: false },
    ],
  },

  async handle(ctx: AgentContext): Promise<AgentOutcome> {
    const imageRef = (ctx.data?.imageRef as string | undefined) ?? null;
    if (!imageRef) {
      return { completed: false, reason: 'imageRef dokumen tidak tersedia untuk pemeriksaan' };
    }

    // ── SLOT LLM/VLM (air-gapped) ─────────────────────────────────────────
    if (env.AGENT_LLM_URL) {
      try {
        const res = await fetch(env.AGENT_LLM_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Bertindak sebagai analis Trade Finance. Periksa kelengkapan dokumen referensi: ${imageRef}. Kembalikan JSON murni dengan skema: {"approved": true/false, "reason": "alasan jika false", "extractedFields": {}}`,
            imageRef,
          }),
        });

        if (!res.ok) {
          throw new Error(`LLM API HTTP error: ${res.status}`);
        }
        
        const rawBody = await res.json();
        // CISO Requirement: Validasi ketat response dari agent external (LLM) dengan Zod
        const parsed = LlmResponseSchema.safeParse(rawBody);
        
        if (!parsed.success) {
           return {
             completed: false, // Jangan maju/mundur, anggap task gagal untuk di-retry
             reason: `LLM mengembalikan struktur data invalid: ${parsed.error.message}`,
           };
        }

        const llm = parsed.data;

        if (llm.approved) {
           return {
             completed: true,
             resultData: { examinedBy: 'agent.doc_exam.v1', imageRef, mode: 'llm', fields: llm.extractedFields },
           };
        } else {
           // Transisi mundur eksplisit!
           return {
             completed: true,
             targetStep: 'distributed_to_analyst',
             reason: llm.reason || 'Ditolak oleh agen VLM tanpa alasan.',
             resultData: { examinedBy: 'agent.doc_exam.v1', imageRef, mode: 'llm', rejected: true },
           };
        }
      } catch (err: unknown) {
        return {
          completed: false,
          reason: `Gagal memanggil endpoint LLM air-gapped: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // ── FALLBACK DETERMINISTIK ───────────────────────────────────────────
    if (imageRef.includes('REJECT')) {
      return {
        completed: true,
        targetStep: 'distributed_to_analyst',
        reason: 'Simulasi penolakan dokumen (terdapat REJECT pada nama file)',
        resultData: { examinedBy: 'agent.doc_exam.v0', imageRef, mode: 'fallback-reject' },
      };
    }

    return {
      completed: true,
      resultData: {
        examinedBy: 'agent.doc_exam.v0',
        imageRef,
        extractionMode: 'deterministic-stub',
        note: 'Dokumen dianggap valid secara deterministik',
      },
    };
  },
};
