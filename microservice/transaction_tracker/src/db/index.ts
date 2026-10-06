/**
 * db/index.ts — PostgreSQL connection pool.
 *
 * Uses the `pg` (node-postgres) library directly.
 * No Supabase, no Docker dependency — connect to any on-prem Postgres.
 */
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/** Graceful shutdown — drain connection pool */
export async function closePool(): Promise<void> {
  await pool.end();
}

/** Quick connectivity check used by /health endpoint */
export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
