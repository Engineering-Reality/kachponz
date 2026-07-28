import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';
import { env } from '../src/config/env.js';

// A2A v1 DITUNDA: rutenya tidak boleh terdaftar saat A2A_ENABLED=false (default).
// Vitest tidak men-set A2A_ENABLED, jadi ini menguji jalur default-off persis.
// Rute agent card publik tidak menyentuh DB, jadi buildServer + inject cukup
// tanpa koneksi Postgres hidup. (security-audit.md finding #4-A2A; prompt 4.6)
describe('A2A gated behind A2A_ENABLED (default off)', () => {
  it('defaults A2A_ENABLED to false', () => {
    expect(env.A2A_ENABLED).toBe(false);
  });

  it('does NOT register the public agent card when the flag is off', async () => {
    const app = await buildServer();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/.well-known/amadeus-agent-card.json',
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('does NOT register POST /a2a/rpc when the flag is off', async () => {
    const app = await buildServer();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/a2a/rpc',
        payload: { jsonrpc: '2.0', id: '1', method: 'task.get', params: {} },
        headers: { 'content-type': 'application/json' },
      });
      // Unregistered → 404 (setNotFoundHandler), never reaching auth/handler.
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
