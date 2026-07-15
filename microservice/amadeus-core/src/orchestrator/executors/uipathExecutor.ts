/**
 * UiPath Automation Cloud Executor.
 *
 * Cara kerja:
 *   1. Autentikasi OAuth2 client-credentials ke `cloud.uipath.com/identity_/connect/token`
 *      dengan `UIPATH_CLIENT_ID` + `UIPATH_CLIENT_SECRET` + scope
 *      `OR.Jobs OR.Robots.Read` (default; tim bisa perluas).
 *   2. Access token di-cache in-memory sampai kedaluwarsa - 30s.
 *   3. Untuk menjalankan robot: POST ke
 *      `https://cloud.uipath.com/{org}/{tenant}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`
 *      dengan releaseKey yang dipetakan dari (step, type) → process
 *      (dikonfigurasi di executorMap.ts atau env terpisah).
 *   4. Return outcome `dispatched` dengan externalJobId dari respons Jobs API.
 *      Robot UiPath yang menyelesaikan step akan kirim task.complete ke A2A
 *      sendiri saat process selesai — engine tidak menunggu di sini.
 *
 * Semantik ASYNC ini penting: state tracker TETAP source of truth. Executor
 * ini hanya "trigger". Kalau tidak ada task.complete masuk dalam SLA yang
 * disepakati, monitoring/retry di luar scope executor ini (roadmap: watcher
 * timeout).
 */

import type { Executor, ExecutorContext, ExecutorOutcome } from './base.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { getUiPathToken, UipathAuthError } from '../../lib/uipathAuth.js';

/**
 * Ambil OAuth token untuk kredensial env-level. Executor ini selalu memakai
 * satu set kredensial dari process.env, jadi cacheKey-nya konstan
 * ('env-default'). Cache & flow OAuth2 di-share dengan poller mcpAutoManager
 * lewat src/lib/uipathAuth.ts.
 */
async function getAccessToken(): Promise<string> {
  if (!env.UIPATH_CLIENT_ID || !env.UIPATH_CLIENT_SECRET) {
    throw new Error('UIPATH_CLIENT_ID / UIPATH_CLIENT_SECRET belum diset');
  }
  return getUiPathToken('env-default', {
    baseUrl: env.UIPATH_BASE_URL,
    org: env.UIPATH_ORG ?? '',
    tenant: env.UIPATH_TENANT ?? '',
    clientId: env.UIPATH_CLIENT_ID,
    clientSecret: env.UIPATH_CLIENT_SECRET,
    scopes: env.UIPATH_SCOPES,
  });
}

/**
 * Peta step+type → releaseKey UiPath. Config disederhanakan untuk MVP;
 * production sebaiknya baca dari DB/config server, bukan env.
 * Env: UIPATH_RELEASE_MAP = "step:type=releaseKey;step2:type2=releaseKey2"
 */
function getReleaseKey(step: string, type: string): string | null {
  if (!env.UIPATH_RELEASE_MAP) return null;
  const entries = env.UIPATH_RELEASE_MAP.split(';').map((s) => s.trim()).filter(Boolean);
  for (const e of entries) {
    const [k, v] = e.split('=');
    if (!k || !v) continue;
    const [s, t] = k.split(':');
    if (s === step && t === type) return v;
  }
  // fallback: entry tanpa type (`step=releaseKey`) berlaku untuk semua type
  for (const e of entries) {
    const [k, v] = e.split('=');
    if (!k || !v) continue;
    if (!k.includes(':') && k === step) return v;
  }
  return null;
}

interface StartJobsResponse {
  '@odata.context'?: string;
  value?: Array<{ Id: number; Key: string; State: string }>;
}

/**
 * Buat executor UiPath untuk satu (step, type) tertentu.
 * Descriptor-nya dinamis: id, displayName, capabilities dari argumen.
 */
export function makeUipathExecutor(params: {
  id: string;
  displayName: string;
  step: string;
  types: string[];
  financial: boolean;
  costUnit?: number;
}): Executor {
  return {
    descriptor: {
      id: params.id,
      displayName: params.displayName,
      kind: 'uipath',
      costUnit: params.costUnit ?? 100, // mahal by default
      capabilities: [
        { step: params.step, types: params.types, financial: params.financial },
      ],
    },
    async run(ctx: ExecutorContext): Promise<ExecutorOutcome> {
      const log = logger.child({
        executor: params.id,
        transaction_id: ctx.transactionId,
      });

      const releaseKey = getReleaseKey(ctx.step, ctx.type);
      if (!releaseKey) {
        return {
          kind: 'failed',
          reason: `releaseKey UiPath tidak dikonfigurasi untuk step=${ctx.step} type=${ctx.type} (cek UIPATH_RELEASE_MAP)`,
        };
      }

      let token: string;
      try {
        token = await getAccessToken();
      } catch (e) {
        if (e instanceof UipathAuthError) {
          const humanReason = {
            network: 'Tidak bisa reach UiPath identity endpoint (network/DNS/TLS)',
            credentials: 'Kredensial UiPath ditolak oleh identity server',
            server: 'UiPath identity service tidak sehat (5xx)',
            rate_limit: 'Rate limit UiPath identity — coba lagi nanti',
          }[e.cause];
          log.warn({ authFailureCause: e.cause }, 'UiPath OAuth ditolak, executor menolak dispatch');
          return {
            kind: 'refused',
            reason: `${humanReason}: ${e.message}`,
            resultData: { authFailureCause: e.cause },
          };
        }
        return {
          kind: 'failed',
          reason: `Gagal ambil OAuth token UiPath: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      // InputArguments yang diteruskan ke workflow UiPath — dibungkus JSON
      // string sesuai spesifikasi Jobs API.
      const inputArgs: Record<string, unknown> = {
        AmadeusTransactionId: ctx.transactionId,
        AmadeusStep: ctx.step,
        AmadeusType: ctx.type,
        AmadeusPayload: ctx.data ?? {},
      };

      const url = `${env.UIPATH_BASE_URL}/${env.UIPATH_ORG}/${env.UIPATH_TENANT}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`;
      const bodyObj = {
        startInfo: {
          ReleaseKey: releaseKey,
          Strategy: 'ModernJobsCount',
          JobsCount: 1,
          InputArguments: JSON.stringify(inputArgs),
        },
      };

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-UIPATH-OrganizationUnitId': env.UIPATH_FOLDER_ID,
          },
          body: JSON.stringify(bodyObj),
        });
      } catch (e) {
        return {
          kind: 'failed',
          reason: `Gagal HTTP ke UiPath Orchestrator: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        log.warn({ status: res.status, body: t.slice(0, 300) }, 'UiPath StartJobs gagal');
        return {
          kind: 'failed',
          reason: `UiPath StartJobs ${res.status}: ${t.slice(0, 200)}`,
        };
      }

      const json = (await res.json()) as StartJobsResponse;
      const job = json.value?.[0];
      const externalJobId = job ? String(job.Id) : undefined;

      log.info({ externalJobId, releaseKey }, '📤 UiPath job dispatched');

      return {
        kind: 'dispatched',
        externalJobId,
        resultData: {
          dispatchedTo: params.id,
          uipathJobId: externalJobId,
          uipathJobKey: job?.Key,
          releaseKey,
        },
      };
    },
  };
}
