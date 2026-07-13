/**
 * Executor abstraction — meta-orchestrator layer di atas Agent lama.
 *
 * Tujuan: satu kontrak untuk 3 jenis executor yang bisa menyelesaikan step:
 *   - kind='llm'    → agent LLM/VLM in-process (Qwen VL untuk scan LC, dll)
 *   - kind='uipath' → UiPath robot dispatch via UiPath Orchestrator Jobs API
 *   - kind='pad'    → Power Automate Desktop dispatch via HTTP trigger flow
 *
 * Strategi: setiap Executor punya `run(ctx)` yang mengembalikan outcome
 * yang seragam. Cost-router memilih executor mana yang mengambil step
 * berdasarkan konfigurasi (executorMap.ts).
 *
 * PENTING — semantik penyelesaian step:
 *  - LLM executor menyelesaikan step SECARA SINKRON (in-process). Setelah
 *    run() return completed, engine langsung memajukan state tracker.
 *  - UiPath/PAD executor menyelesaikan step SECARA ASYNC (fire-and-track).
 *    run() hanya men-dispatch job; robot yang mengirim task.complete via A2A
 *    saat selesai. Outcome-nya "dispatched", bukan "completed".
 */

export type ExecutorKind = 'llm' | 'uipath' | 'pad';

export interface ExecutorContext {
  transactionId: string;
  step: string;
  type: string;
  /** Payload domain (mis. imageRef LC, referensi dokumen, dll). */
  data?: Record<string, unknown>;
}

export type ExecutorOutcome =
  | {
      /** Selesai in-process — engine langsung memajukan state. */
      kind: 'completed';
      resultData?: Record<string, unknown>;
    }
  | {
      /** Job dilempar ke executor eksternal — robot yang akan lapor via A2A. */
      kind: 'dispatched';
      externalJobId?: string;
      resultData?: Record<string, unknown>;
    }
  | {
      kind: 'failed';
      reason: string;
      resultData?: Record<string, unknown>;
    }
  | {
      /** Executor actively declined to dispatch (e.g. auth rejected) — distinct
       * from `failed` so callers can tell "we tried and it broke" from "we
       * refused to even try". Never counts as a successful dispatch. */
      kind: 'refused';
      reason: string;
      resultData?: Record<string, unknown>;
    };

export interface ExecutorCapability {
  /** step yang bisa ditangani executor ini. */
  step: string;
  /** tipe transaksi yang didukung. */
  types: string[];
  /** apakah step ini finansial. */
  financial: boolean;
}

export interface ExecutorDescriptor {
  id: string;
  displayName: string;
  kind: ExecutorKind;
  capabilities: ExecutorCapability[];
  /**
   * Estimasi cost relatif per invocation (unit arbitrary — bank internal).
   * Dipakai router untuk memilih executor termurah bila multiple cocok.
   * Panduan kasar:
   *   uipath  ~ 100 (mahal, license runtime)
   *   pad     ~ 10  (jauh lebih murah)
   *   llm     ~ 1-5 (paling murah per-run, tergantung model)
   */
  costUnit: number;
}

export interface Executor {
  descriptor: ExecutorDescriptor;
  run(ctx: ExecutorContext): Promise<ExecutorOutcome>;
}

/** Registry in-memory untuk executors. Terpisah dari registry Agent lama. */
export class ExecutorRegistry {
  private byId = new Map<string, Executor>();

  register(exec: Executor): void {
    if (this.byId.has(exec.descriptor.id)) {
      throw new Error(`executor sudah terdaftar: ${exec.descriptor.id}`);
    }
    this.byId.set(exec.descriptor.id, exec);
  }

  get(id: string): Executor | undefined {
    return this.byId.get(id);
  }

  all(): Executor[] {
    return [...this.byId.values()];
  }

  /** Semua executor yang bisa menangani (step, type). */
  findForStep(step: string, type: string): Executor[] {
    return this.all().filter((e) =>
      e.descriptor.capabilities.some((c) => c.step === step && c.types.includes(type)),
    );
  }
}

export const executorRegistry = new ExecutorRegistry();
