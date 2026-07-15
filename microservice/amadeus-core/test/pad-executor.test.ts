import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makePadExecutor } from '../src/orchestrator/executors/padExecutor.js';

const originalFetch = globalThis.fetch;

describe('padExecutor', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.PAD_DISPATCH_MODE;
    delete process.env.PAD_DISPATCH_URL;
    delete process.env.PAD_DISPATCH_AUTH_HEADER;
    delete process.env.PAD_DISPATCH_AUTH_VALUE;
  });

  it('mode queued_only: return dispatched tanpa HTTP call', async () => {
    process.env.PAD_DISPATCH_MODE = 'queued_only';
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const exec = makePadExecutor({
      id: 'test.pad.q',
      displayName: 't',
      step: 'ee_ntf_created',
      types: ['import_lc'],
      financial: false,
      flowName: 'Amadeus.EE.Create',
    });
    const outcome = await exec.run({
      transactionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      step: 'ee_ntf_created',
      type: 'import_lc',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('dispatched');
    if (outcome.kind !== 'dispatched') throw new Error('unreachable');
    expect(outcome.resultData?.mode).toBe('queued_only');
    expect(outcome.resultData?.flowName).toBe('Amadeus.EE.Create');
  });

  it('mode HTTP: POST payload amadeus + auth header opsional', async () => {
    process.env.PAD_DISPATCH_MODE = 'power_automate_http';
    process.env.PAD_DISPATCH_URL = 'https://prod-01.power-automate.com/trigger';
    process.env.PAD_DISPATCH_AUTH_HEADER = 'X-Trigger-Key';
    process.env.PAD_DISPATCH_AUTH_VALUE = 'secret-abc';

    let captured: { url?: string; init?: RequestInit } = {};
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(url), init };
      return new Response('{}', { status: 202 });
    }) as typeof fetch;

    const exec = makePadExecutor({
      id: 'test.pad.h',
      displayName: 't',
      step: 'distributed_to_analyst',
      types: ['import_lc'],
      financial: false,
      flowName: 'Amadeus.Distribute',
    });

    const outcome = await exec.run({
      transactionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      step: 'distributed_to_analyst',
      type: 'import_lc',
      data: { analyst: 'agent-04' },
    });

    expect(outcome.kind).toBe('dispatched');
    expect(captured.url).toBe('https://prod-01.power-automate.com/trigger');
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Trigger-Key']).toBe('secret-abc');
    const body = JSON.parse((captured.init?.body as string) ?? '{}');
    expect(body.amadeus.transactionId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(body.amadeus.step).toBe('distributed_to_analyst');
    expect(body.amadeus.flowName).toBe('Amadeus.Distribute');
    expect(body.amadeus.payload).toEqual({ analyst: 'agent-04' });
  });

  it('mode HTTP tanpa URL → failed', async () => {
    process.env.PAD_DISPATCH_MODE = 'power_automate_http';
    // URL sengaja tidak di-set
    const exec = makePadExecutor({
      id: 'test.pad.nourl',
      displayName: 't',
      step: 'x',
      types: ['import_lc'],
      financial: false,
      flowName: 'Amadeus.X',
    });
    const outcome = await exec.run({
      transactionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      step: 'x',
      type: 'import_lc',
    });
    expect(outcome.kind).toBe('failed');
  });
});
