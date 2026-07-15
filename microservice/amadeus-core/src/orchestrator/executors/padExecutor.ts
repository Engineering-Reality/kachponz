/**
 * Power Automate Desktop (PAD) Executor.
 *
 * Konteks: tim RPA belum mengonfirmasi cara trigger PAD via HTTP. Executor ini
 * sengaja generic: ia POST payload JSON ke URL yang dikonfigurasi. Tiga cara
 * konfigurasi umum yang cocok:
 *
 *   A) Power Automate CLOUD FLOW dengan trigger "When an HTTP request is
 *      received", yang di dalam flow-nya memanggil "Run a flow built with
 *      Power Automate for desktop". Ini paling umum.
 *      → PAD_DISPATCH_MODE=power_automate_http
 *      → PAD_DISPATCH_URL = URL trigger yang dibuat Power Automate (berbeda
 *        per flow)
 *
 *   B) Bridge on-prem custom (mis. Windows Service / script yang listen
 *      HTTP dan trigger PAD via CLI `PAD.Console.Host.exe`).
 *      → PAD_DISPATCH_MODE=custom_bridge
 *      → PAD_DISPATCH_URL = endpoint bridge
 *
 *   C) PAD tanpa HTTP trigger sama sekali (attended/scheduled) — sementara
 *      simpan intent ke DB & tampilkan di dashboard supaya operator manual
 *      menjalankan. Mode ini set `PAD_DISPATCH_MODE=queued_only`.
 *      → run() akan return `dispatched` dengan job id lokal; robot manual
 *        tetap harus lapor via A2A.
 *
 * Kontrak payload yang dikirim (mode HTTP):
 *   {
 *     "amadeus": {
 *       "transactionId": "...",
 *       "step": "...",
 *       "type": "...",
 *       "flowName": "<dari config>",
 *       "payload": { ... }
 *     }
 *   }
 * Flow PAD yang menerima wajib memanggil A2A `task.complete` saat selesai
 * (sama seperti UiPath). Tanpa itu, state tracker tidak akan maju.
 */

import type { Executor, ExecutorContext, ExecutorOutcome } from './base.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { randomUUID } from 'node:crypto';

export function makePadExecutor(params: {
  id: string;
  displayName: string;
  step: string;
  types: string[];
  financial: boolean;
  /** Nama flow PAD yang akan diminta di-trigger (informasional bagi bridge). */
  flowName: string;
  costUnit?: number;
}): Executor {
  return {
    descriptor: {
      id: params.id,
      displayName: params.displayName,
      kind: 'pad',
      costUnit: params.costUnit ?? 10, // 10x lebih murah dari UiPath ~
      capabilities: [
        { step: params.step, types: params.types, financial: params.financial },
      ],
    },
    async run(ctx: ExecutorContext): Promise<ExecutorOutcome> {
      const log = logger.child({
        executor: params.id,
        transaction_id: ctx.transactionId,
      });
      const localJobId = randomUUID();

      // Baca dari process.env langsung supaya bisa di-swap saat runtime/test.
      // Fallback ke `env` yang di-validate saat startup untuk konsistensi tipe.
      const mode = (process.env.PAD_DISPATCH_MODE ?? env.PAD_DISPATCH_MODE) as string;
      const dispatchUrl = process.env.PAD_DISPATCH_URL ?? env.PAD_DISPATCH_URL;
      const authHeader = process.env.PAD_DISPATCH_AUTH_HEADER ?? env.PAD_DISPATCH_AUTH_HEADER;
      const authValue = process.env.PAD_DISPATCH_AUTH_VALUE ?? env.PAD_DISPATCH_AUTH_VALUE;

      // Mode queued: hanya catat intent — operator/scheduler manual yang jalankan.
      if (mode === 'queued_only') {
        log.info({ localJobId, flowName: params.flowName }, '📥 PAD job di-queue (mode: queued_only)');
        return {
          kind: 'dispatched',
          externalJobId: localJobId,
          resultData: {
            dispatchedTo: params.id,
            mode: 'queued_only',
            flowName: params.flowName,
            note: 'Operator manual harus menjalankan PAD flow ini dan flow harus panggil A2A task.complete saat selesai.',
          },
        };
      }

      if (!dispatchUrl) {
        return {
          kind: 'failed',
          reason: 'PAD_DISPATCH_URL belum diset (mode HTTP). Konsultasi tim: mana yang dipakai?',
        };
      }

      const body = {
        amadeus: {
          transactionId: ctx.transactionId,
          step: ctx.step,
          type: ctx.type,
          flowName: params.flowName,
          jobId: localJobId,
          payload: ctx.data ?? {},
        },
      };

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authHeader && authValue) {
        headers[authHeader] = authValue;
      }

      let res: Response;
      try {
        res = await fetch(dispatchUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
      } catch (e) {
        return {
          kind: 'failed',
          reason: `Gagal HTTP ke PAD dispatch: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return {
          kind: 'failed',
          reason: `PAD dispatch ${res.status}: ${t.slice(0, 200)}`,
        };
      }

      log.info({ localJobId, mode }, '📤 PAD job dispatched');
      return {
        kind: 'dispatched',
        externalJobId: localJobId,
        resultData: {
          dispatchedTo: params.id,
          mode,
          flowName: params.flowName,
        },
      };
    },
  };
}
