/**
 * env.ts — Environment configuration with Zod validation.
 *
 * Fail fast: if any required env var is missing or malformed,
 * the process exits before the server binds to a port.
 * This prevents silent misconfiguration in staging/prod.
 */
import { z } from "zod";

const envSchema = z.object({
  // Database — on-premise PostgreSQL (mandatory)
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL must be a postgresql:// connection string",
    }),

  // Application
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Optional DB pool tuning
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Environment validation failed — fix these issues and restart:");
    result.error.errors.forEach((err) => {
      console.error(`  • ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
export type Env = typeof env;
