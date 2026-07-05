/**
 * Peta step → executor. Data-driven, bisa di-hot-swap tanpa menyentuh logic.
 *
 * Strategi seleksi (router):
 *   1. Ambil semua executor yang capabilities-nya cocok (step + type).
 *   2. Bila `preferences[step:type]` didefinisikan, pilih sesuai urutan.
 *   3. Kalau tidak ada preference, pilih executor dengan `costUnit` TERKECIL.
 *   4. Kalau tetap ambigu, ambil pertama yang terdaftar (stable order).
 *
 * Inti misi cost-reduction: pindahkan step X dari UiPath ke PAD ke LLM tanpa
 * mengubah kode aplikasi — cukup ubah preferences di sini (atau via env).
 *
 * CATATAN: financial step (mt_converted/swift_released/settled) biasanya
 * WAJIB via UiPath karena integrasi sistem legacy (SAA, SWIFT gateway).
 * Pastikan preferences untuk step ini menunjuk executor UiPath, dan JANGAN
 * biarkan LLM/PAD mengambil step finansial tanpa review arsitektur.
 */

import type { Executor } from './base.js';
import { executorRegistry } from './base.js';

/**
 * Preferences: kunci `"step"` atau `"step:type"`, nilai list executor id
 * dalam urutan prioritas.
 * Diambil dari env EXECUTOR_PREFERENCES bila ada.
 * Format env: "step[:type]=id1,id2;step2=id3"
 */
function loadPreferences(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const raw = process.env.EXECUTOR_PREFERENCES;
  if (!raw) return map;
  for (const entry of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = entry.split('=');
    if (!k || !v) continue;
    map.set(k.trim(), v.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return map;
}

const preferences = loadPreferences();

export interface RouteDecision {
  executor: Executor;
  alternatives: Executor[];
  reason: 'preferred' | 'lowest_cost' | 'only_option' | 'fallback_first';
}

export function chooseExecutor(step: string, type: string): RouteDecision | null {
  const candidates = executorRegistry.findForStep(step, type);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { executor: candidates[0]!, alternatives: [], reason: 'only_option' };
  }

  // 1) Preferences: exact "step:type" lalu "step" saja
  const prefKeys = [`${step}:${type}`, step];
  for (const key of prefKeys) {
    const ids = preferences.get(key);
    if (!ids || ids.length === 0) continue;
    for (const id of ids) {
      const hit = candidates.find((c) => c.descriptor.id === id);
      if (hit) {
        return {
          executor: hit,
          alternatives: candidates.filter((c) => c !== hit),
          reason: 'preferred',
        };
      }
    }
  }

  // 2) Cost terkecil
  const sorted = [...candidates].sort(
    (a, b) => a.descriptor.costUnit - b.descriptor.costUnit,
  );
  if (sorted[0]!.descriptor.costUnit < sorted[1]!.descriptor.costUnit) {
    return { executor: sorted[0]!, alternatives: sorted.slice(1), reason: 'lowest_cost' };
  }

  // 3) Tie → pertama
  return { executor: sorted[0]!, alternatives: sorted.slice(1), reason: 'fallback_first' };
}

/** Untuk endpoint /orchestrator/route (introspeksi decision). */
export function explainRoute(step: string, type: string) {
  const d = chooseExecutor(step, type);
  if (!d) return null;
  return {
    chosen: {
      id: d.executor.descriptor.id,
      kind: d.executor.descriptor.kind,
      costUnit: d.executor.descriptor.costUnit,
    },
    reason: d.reason,
    alternatives: d.alternatives.map((e) => ({
      id: e.descriptor.id,
      kind: e.descriptor.kind,
      costUnit: e.descriptor.costUnit,
    })),
  };
}
