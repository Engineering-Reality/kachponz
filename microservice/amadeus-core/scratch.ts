import { hashSecret } from './src/lib/crypto.js';
import { withTransaction } from './src/db/pool.js';
import { insertServiceAccount } from './src/services/serviceAccounts.js';

async function main() {
  const apiKey = "amadeus_local_dev";
  const apiKeyHash = await hashSecret(apiKey);
  const id = await withTransaction((client) =>
    insertServiceAccount(client, {
      robotName: "Amadeus Local Dev",
      apiKeyHash,
      apiKeyPrefix: apiKey.substring(0, 8),
      signingSecretHash: null,
      companyId: "00000000-0000-0000-0000-000000000000",
      allowedTypes: null,
    }),
  );
  console.log("Inserted local dev robot with ID: " + id);
  process.exit(0);
}

main().catch(console.error);
