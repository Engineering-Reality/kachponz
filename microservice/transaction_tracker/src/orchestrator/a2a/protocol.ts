/**
 * Amadeus A2A (Agent-to-Agent) Protocol — v0.
 *
 * Tujuan: robot UiPath / PAD / agent internal berkoordinasi lewat papan skor
 * transaksi (state tracker) sebagai SATU sumber kebenaran, menggantikan handoff
 * email manual di alur settlement Import LC/SKBDN/SBLC.
 *
 * Prinsip desain:
 *  - Setiap handoff = penyelesaian sebuah step yang MEMICU step berikutnya untuk
 *    agent lain. State tracker (Layer 1) yang jadi wasit sah/tidaknya transisi.
 *  - Message envelope netral-transport (HTTP/JSON) supaya UiPath (C#/.NET) dan
 *    PAD cukup pakai HTTP Request activity — tidak perlu SDK khusus.
 *  - Identitas pengirim = service account (bukan hint). Auth di Layer 1.
 *
 * Ini SENGAJA minimal & selaras semangat protokol A2A publik (task, message,
 * artifact) tapi disempitkan ke domain settlement + air-gapped, tanpa dependency
 * eksternal.
 */

export type A2AMessageType =
  | 'task.assign' // koordinator menugaskan step ke agent
  | 'task.complete' // agent melapor step selesai (memicu handoff)
  | 'task.failed' // agent gagal; sertakan reason
  | 'task.status'; // query status

export interface A2AEnvelope<T = Record<string, unknown>> {
  /** Versi protokol untuk negosiasi ke depan. */
  protocol: 'amadeus.a2a/0';
  type: A2AMessageType;
  /** id transaksi di state tracker yang jadi konteks. */
  transactionId: string;
  /** step yang dimaksud (yang ditugaskan/diselesaikan/gagal). */
  step: string;
  /** idempotency untuk exactly-once handoff. */
  idempotencyKey: string;
  /** korelasi lintas message dalam satu percakapan handoff. */
  correlationId: string;
  /** reason wajib untuk task.failed dan transisi mundur. */
  reason?: string;
  /** target step eksplisit untuk transisi bercabang/mundur. */
  targetStep?: string;
  /** muatan domain (mis. ringkasan hasil doc exam, nomor referensi SWIFT). */
  data?: T;
  /** timestamp ISO pengirim. */
  sentAt: string;
}

export interface A2AResult {
  accepted: boolean;
  transactionId: string;
  currentStep: string;
  status: string;
  /** step berikutnya yang kini terbuka untuk agent lain (bila ada). */
  nextStep: string | null;
  /** siapa (hint) yang diharapkan mengambil nextStep. */
  nextActorHint: string | null;
  idempotentReplay: boolean;
}

export interface AgentCapability {
  /** step yang bisa ditangani agent ini. */
  step: string;
  /** tipe transaksi yang didukung. */
  types: string[];
  /** apakah step ini finansial (butuh signature). */
  financial: boolean;
}

export interface AgentDescriptor {
  id: string;
  displayName: string;
  capabilities: AgentCapability[];
  /** true untuk agent LLM/agentic; false untuk robot deterministik (RPA). */
  agentic: boolean;
}
