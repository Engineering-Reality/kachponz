import type pg from 'pg';
import { query } from '../db/pool.js';
import { verifySecret } from '../lib/crypto.js';
import type { ServiceAccount } from '../types/domain.js';

/**
 * Auth robot: kita TIDAK bisa query "WHERE api_key_hash = ?" karena hash argon2
 * ber-salt (dua hash dari key sama berbeda). Jadi: ambil kandidat aktif, lalu
 * verify hash satu per satu dengan timing-safe verify argon2.
 *
 * Untuk skala robot (puluhan–ratusan), ini aman. Bila nanti ribuan service
 * account, tambahkan lookup key non-rahasia (mis. prefix key) sebagai index —
 * lihat docs/deployment.md. Tetap verify hash penuh setelah kandidat menyempit.
 */
export async function findActiveAccountByApiKey(
  apiKey: string,
): Promise<ServiceAccount | null> {
  const prefix = apiKey.substring(0, 8);
  const res = await query<ServiceAccount>(
    `SELECT id, robot_name, api_key_hash, signing_secret_hash, company_id,
            is_active, allowed_types, created_at, disabled_at
       FROM service_accounts
      WHERE is_active = true 
        AND (api_key_prefix = $1 OR api_key_prefix IS NULL)`,
    [prefix]
  );
  for (const acct of res.rows) {
    // eslint-disable-next-line no-await-in-loop
    if (await verifySecret(acct.api_key_hash, apiKey)) return acct;
  }
  return null;
}

export async function getSigningSecretHash(
  serviceAccountId: string,
): Promise<string | null> {
  const res = await query<{ signing_secret_hash: string | null }>(
    `SELECT signing_secret_hash FROM service_accounts WHERE id = $1 AND is_active = true`,
    [serviceAccountId],
  );
  return res.rows[0]?.signing_secret_hash ?? null;
}

/** Dipakai CLI registrasi (scripts/registerRobot.ts). */
export async function activeAccountNameExists(robotName: string): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS(
        SELECT 1 FROM service_accounts WHERE robot_name = $1 AND is_active = true
     ) AS exists`,
    [robotName],
  );
  return res.rows[0]?.exists === true;
}

export async function insertServiceAccount(
  client: pg.PoolClient,
  params: {
    robotName: string;
    apiKeyHash: string;
    apiKeyPrefix: string;
    signingSecretHash: string | null;
    companyId: string;
    allowedTypes: string[] | null;
  },
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO service_accounts
        (robot_name, api_key_hash, api_key_prefix, signing_secret_hash, company_id, allowed_types)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      params.robotName,
      params.apiKeyHash,
      params.apiKeyPrefix,
      params.signingSecretHash,
      params.companyId,
      params.allowedTypes,
    ],
  );
  const id = res.rows[0]?.id;
  if (!id) throw new Error('gagal insert service account');
  return id;
}
