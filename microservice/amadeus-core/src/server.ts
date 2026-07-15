import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { ALLOWED_ORIGINS } from './config/cors.js';
import { logger } from './lib/logger.js';
import { registerHealthRoute, registerTransactionRoutes } from './routes/transactions.js';
import { registerOrchestratorRoutes } from './orchestrator/routes.js';
import { registerToolsRoutes } from './routes/tools.js';
import { registerAgentsRoutes } from './routes/agents.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFeatureSharingRoutes } from './routes/featureSharing.js';
import { DomainError } from './types/domain.js';
import { closePool } from './db/pool.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyMultipart from '@fastify/multipart';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    // Batasi ukuran body — anti-DoS payload besar (CISO Availability #73).
    bodyLimit: 10 * 1_048_576, // 10 MB (chat requests can carry base64 image attachments)
    // Jangan expose versi/framework di response (CISO Code Review #31).
    disableRequestLogging: false,
    trustProxy: true, // di belakang reverse proxy TLS on-prem
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onRequest', async (req) => {
    if (req.url === '/orchestrator/run-agentic' && req.method === 'POST') {
      const contentLength = req.headers['content-length'];
      req.log.info({ contentLength, origin: req.headers.origin }, 'run-agentic request received');
    }
  });

  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Robot-Key', 'X-Signature', 'X-Robot-Timestamp', 'X-Robot-Signing-Secret'],
  });

  // RAG file uploads (/orchestrator/rag/upload_file, update_file) — same 10MB
  // ceiling as bodyLimit above.
  await app.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1_048_576 },
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
        connectSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "validator.swagger.io"],
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

  // Error handler terpusat — TIDAK PERNAH kirim stack trace / detail internal
  // ke klien (CISO Code Review #27, #28, #32).
  // HARUS didaftarkan sebelum route plugin di-register: Fastify mengikat
  // error handler ke encapsulation context saat registrasi, bukan saat boot
  // selesai — bila dipasang setelah plugin, DomainError yang dilempar di
  // dalam plugin (404/409/dst.) jatuh ke default handler Fastify dan
  // berubah jadi 500 generik (bug ditemukan lewat test HTTP company-scoping
  // Task 2, bukan Task 1 itu sendiri — tapi memblokir 404 yang diharapkan).
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
    // @fastify/rate-limit: statusCode 429 sudah diset plugin sebelum melempar,
    // header rate-limit/retry-after juga sudah ditulis. Jangan diubah jadi 500.
    if (fastifyErr.statusCode === 429) {
      req.log.warn({ err }, 'rate limit exceeded');
      return reply.code(429).send({
        error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan, coba lagi nanti' },
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

  // GET /health selalu aktif terlepas dari ENABLE_TRANSACTION_ROUTES —
  // dipakai liveness check infra.
  await registerHealthRoute(app as any);
  if (env.ENABLE_TRANSACTION_ROUTES) {
    await registerTransactionRoutes(app as any);
  }
  await registerOrchestratorRoutes(app as any);
  await registerToolsRoutes(app as any, {});
  await registerAgentsRoutes(app as any, {});
  await registerFeatureSharingRoutes(app as any, {});
  // Login manusia (admin dashboard) — hanya aktif bila OAUTH2_JWT_SECRET
  // di-set, karena itulah yang menandatangani token; sama gaya feature-flag
  // dengan ENABLE_TRANSACTION_ROUTES di atas.
  if (env.OAUTH2_JWT_SECRET) {
    await registerAuthRoutes(app as any, {});
  } else {
    app.log.warn('OAUTH2_JWT_SECRET tidak di-set — /auth/login dinonaktifkan.');
  }

  return app;
}

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { setMcpManagerRunning, setMcpManagerCrashed, getMcpManagerState } from './orchestrator/mcpManagerState.js';

let mcpManager: ChildProcess | null = null;

async function main() {
  const AMADEUS_ASCII = `
\x1b[38;5;51;49m ▄▄▄▄▄▄▄▄▄▄  \x1b[38;5;45;49m ▄▄▄▄▄▄ ▄▄▄▄▄\x1b[38;5;75;49m▄   ▄▄▄▄▄▄▄▄▄\x1b[38;5;111;49m▄  ▄▄▄▄▄▄▄  \x1b[38;5;201;49m    ▄▄▄▄▄▄▄▄▄\x1b[38;5;205;49m ▄▄▄▄▄  ▄▄▄▄▄\x1b[38;5;209;49m   ▄▄▄▄▄▄▄▄▄\x1b[38;5;214;49m▄\x1b[0m
\x1b[38;5;51;49m█   \x1b[38;5;244;49m▄▄▄▄\x1b[38;5;45;49m   \x1b[38;5;244;48;5;236m░\x1b[38;5;45;49m █   \x1b[38;5;244;49m▄▄\x1b[38;5;45;49m ▀\x1b[38;5;75;49m \x1b[38;5;244;49m▄▄\x1b[38;5;75;49m   \x1b[38;5;75;48;5;236m▄\x1b[38;5;75;49m █   \x1b[38;5;244;49m▄▄▄▄\x1b[38;5;111;49m   \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m █   \x1b[38;5;244;49m▄▄\x1b[38;5;201;49m ▀▀▄▄  █   \x1b[38;5;205;49m ░▒▓█ █   \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m  \x1b[38;5;244;48;5;236m░\x1b[38;5;209;49m   \x1b[38;5;209;48;5;236m▄\x1b[38;5;209;49m ▄▀   \x1b[38;5;244;49m▄▄▄\x1b[38;5;214;49m░▒▓█\x1b[0m
\x1b[38;5;51;48;5;236m▀\x1b[38;5;51;49m ░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;45;49m  \x1b[38;5;244;48;5;236m▓\x1b[38;5;45;49m ░ \x1b[38;5;244;48;5;236m▒\x1b[38;5;45;49m \x1b[38;5;45;48;5;236m▀\x1b[38;5;45;49m ░\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;75;49m ░ █ \x1b[38;5;111;48;5;236m▀\x1b[38;5;111;49m ░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;111;49m  \x1b[38;5;244;48;5;236m▓\x1b[38;5;111;49m ░ \x1b[38;5;244;48;5;236m▒\x1b[38;5;111;49m \x1b[38;5;201;48;5;236m▀\x1b[38;5;201;49m ░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;201;49m \x1b[38;5;244;49m▀\x1b[38;5;244;48;5;236m▓\x1b[38;5;201;49m   █ \x1b[38;5;205;48;5;236m▀\x1b[38;5;205;49m ░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;244;49m▀▀▀\x1b[38;5;205;49m▀ \x1b[38;5;205;48;5;236m▀\x1b[38;5;205;49m \x1b[38;5;209;49m░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;209;49m  \x1b[38;5;244;48;5;236m▓\x1b[38;5;209;49m ░ █ \x1b[38;5;209;48;5;236m▀\x1b[38;5;209;49m \x1b[38;5;214;49m░\x1b[38;5;244;49m▄▀\x1b[38;5;214;49m  \x1b[38;5;244;48;5;236m▓\x1b[38;5;214;49m ░▒█\x1b[0m
\x1b[38;5;244;48;5;236m░\x1b[38;5;45;49m ░ \x1b[38;5;244;48;5;236m░\x1b[38;5;45;49m  \x1b[38;5;244;48;5;236m░\x1b[38;5;45;49m ░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;75;49m █ ░ \x1b[38;5;244;48;5;236m▒\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;111;49m ░ █ \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m ░ \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m  \x1b[38;5;244;48;5;236m░\x1b[38;5;201;49m ░ \x1b[38;5;244;48;5;236m▓\x1b[38;5;201;49m █ ░ \x1b[38;5;244;48;5;236m▒\x1b[38;5;201;49m  \x1b[38;5;244;48;5;236m▒\x1b[38;5;205;49m ░ █ █ ░ \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m  \x1b[38;5;209;49m   █ ░ \x1b[38;5;244;48;5;236m▒\x1b[38;5;209;49m  \x1b[38;5;244;48;5;236m▒\x1b[38;5;209;49m ░\x1b[38;5;214;49m █ █  ▀▄▄ ▀▀▀\x1b[38;5;220;49m▀▀\x1b[0m
\x1b[38;5;244;48;5;236m▒\x1b[38;5;45;49m ░ ▀▀▀\x1b[38;5;75;49m▀ ░ \x1b[38;5;244;48;5;236m█\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;75;49m ░ \x1b[38;5;244;48;5;236m░\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m ░ █ \x1b[38;5;244;48;5;236m▒\x1b[38;5;111;49m ░\x1b[38;5;201;49m ▀▀▀▀ ░ \x1b[38;5;244;48;5;236m█\x1b[38;5;201;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;201;49m ░\x1b[38;5;205;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m  \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m ░ \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m ░\x1b[38;5;209;49m ▀▀▀\x1b[38;5;209;48;5;236m▀\x1b[38;5;209;49m  \x1b[38;5;244;48;5;236m░\x1b[38;5;209;49m ░ \x1b[38;5;244;48;5;236m░\x1b[38;5;214;49m  \x1b[38;5;244;48;5;236m░\x1b[38;5;214;49m ░ █ \x1b[38;5;244;49m▄\x1b[38;5;214;49m▀\x1b[38;5;244;49m▄\x1b[38;5;214;49m  \x1b[38;5;220;49m ▀▀▀▀▀▄\x1b[0m
\x1b[38;5;244;48;5;236m▓\x1b[38;5;45;49m \x1b[38;5;75;49m▒ \x1b[38;5;244;48;5;236m▓\x1b[38;5;244;49m▀▀▄\x1b[38;5;75;49m ▒ \x1b[38;5;244;48;5;236m▓\x1b[38;5;75;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;75;49m \x1b[38;5;111;49m▒ █ ▀▀▀ █ ▒ \x1b[38;5;244;48;5;236m░\x1b[38;5;201;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;201;49m ▒ \x1b[38;5;244;48;5;236m▓\x1b[38;5;244;49m▀▀▄\x1b[38;5;201;49m ▒ \x1b[38;5;244;48;5;236m▓\x1b[38;5;205;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;205;49m ▒ █  █ ▒ \x1b[38;5;244;48;5;236m▒\x1b[38;5;209;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;209;49m ▒ \x1b[38;5;244;48;5;236m▓\x1b[38;5;244;49m▀▀▀\x1b[38;5;209;49m  \x1b[38;5;244;48;5;236m▒\x1b[38;5;214;49m ▒ █  █ ▒ \x1b[38;5;244;48;5;236m░\x1b[38;5;214;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;220;49m ░\x1b[38;5;244;49m▀▀▀▀▄\x1b[38;5;220;49m ▒ █\x1b[0m
\x1b[38;5;244;48;5;236m█\x1b[38;5;75;49m ▓ \x1b[38;5;244;48;5;236m▒\x1b[38;5;75;49m  █ ▓\x1b[38;5;111;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;111;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;111;49m ▓ █     \x1b[38;5;201;49m█ ▓ \x1b[38;5;244;48;5;236m▒\x1b[38;5;201;49m \x1b[38;5;244;48;5;236m█\x1b[38;5;201;49m ▓ \x1b[38;5;244;48;5;236m▒\x1b[38;5;201;49m \x1b[38;5;205;49m █ ▓ \x1b[38;5;244;48;5;236m▒\x1b[38;5;205;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;205;49m ▓ █ \x1b[38;5;209;49m▄█ ▀ \x1b[38;5;244;48;5;236m▓\x1b[38;5;209;49m \x1b[38;5;244;48;5;236m▓\x1b[38;5;209;49m ▓ \x1b[38;5;244;48;5;236m░\x1b[38;5;209;49m▄\x1b[38;5;214;49m▄▄▄ \x1b[38;5;244;48;5;236m▓\x1b[38;5;214;49m ▓ █  █ \x1b[38;5;220;49m▓ \x1b[38;5;244;48;5;236m▒\x1b[38;5;220;49m \x1b[38;5;244;48;5;236m▒\x1b[38;5;220;49m ▓ \x1b[38;5;244;48;5;236m▓\x1b[38;5;220;49m  \x1b[38;5;244;48;5;236m▓\x1b[38;5;226;49m █ \x1b[38;5;244;48;5;236m▀\x1b[0m
\x1b[38;5;244;49m█\x1b[38;5;75;49m ▀ \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m  \x1b[38;5;244;49m█\x1b[38;5;111;49m ▀ \x1b[38;5;244;48;5;236m░\x1b[38;5;111;49m \x1b[38;5;244;49m█\x1b[38;5;111;49m ▀ █\x1b[38;5;201;49m     █ ▀ \x1b[38;5;244;48;5;236m▓\x1b[38;5;201;49m \x1b[38;5;244;49m█\x1b[38;5;201;49m \x1b[38;5;205;49m▀ \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m  \x1b[38;5;244;49m█\x1b[38;5;205;49m ▀ \x1b[38;5;244;48;5;236m░\x1b[38;5;205;49m \x1b[38;5;244;49m█\x1b[38;5;209;49m ▀ ▀▀ \x1b[38;5;244;49m▄▄▀▀\x1b[38;5;209;49m  \x1b[38;5;244;49m█\x1b[38;5;214;49m ▀     █ \x1b[38;5;244;49m█\x1b[38;5;214;49m ▀ \x1b[38;5;220;49m▀▀▀▀ ▀ \x1b[38;5;244;48;5;236m▓\x1b[38;5;220;49m \x1b[38;5;244;49m█\x1b[38;5;220;49m ▀ \x1b[38;5;226;49m▀▀▀▀  ▄▀\x1b[0m
\x1b[38;5;244;49m▀▀\x1b[38;5;111;49m▀\x1b[38;5;244;49m▀\x1b[38;5;111;49m▀  \x1b[38;5;244;49m▀\x1b[38;5;111;49m▀\x1b[38;5;244;49m▀▀\x1b[38;5;111;49m▀ \x1b[38;5;244;49m▀▀\x1b[38;5;201;49m▀\x1b[38;5;244;49m▀▀\x1b[38;5;201;49m     \x1b[38;5;244;49m▀\x1b[38;5;201;49m▀\x1b[38;5;244;49m▀▀▀\x1b[38;5;205;49m \x1b[38;5;244;49m▀▀\x1b[38;5;205;49m▀\x1b[38;5;244;49m▀\x1b[38;5;205;49m▀  \x1b[38;5;244;49m▀\x1b[38;5;205;49m▀\x1b[38;5;244;49m▀▀\x1b[38;5;209;49m▀ \x1b[38;5;244;49m▀▀\x1b[38;5;209;49m▀\x1b[38;5;244;49m▀▀▀▀\x1b[38;5;209;49m  \x1b[38;5;214;49m    \x1b[38;5;244;49m▀▀\x1b[38;5;214;49m▀\x1b[38;5;244;49m▀\x1b[38;5;214;49m▀▀▀▀▀\x1b[38;5;220;49m  \x1b[38;5;244;49m▀\x1b[38;5;220;49m▀\x1b[38;5;244;49m▀▀▀▀▀\x1b[38;5;220;49m▀\x1b[38;5;244;49m▀▀\x1b[38;5;220;49m \x1b[38;5;226;49m \x1b[38;5;244;49m▀▀\x1b[38;5;226;49m▀\x1b[38;5;244;49m▀▀▀▀▀▀\x1b[38;5;226;49m▀  \x1b[0m
`;
  console.log(AMADEUS_ASCII);
  console.log(`\x1b[32m🚀 Starting Amadeus Orchestrator...\x1b[0m\n`);
  
  const app = await buildServer();
  const shutdown = async (sig: string) => {
    app.log.info({ sig }, 'shutting down');
    if (mcpManager) {
      mcpManager.kill('SIGTERM');
    }

    // If app.close()/closePool() hangs, force exit instead of lingering
    // and blocking the next `npm run dev` with EADDRINUSE.
    const forceExitTimer = setTimeout(() => {
      app.log.error('Graceful shutdown timed out after 5s — forcing exit.');
      process.exit(1);
    }, 5000);
    forceExitTimer.unref();

    try {
      await app.close();
      await closePool();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    
    // Spawn MCP Auto Manager automatically in development
    if (process.env.NODE_ENV === 'development' && !process.env.MCP_MANAGER_STARTED) {
      process.env.MCP_MANAGER_STARTED = '1';
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      
      mcpManager = spawn('tsx', [path.join(__dirname, '../scripts/mcpAutoManager.ts')], {
        stdio: 'inherit',
        env: process.env
      });

      // If the process is still alive 5s after spawn, treat it as up. If it
      // exits before that (e.g. ERR_MODULE_NOT_FOUND on boot), that's a
      // startup crash — mark it loudly instead of letting it fail silently
      // until the first tool call hits a generic "fetch failed".
      const earlyExitTimer = setTimeout(() => {
        if (!getMcpManagerState().crashedEarly) setMcpManagerRunning();
      }, 5000);

      mcpManager.on('exit', (code, signal) => {
        clearTimeout(earlyExitTimer);
        if (code !== 0 && code !== null) {
          const early = !getMcpManagerState().running;
          const message = `MCP Auto Manager exited with code ${code}${signal ? ` (signal ${signal})` : ''}`;
          setMcpManagerCrashed(message, early);
          app.log.error(
            { code, signal },
            '🔴 MCP Auto Manager crashed — NO MCP tool servers will be available. ' +
            'Every tool call (UiPath, etc.) will fail with a generic connection error until this is fixed. ' +
            'Check the stack trace immediately above this line for the actual cause.'
          );
        }
      });
    }

  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      app.log.error(
        `\n🔴 Port ${env.PORT} is already in use.\n` +
        `   Another process (likely a previous "npm run dev" that didn't exit cleanly) is holding it.\n\n` +
        `   Find and stop it:\n` +
        `     lsof -i :${env.PORT}          # find the PID\n` +
        `     kill -9 <pid>                 # stop it\n\n` +
        `   Then run "npm run dev" again.\n`
      );
      process.exit(1);
    }
    app.log.error({ err }, 'gagal start server');
    process.exit(1);
  }
}

// Jalankan hanya bila dieksekusi langsung (bukan saat di-import test).
const isDirect =
  process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirect) void main();
