/**
 * Wiring executor untuk alur settlement Import LC / SKBDN / SBLC.
 *
 * File ini adalah SATU-SATUNYA tempat kamu memutuskan siapa mengerjakan step
 * mana. Pindahkan step antar executor di sini — tidak perlu sentuh kode
 * aplikasi lain.
 *
 * Alur (sesuai stepFlows.ts):
 *   submitted → distributed_to_analyst → doc_examined
 *     → ee_ntf_created → ee_ntf_approved
 *     → mt_converted → swift_released → settled → advised
 *
 * Strategi biaya (usulan awal — sesuaikan setelah diskusi tim):
 *   - submitted             : Contact Point (manusia via portal) — TIDAK ada executor otomatis
 *   - distributed_to_analyst: PAD (murah — cukup baca queue TSC & assign)
 *   - doc_examined          : Qwen VL (LLM — paling murah, agentic AI)
 *   - ee_ntf_created        : PAD (form filling di EE — pola CRUD sederhana)
 *   - ee_ntf_approved       : manusia (checker) — TIDAK ada executor otomatis
 *   - mt_converted          : UiPath (integrasi EE + MT converter legacy)
 *   - swift_released        : UiPath (integrasi SAA — WAJIB UiPath)
 *   - settled               : UiPath (settlement engine)
 *   - advised               : PAD (kirim notifikasi via KOPRA — sederhana)
 */

import { executorRegistry } from './base.js';
import { qwenDocExamExecutor } from './qwenDocExamExecutor.js';
import { makeUipathExecutor } from './uipathExecutor.js';
import { makePadExecutor } from './padExecutor.js';

let registered = false;

/** Panggil sekali saat startup (dari server.ts) atau saat load routes. */
export function registerDefaultExecutors(): void {
  if (registered) return;
  registered = true;

  // ── LLM / Agentic AI ──────────────────────────────────────────────────
  executorRegistry.register(qwenDocExamExecutor);

  // ── PAD (murah) ───────────────────────────────────────────────────────
  executorRegistry.register(
    makePadExecutor({
      id: 'executor.pad.distribute',
      displayName: 'PAD — Distribute to Analyst',
      step: 'distributed_to_analyst',
      types: ['import_lc', 'skbdn', 'sblc'],
      financial: false,
      flowName: 'Amadeus.DistributeToAnalyst',
    }),
  );
  executorRegistry.register(
    makePadExecutor({
      id: 'executor.pad.ee_create',
      displayName: 'PAD — Create EE/NTF Entry',
      step: 'ee_ntf_created',
      types: ['import_lc', 'skbdn', 'sblc'],
      financial: false,
      flowName: 'Amadeus.EE.CreateNTF',
    }),
  );
  executorRegistry.register(
    makePadExecutor({
      id: 'executor.pad.advise',
      displayName: 'PAD — Advise via KOPRA',
      step: 'advised',
      types: ['import_lc', 'skbdn', 'sblc'],
      financial: false,
      flowName: 'Amadeus.KOPRA.Advise',
    }),
  );

  // ── UiPath (mahal, sistem legacy — WAJIB) ─────────────────────────────
  executorRegistry.register(
    makeUipathExecutor({
      id: 'executor.uipath.mt_convert',
      displayName: 'UiPath — MT Converter (MT103 / MX)',
      step: 'mt_converted',
      types: ['import_lc', 'skbdn', 'sblc'],
      financial: true,
    }),
  );
  executorRegistry.register(
    makeUipathExecutor({
      id: 'executor.uipath.swift_release',
      displayName: 'UiPath — SWIFT Release via SAA',
      step: 'swift_released',
      types: ['import_lc', 'skbdn', 'sblc'],
      financial: true,
    }),
  );
  executorRegistry.register(
    makeUipathExecutor({
      id: 'executor.uipath.settle',
      displayName: 'UiPath — Settlement (EE + D/K)',
      step: 'settled',
      types: ['import_lc', 'skbdn', 'sblc'],
      financial: true,
    }),
  );
}
