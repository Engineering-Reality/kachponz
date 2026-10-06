/**
 * Migration: Initial schema for Amadeus Transaction State Tracker
 *
 * Tables created:
 *   - service_accounts  (robot identities, separate from human users)
 *   - transactions      (state machine head record)
 *   - transaction_events (immutable append-only audit trail)
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = function (pgm) {
  // ── Enable uuid-ossp extension ──────────────────────────────
  pgm.createExtension("uuid-ossp", { ifNotExists: true });

  // ── service_accounts ────────────────────────────────────────
  // Represents a registered robot (UiPath / PAD). Never store
  // plaintext API keys here — only bcrypt/argon2 hashes.
  pgm.createTable("service_accounts", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    robot_name: { type: "text", notNull: true, unique: true },
    api_key_hash: { type: "text", notNull: true },
    company_id: { type: "uuid", notNull: true },
    is_active: { type: "boolean", notNull: true, default: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("service_accounts", "company_id");
  pgm.createIndex("service_accounts", "is_active");

  // ── transactions ─────────────────────────────────────────────
  // One row = one transaction (Import LC, SKBDN, SBLC, etc.)
  // version column supports optimistic locking.
  pgm.createTable("transactions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    type: { type: "text", notNull: true },
    current_step: { type: "text", notNull: true },
    status: {
      type: "text",
      notNull: true,
      check: "status IN ('active', 'completed', 'failed', 'cancelled')",
    },
    company_id: { type: "uuid", notNull: true },
    // Optimistic locking — incremented on every state transition.
    version: { type: "integer", notNull: true, default: 1 },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.createIndex("transactions", "company_id");
  pgm.createIndex("transactions", "status");
  pgm.createIndex("transactions", "type");
  pgm.createIndex("transactions", ["company_id", "status"]);

  // ── transaction_events ───────────────────────────────────────
  // Immutable audit trail.  NEVER UPDATE OR DELETE rows here.
  // The unique (transaction_id, idempotency_key) constraint ensures
  // robot retries are idempotent.
  pgm.createTable("transaction_events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    transaction_id: {
      type: "uuid",
      notNull: true,
      references: '"transactions"',
      onDelete: "CASCADE",
    },
    step: { type: "text", notNull: true },
    status: { type: "text", notNull: true },
    actor: { type: "text", notNull: true },
    // reason is required when rewinding (backward transition)
    reason: { type: "text" },
    // robots must supply this; prevents double-inserts on retry
    idempotency_key: { type: "text", notNull: true },
    payload: { type: "jsonb", default: "'{}'" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  // The core idempotency guarantee
  pgm.addConstraint(
    "transaction_events",
    "uq_transaction_events_idempotency",
    "UNIQUE (transaction_id, idempotency_key)"
  );

  pgm.createIndex("transaction_events", "transaction_id");
  pgm.createIndex("transaction_events", "created_at");

  // ── Row-level trigger: block updates/deletes on events ──────
  // This makes the audit table truly immutable at the DB level.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_event_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'transaction_events is append-only — mutations are forbidden';
    END;
    $$;

    CREATE TRIGGER trg_prevent_event_update
    BEFORE UPDATE OR DELETE ON transaction_events
    FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = function (pgm) {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_prevent_event_update ON transaction_events;
    DROP FUNCTION IF EXISTS prevent_event_mutation();
  `);
  pgm.dropTable("transaction_events");
  pgm.dropTable("transactions");
  pgm.dropTable("service_accounts");
};
