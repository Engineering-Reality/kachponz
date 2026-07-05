/**
 * Step flow config — graph urutan step per `type` transaksi.
 * Data-driven, BUKAN hardcoded di logic/test.
 *
 * Sumber kebenaran alur settlement Import LC/SKBDN/SBLC (lihat diagram
 * "Proses Transaksi Import - Settlement" & "Usulan Agentic AI New UI Path").
 *
 * Setiap step menandai:
 *  - next: step-step yang boleh diproses SETELAH step ini selesai (maju).
 *  - financial: true bila penyelesaian step ini menyentuh instruksi
 *    pembayaran/SWIFT dan WAJIB signature layer (CISO API #2).
 *  - actorHint: robot/agent tipikal yang mengeksekusi (informasional; auth
 *    tetap by service account, bukan by hint ini).
 */

export interface StepDef {
  readonly next: readonly string[];
  readonly financial?: boolean;
  readonly actorHint?: string;
  readonly terminal?: boolean;
}

export interface StepFlow {
  readonly initial: string;
  readonly steps: Readonly<Record<string, StepDef>>;
}

/**
 * import_lc:
 * submitted → distributed_to_analyst → doc_examined → ee_ntf_created
 *   → ee_ntf_approved → mt_converted → swift_released → settled → advised
 */
const import_lc: StepFlow = {
  initial: 'submitted',
  steps: {
    submitted: { next: ['distributed_to_analyst'], actorHint: 'contact_point' },
    distributed_to_analyst: { next: ['doc_examined'], actorHint: 'rpa_distributor' },
    doc_examined: { next: ['ee_ntf_created', 'distributed_to_analyst'], actorHint: 'analyst_or_agent' },
    ee_ntf_created: { next: ['ee_ntf_approved'], actorHint: 'maker_agent' },
    ee_ntf_approved: { next: ['mt_converted'], actorHint: 'checker_human' },
    mt_converted: { next: ['swift_released'], financial: true, actorHint: 'rpa_mt_converter' },
    swift_released: { next: ['settled'], financial: true, actorHint: 'saa_gateway' },
    settled: { next: ['advised'], financial: true, actorHint: 'settlement_engine' },
    advised: { next: [], terminal: true, actorHint: 'kopra_notify' },
  },
};

/**
 * skbdn dan sblc berbagi bentuk alur yang sama dengan import_lc pada MVP ini.
 * Dipisah sebagai entri sendiri supaya bisa berdivergensi tanpa mengubah kode.
 */
const skbdn: StepFlow = import_lc;
const sblc: StepFlow = import_lc;

export const STEP_FLOWS: Readonly<Record<string, StepFlow>> = {
  import_lc,
  skbdn,
  sblc,
};

export type TransactionType = keyof typeof STEP_FLOWS;

export function getFlow(type: string): StepFlow | undefined {
  return STEP_FLOWS[type];
}

export function isKnownType(type: string): type is TransactionType {
  return Object.prototype.hasOwnProperty.call(STEP_FLOWS, type);
}

/** Apakah `to` adalah transisi MAJU yang sah dari `from` dalam flow tsb. */
export function isForwardTransition(flow: StepFlow, from: string, to: string): boolean {
  const def = flow.steps[from];
  if (!def) return false;
  return def.next.includes(to);
}

/** Apakah step menyentuh instruksi finansial (butuh signature layer). */
export function isFinancialStep(flow: StepFlow, step: string): boolean {
  return flow.steps[step]?.financial === true;
}

/** Semua step valid dalam flow (untuk validasi keberadaan step). */
export function stepExists(flow: StepFlow, step: string): boolean {
  return Object.prototype.hasOwnProperty.call(flow.steps, step);
}

/**
 * Urutan linear step (index) — dipakai untuk menentukan apakah sebuah transisi
 * bersifat MUNDUR (butuh `reason` eksplisit). Dibangun dari graph, bukan
 * daftar terpisah, supaya tidak pernah out-of-sync.
 */
export function linearOrder(flow: StepFlow): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = flow.initial;
  while (cur && !seen.has(cur)) {
    order.push(cur);
    seen.add(cur);
    const nexts: readonly string[] = flow.steps[cur]?.next ?? [];
    cur = nexts[0]; // MVP: flow linear, ambil cabang utama
  }
  return order;
}

export function stepIndex(flow: StepFlow, step: string): number {
  return linearOrder(flow).indexOf(step);
}
