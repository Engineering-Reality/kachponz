import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

/**
 * Single on-prem PostgreSQL pool.
 *
 * CISO Code Security Review:
 *  - #39 Semua query WAJIB lewat parameterized/prepared statement (mitigasi SQLi).
 *  - #40 Connection string tidak di source; dibaca dari env.
 *  - #44 Resource (connection) selalu ditutup — pool.query auto release; untuk
 *        transaksi manual pakai withTransaction() yang menjamin release di finally.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.PG_POOL_MAX,
  statement_timeout: env.PG_STATEMENT_TIMEOUT_MS,
  application_name: 'amadeus-orchestrator',
});

pool.on('error', (err) => {
  // Idle client error — jangan crash proses; log tanpa bocorkan connection string.
  // eslint-disable-next-line no-console
  console.error('[pg] idle client error:', err.message);
});

export type QueryParams = ReadonlyArray<unknown>;

/** Query berparameter. Text query TIDAK PERNAH diinterpolasi dengan input user. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: QueryParams,
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params ? [...params] : undefined);
}

/**
 * Jalankan callback dalam satu transaksi. Client dijamin di-release (CISO #44),
 * COMMIT pada sukses, ROLLBACK pada error.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* swallow rollback error, propagate original */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Liveness/readiness untuk /health. Return true bila DB menjawab. */
export async function pingDb(): Promise<boolean> {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    return r.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
