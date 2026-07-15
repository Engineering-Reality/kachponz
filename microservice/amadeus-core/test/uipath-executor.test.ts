import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeUipathExecutor } from '../src/orchestrator/executors/uipathExecutor.js';
import { env } from '../src/config/env.js';

const originalFetch = globalThis.fetch;

describe('uipathExecutor', () => {
  let originalEnv: Record<string, any>;
  
  beforeEach(() => {
    originalEnv = { ...env };
    env.UIPATH_BASE_URL = 'https://cloud.uipath.com';
    env.UIPATH_ORG = 'mandiri-org';
    env.UIPATH_TENANT = 'production';
    env.UIPATH_CLIENT_ID = 'ci';
    env.UIPATH_CLIENT_SECRET = 'cs';
    env.UIPATH_SCOPES = 'OR.Jobs OR.Robots.Read';
    env.UIPATH_FOLDER_ID = '7';
    env.UIPATH_RELEASE_MAP =
      'mt_converted:import_lc=rk-mt-lc;swift_released=rk-swift';
  });
  afterEach(() => {
    Object.assign(env, originalEnv);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('OAuth2 client-credentials → StartJobs dengan payload benar', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (u.includes('/identity_/connect/token')) {
        return new Response(
          JSON.stringify({ access_token: 'tok-abc', expires_in: 3600 }),
          { status: 200 },
        );
      }
      if (u.includes('StartJobs')) {
        return new Response(
          JSON.stringify({ value: [{ Id: 999, Key: 'job-key-abc', State: 'Pending' }] }),
          { status: 201 },
        );
      }
      return new Response('unexpected', { status: 500 });
    }) as typeof fetch;

    const exec = makeUipathExecutor({
      id: 'test.uipath.mt',
      displayName: 'test',
      step: 'mt_converted',
      types: ['import_lc'],
      financial: true,
    });

    const outcome = await exec.run({
      transactionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      step: 'mt_converted',
      type: 'import_lc',
      data: { lcNumber: 'LC-2026-000123' },
    });

    expect(outcome.kind).toBe('dispatched');
    if (outcome.kind !== 'dispatched') throw new Error('unreachable');
    expect(outcome.externalJobId).toBe('999');
    expect(outcome.resultData?.uipathJobKey).toBe('job-key-abc');
    expect(outcome.resultData?.releaseKey).toBe('rk-mt-lc');

    // Verifikasi headers dan URL StartJobs
    const startJobsCall = calls.find((c) => c.url.includes('StartJobs'))!;
    expect(startJobsCall.url).toContain('/mandiri-org/production/orchestrator_/odata/Jobs/');
    const headers = startJobsCall.init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok-abc');
    expect(headers['X-UIPATH-OrganizationUnitId']).toBe('7');
    const body = JSON.parse((startJobsCall.init?.body as string) ?? '{}');
    expect(body.startInfo.ReleaseKey).toBe('rk-mt-lc');
    expect(body.startInfo.Strategy).toBe('ModernJobsCount');
    const inputArgs = JSON.parse(body.startInfo.InputArguments);
    expect(inputArgs.AmadeusTransactionId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(inputArgs.AmadeusStep).toBe('mt_converted');
    expect(inputArgs.AmadeusPayload).toEqual({ lcNumber: 'LC-2026-000123' });
  });

  it('return failed bila releaseKey tidak terpetakan', async () => {
    // OAuth2 tidak seharusnya dipanggil bila releaseKey tidak ada — tapi kalau
    // dipanggil, kita mock sukses agar tidak masking kegagalan.
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }), { status: 200 }),
    ) as typeof fetch;

    const exec = makeUipathExecutor({
      id: 'test.uipath.unknown',
      displayName: 'test',
      step: 'ee_ntf_approved', // tidak ada di UIPATH_RELEASE_MAP
      types: ['import_lc'],
      financial: false,
    });
    const outcome = await exec.run({
      transactionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      step: 'ee_ntf_approved',
      type: 'import_lc',
    });
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(outcome.reason).toMatch(/releaseKey/);
  });
});
