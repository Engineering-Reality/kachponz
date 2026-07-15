import type { AgentDescriptor } from '../a2a/protocol.js';

/**
 * Kontrak agent. Dua jenis:
 *  - RPA deterministik (UiPath/PAD): biasanya TIDAK memanggil handle() di server;
 *    mereka lapor via HTTP A2A endpoint. Descriptor-nya tetap didaftarkan agar
 *    orchestrator tahu siapa memegang step apa (routing/nextActorHint).
 *  - Agentic (LLM/tooling): handle() dijalankan IN-PROCESS oleh orchestrator
 *    (mis. "New RPA > Agentic AI" di diagram: scan image → completion di EE).
 *
 * handle() sengaja dibuat opsional: agent yang murni eksternal cukup deklaratif.
 */
export interface AgentContext {
  transactionId: string;
  step: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface AgentOutcome {
  /** apakah step berhasil diselesaikan agent. */
  completed: boolean;
  reason?: string;
  /** target step eksplisit bila agent melakukan transisi cabang/mundur (mis. reject). */
  targetStep?: string;
  /** data hasil untuk disimpan ke payload event. */
  resultData?: Record<string, unknown>;
}

export interface Agent {
  descriptor: AgentDescriptor;
  /** Dijalankan in-process untuk agent agentic. Opsional. */
  handle?(ctx: AgentContext): Promise<AgentOutcome>;
}

/** Registry sederhana in-memory. Untuk sandbox CLI & orchestrator. */
export class AgentRegistry {
  private byId = new Map<string, Agent>();

  register(agent: Agent): void {
    if (this.byId.has(agent.descriptor.id)) {
      throw new Error(`agent sudah terdaftar: ${agent.descriptor.id}`);
    }
    this.byId.set(agent.descriptor.id, agent);
  }

  get(id: string): Agent | undefined {
    return this.byId.get(id);
  }

  all(): Agent[] {
    return [...this.byId.values()];
  }

  /** Cari agent yang bisa menangani step+type tertentu. */
  findForStep(step: string, type: string): Agent | undefined {
    return this.all().find((a) =>
      a.descriptor.capabilities.some((c) => c.step === step && c.types.includes(type)),
    );
  }
}

export const registry = new AgentRegistry();
