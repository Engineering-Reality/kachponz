import { pool, query, withTransaction } from '../src/db/pool.js';
import { hashSecret, generateApiKey, generateSigningSecret } from '../src/lib/crypto.js';
import { insertServiceAccount } from '../src/services/serviceAccounts.js';
import type { AuthContext } from '../src/types/domain.js';

export async function truncateAll(): Promise<void> {
  await query('TRUNCATE a2a_task_messages, a2a_tasks, transaction_events, transactions, service_accounts RESTART IDENTITY CASCADE');
}

export interface SeededRobot {
  auth: AuthContext;
  apiKey: string;
  signingSecret: string;
  companyId: string;
}

export async function seedRobot(opts?: {
  financial?: boolean;
  allowedTypes?: string[] | null;
  companyId?: string;
}): Promise<SeededRobot> {
  const companyId = opts?.companyId ?? '11111111-1111-1111-1111-111111111111';
  const apiKey = generateApiKey();
  const signingSecret = generateSigningSecret();
  const apiKeyHash = await hashSecret(apiKey);
  const signingSecretHash = opts?.financial ? await hashSecret(signingSecret) : null;

  const id = await withTransaction((client) =>
    insertServiceAccount(client, {
      robotName: `robot-${Math.random().toString(36).slice(2, 8)}`,
      apiKeyHash,
      apiKeyPrefix: apiKey.substring(0, 8),
      signingSecretHash,
      companyId,
      allowedTypes: opts?.allowedTypes ?? null,
    }),
  );

  return {
    apiKey,
    signingSecret,
    companyId,
    auth: {
      serviceAccountId: id,
      robotName: 'test-robot',
      companyId,
      allowedTypes: opts?.allowedTypes ?? null,
      financiallySigned: !!opts?.financial,
    },
  };
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}
