import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { qwenChat, parseJsonLoose, QwenApiError } from '../src/orchestrator/executors/qwenClient.js';
import { env } from '../src/config/env.js';

const originalFetch = globalThis.fetch;

describe('qwenClient', () => {
  let originalEnv: Record<string, any>;
  
  beforeEach(() => {
    originalEnv = { ...env };
    env.QWEN_MODE = 'cloud';
    env.QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    env.QWEN_API_KEY = 'test-key';
  });
  afterEach(() => {
    Object.assign(env, originalEnv);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('kirim payload OpenAI-compatible + Authorization Bearer', async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url);
      captured.init = init;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello world' } }],
          model: 'qwen-plus',
          usage: { total_tokens: 42 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const res = await qwenChat({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(res.content).toBe('hello world');
    expect(res.model).toBe('qwen-plus');
    expect(captured.url).toContain('/chat/completions');
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-key');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse((captured.init?.body as string) ?? '{}');
    expect(body.model).toBe('qwen-plus');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.temperature).toBe(0.1); // default
  });

  it('lempar QwenApiError dengan status pada respons non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 429 })) as typeof fetch;
    await expect(
      qwenChat({ model: 'qwen-plus', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toBeInstanceOf(QwenApiError);
  });
});

describe('parseJsonLoose', () => {
  it('parse JSON polos', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('parse JSON dalam code fence', () => {
    expect(parseJsonLoose('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });

  it('parse JSON dengan teks di depan/belakang', () => {
    expect(parseJsonLoose('Sure, here is the result: {"a":3} — done.')).toEqual({ a: 3 });
  });

  it('lempar bila tidak ada JSON object', () => {
    expect(() => parseJsonLoose('no json here')).toThrow(/tidak mengandung JSON/);
  });
});
