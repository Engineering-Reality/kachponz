// Single source of truth for allowed cross-origin callers, shared between the
// @fastify/cors plugin (server.ts, covers the normal request lifecycle) and
// any code that writes directly to reply.raw after reply.hijack() (engine.ts's
// SSE streaming path, which bypasses @fastify/cors entirely since hijacking
// skips Fastify's own header flush).
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8008',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8008',
  'http://127.0.0.1:5500',
];

// Mirrors what @fastify/cors would compute for a request with this Origin
// header, for callers that must set CORS headers manually on a hijacked reply.
export function resolveCorsOrigin(requestOrigin: string | undefined): string | undefined {
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return undefined;
}
