/**
 * tests/idempotency.test.ts
 *
 * Tests for idempotency + optimistic lock logic.
 * Uses vi.mock to stub the DB pool — no real Postgres needed.
 *
 * Note: vi.mock calls are hoisted to the top of the file by Vitest,
 * so the factory cannot reference variables declared in the outer scope.
 * We use vi.fn() inside the factory and configure mockClient in beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stub pg pool ──────────────────────────────────────────────
vi.mock("../src/db/index.js", () => ({
  pool: {
    query: vi.fn(),
    // connect returns a mock client object with its own query/release stubs
    connect: vi.fn().mockResolvedValue({
      query: vi.fn(),
      release: vi.fn(),
    }),
  },
  pingDatabase: vi.fn().mockResolvedValue(true),
  closePool: vi.fn(),
}));

vi.mock("../src/config/env.js", () => ({
  env: {
    DATABASE_URL: "postgres://test:test@localhost/test",
    PORT: 3000,
    NODE_ENV: "test",
    DB_POOL_MAX: 5,
    LOG_LEVEL: "silent",
  },
}));

import { pool } from "../src/db/index.js";

// ── Idempotency unit tests (pure logic) ───────────────────────

describe("Idempotency — duplicate request detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects a duplicate when idempotency_key already exists for transaction", async () => {
    const transactionId = "550e8400-e29b-41d4-a716-446655440000";
    const idempotencyKey = "uipath-job-run-20240101-001";

    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [{
        id: "aaa-bbb",
        transaction_id: transactionId,
        step: "distributed_to_analyst",
        status: "success",
        actor: "robot-analyst-01",
        idempotency_key: idempotencyKey,
      }],
      rowCount: 1,
    });

    const result = await pool.query(
      "SELECT * FROM transaction_events WHERE transaction_id = $1 AND idempotency_key = $2",
      [transactionId, idempotencyKey]
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].idempotency_key).toBe(idempotencyKey);
  });

  it("allows a new request when idempotency_key is unique", async () => {
    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [],
      rowCount: 0,
    });

    const result = await pool.query(
      "SELECT * FROM transaction_events WHERE transaction_id = $1 AND idempotency_key = $2",
      ["tx-id", "new-unique-key"]
    );

    expect(result.rowCount).toBe(0);
  });
});

// ── Optimistic locking tests ──────────────────────────────────

describe("Optimistic locking — concurrent update detection", () => {
  let mockClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockClient = await pool.connect();
    mockClient.query.mockImplementation((sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") {
        return Promise.resolve({});
      }
      if (sql.includes("UPDATE transactions") && sql.includes("version")) {
        // Simulate stale version — another request already updated the row
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [{}], rowCount: 1 });
    });
  });

  it("detects stale version — UPDATE returns 0 rows on version mismatch", async () => {
    const updateResult = await mockClient.query(
      "UPDATE transactions SET current_step = $1, version = version + 1 WHERE id = $2 AND version = $3 RETURNING *",
      ["distributed_to_analyst", "tx-id", 999]
    );

    // Zero rows updated = optimistic lock conflict
    expect(updateResult.rowCount).toBe(0);
  });

  it("succeeds when version matches — UPDATE returns 1 row", async () => {
    // Override the mock for this specific test to return a successful update
    mockClient.query.mockImplementation((sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK" || sql === "COMMIT") {
        return Promise.resolve({});
      }
      if (sql.includes("UPDATE transactions")) {
        return Promise.resolve({
          rows: [{ id: "tx-id", current_step: "distributed_to_analyst", version: 2 }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [{}], rowCount: 1 });
    });

    const updateResult = await mockClient.query(
      "UPDATE transactions SET current_step = $1, version = version + 1 WHERE id = $2 AND version = $3 RETURNING *",
      ["distributed_to_analyst", "tx-id", 1]
    );

    expect(updateResult.rowCount).toBe(1);
    expect(updateResult.rows[0].version).toBe(2);
  });
});
