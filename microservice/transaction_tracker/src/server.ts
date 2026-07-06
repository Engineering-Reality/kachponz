import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { registerTransactionRoutes } from './routes/transactions.js';
import { registerOrchestratorRoutes } from './orchestrator/routes.js';
import { registerToolsRoutes } from './routes/tools.js';
import { registerAgentsRoutes } from './routes/agents.js';
import { DomainError } from './types/domain.js';
import { closePool } from './db/pool.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    // Batasi ukuran body — anti-DoS payload besar (CISO Availability #73).
    bodyLimit: 1_048_576, // 1 MB
    // Jangan expose versi/framework di response (CISO Code Review #31).
    disableRequestLogging: false,
    trustProxy: true, // di belakang reverse proxy TLS on-prem
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:8008', 'http://127.0.0.1:3000', 'http://127.0.0.1:8008', 'http://127.0.0.1:5500'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Robot-Key', 'X-Signature', 'X-Robot-Timestamp', 'X-Robot-Signing-Secret'],
  });

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Amadeus Transaction Tracker', version: '0.1.0' },
      components: {
        securitySchemes: {
          robotKey: { type: 'apiKey', name: 'X-Robot-Key', in: 'header' },
          robotSignature: { type: 'apiKey', name: 'X-Robot-Signature', in: 'header' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });

  // Security headers: X-Frame-Options, X-Content-Type-Options nosniff, CSP, HSTS,
  // dsb. (CISO API #6,#7; Code Review #33)
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    hidePoweredBy: true,
  });

  // Whitelist Content-Type untuk body → application/json saja (CISO API #4,#5).
  app.addContentTypeParser('*', (_req, _payload, done) => {
    done(new DomainError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type harus application/json', 415));
  });

  await registerTransactionRoutes(app as any);
  await registerOrchestratorRoutes(app as any);
  await registerToolsRoutes(app as any, {});
  await registerAgentsRoutes(app as any, {});

  // Error handler terpusat — TIDAK PERNAH kirim stack trace / detail internal
  // ke klien (CISO Code Review #27, #28, #32).
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      req.log.warn({ issues: err.issues }, 'validation failed');
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input tidak valid',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    // Fastify validation errors
    const fastifyErr = err as any;
    if (fastifyErr.validation && fastifyErr.validation.length > 0) {
      req.log.warn({ validation: fastifyErr.validation }, 'fastify validation failed');
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input tidak valid',
          details: fastifyErr.validation,
        },
      });
    }
    if (err instanceof DomainError) {
      req.log.warn({ code: err.code, details: err.details }, err.message);
      return reply.code(err.httpStatus).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    // Unknown error: log lengkap internal, tapi klien hanya dapat pesan generik.
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal' },
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource tidak ditemukan' } });
  });

  return app;
}

async function main() {
  const app = await buildServer();
  const shutdown = async (sig: string) => {
    app.log.info({ sig }, 'shutting down');
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    app.log.error({ err }, 'gagal start server');
    process.exit(1);
  }
}

// Jalankan hanya bila dieksekusi langsung (bukan saat di-import test).
const isDirect =
  process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirect) void main();
