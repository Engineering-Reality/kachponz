/**
 * src/index.ts — Application entry point.
 *
 * Boots Fastify with:
 *   - Pino structured logging (transaction_id correlation)
 *   - Global error handler (maps ApiError → structured JSON)
 *   - Route registration
 *   - Graceful shutdown on SIGTERM / SIGINT
 */
import "dotenv/config";
import Fastify, { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { env } from "./config/env.js";
import { closePool } from "./db/index.js";
import { transactionRoutes } from "./routes/transactions.js";
import { ApiError } from "./errors/index.js";
import { ZodError } from "zod";

const fastify = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:standard" },
          },
        }
      : {}),
  },
  // Trust X-Forwarded-For from reverse proxy (Nginx/Traefik)
  trustProxy: true,
});

// ── Global error handler ─────────────────────────────────────

fastify.setErrorHandler(
  async (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    // Our structured API errors
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(error.toResponse());
    }

    // Fastify body parse errors (e.g. malformed JSON)
    if ("statusCode" in error && (error as FastifyError).statusCode === 400) {
      return reply.status(400).send({
        error: {
          code: "BAD_REQUEST",
          message: "Invalid JSON in request body",
          additional_info: {},
        },
      });
    }

    // Unexpected errors — log full stack, send generic 500
    request.log.error(
      { err: error, transaction_id: (request.params as Record<string, string>)?.id },
      "Unhandled error"
    );

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        additional_info: {},
      },
    });
  }
);

// ── Routes ───────────────────────────────────────────────────

fastify.register(transactionRoutes);

// ── Startup ──────────────────────────────────────────────────

async function start() {
  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    fastify.log.info(
      { port: env.PORT, env: env.NODE_ENV },
      "Amadeus Transaction Tracker is running"
    );
    fastify.log.info(
      "⚠️  Ensure this service is behind a TLS reverse proxy (Nginx/Traefik) in all environments"
    );
  } catch (err) {
    fastify.log.fatal(err, "Server failed to start");
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────

async function shutdown(signal: string) {
  fastify.log.info({ signal }, "Shutting down gracefully...");
  await fastify.close();
  await closePool();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
