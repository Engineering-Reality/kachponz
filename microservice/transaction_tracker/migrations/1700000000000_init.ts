import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Skema inti Amadeus Transaction State Tracker.
 * Semua tabel pakai uuid pk. transaction_events append-only (immutable).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createExtension('pgcrypto', { ifNotExists: true }); // gen_random_uuid()

  // ---- service_accounts: identitas robot/agent, terpisah dari user manusia ----
  // CISO APP_TI #29-40: service account unik, non-interaktif, least-privilege,
  // credential ter-hash, dapat dinonaktifkan.
  pgm.createTable('service_accounts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    robot_name: { type: 'text', notNull: true },
    api_key_hash: { type: 'text', notNull: true },
    // Financial signature layer: secret HMAC per-robot, di-hash saat disimpan.
    signing_secret_hash: { type: 'text', notNull: false },
    company_id: { type: 'uuid', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    // least-privilege: daftar step/type yang boleh diselesaikan robot ini (null = semua)
    allowed_types: { type: 'text[]', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    disabled_at: { type: 'timestamptz', notNull: false },
  });
  // robot_name unik hanya di antara yang aktif (partial unique).
  pgm.createIndex('service_accounts', 'robot_name', {
    unique: true,
    where: 'is_active = true',
    name: 'uq_service_accounts_active_name',
  });
  pgm.createIndex('service_accounts', 'company_id');

  // ---- transactions ----
  pgm.createTable('transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    type: { type: 'text', notNull: true },
    current_step: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'in_progress' },
    company_id: { type: 'uuid', notNull: true },
    version: { type: 'integer', notNull: true, default: 1 }, // optimistic lock
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('transactions', 'status');
  pgm.createIndex('transactions', 'type');
  pgm.createIndex('transactions', 'company_id');

  // ---- transaction_events: append-only audit trail ----
  // CISO APP_TI Audit Trail #76-104: catat identitas actor, event type, timestamp,
  // integritas terlindungi (immutable via trigger di bawah).
  pgm.createTable('transaction_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    transaction_id: {
      type: 'uuid',
      notNull: true,
      references: 'transactions',
      onDelete: 'RESTRICT',
    },
    step: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true },
    actor: { type: 'text', notNull: true }, // robot_name / agent id
    reason: { type: 'text', notNull: false }, // wajib untuk transisi mundur
    idempotency_key: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    // Jejak audit tambahan: apakah step ini melewati signature finansial.
    signed: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createConstraint('transaction_events', 'uq_txevent_idem', {
    unique: ['transaction_id', 'idempotency_key'],
  });
  pgm.createIndex('transaction_events', 'transaction_id');

  // Immutability: blok UPDATE/DELETE pada transaction_events (append-only).
  pgm.sql(`
    CREATE OR REPLACE FUNCTION amadeus_block_mutation() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'transaction_events bersifat append-only (immutable)';
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER trg_txevents_no_update
      BEFORE UPDATE OR DELETE ON transaction_events
      FOR EACH ROW EXECUTE FUNCTION amadeus_block_mutation();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TRIGGER IF EXISTS trg_txevents_no_update ON transaction_events;');
  pgm.sql('DROP FUNCTION IF EXISTS amadeus_block_mutation();');
  pgm.dropTable('transaction_events');
  pgm.dropTable('transactions');
  pgm.dropTable('service_accounts');
}
