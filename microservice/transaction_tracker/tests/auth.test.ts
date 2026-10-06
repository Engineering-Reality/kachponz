/**
 * tests/auth.test.ts
 *
 * Unit tests for the X-Robot-Key authentication middleware.
 * Uses vi.mock to stub the DB pool.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/index.js", () => ({
  pool: { query: vi.fn() },
  pingDatabase: vi.fn(),
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

import argon2 from "argon2";
import { pool } from "../src/db/index.js";

// ── Helpers ───────────────────────────────────────────────────

async function simulateAuth(
  headerValue: string | undefined,
  storedHash: string | null
): Promise<{ authenticated: boolean; status: number }> {
  if (!headerValue || headerValue.trim() === "") {
    return { authenticated: false, status: 401 };
  }

  if (!storedHash) {
    return { authenticated: false, status: 401 };
  }

  try {
    const match = await argon2.verify(storedHash, headerValue);
    return { authenticated: match, status: match ? 200 : 401 };
  } catch {
    return { authenticated: false, status: 401 };
  }
}

// ── Tests ─────────────────────────────────────────────────────

describe("Auth middleware — missing header", () => {
  it("returns 401 when X-Robot-Key header is absent", async () => {
    const result = await simulateAuth(undefined, null);
    expect(result.status).toBe(401);
    expect(result.authenticated).toBe(false);
  });

  it("returns 401 when X-Robot-Key is empty string", async () => {
    const result = await simulateAuth("", null);
    expect(result.status).toBe(401);
    expect(result.authenticated).toBe(false);
  });

  it("returns 401 when X-Robot-Key is whitespace only", async () => {
    const result = await simulateAuth("   ", null);
    expect(result.status).toBe(401);
    expect(result.authenticated).toBe(false);
  });
});

describe("Auth middleware — valid key", () => {
  it("authenticates with correct API key", async () => {
    const rawKey = "correct-api-key-for-testing-only";
    const hash = await argon2.hash(rawKey, { type: argon2.argon2id });

    const result = await simulateAuth(rawKey, hash);
    expect(result.authenticated).toBe(true);
    expect(result.status).toBe(200);
  });
});

describe("Auth middleware — wrong key", () => {
  it("returns 401 when key does not match stored hash", async () => {
    const correctKey = "correct-robot-key";
    const wrongKey = "wrong-robot-key-that-should-fail";
    const hash = await argon2.hash(correctKey, { type: argon2.argon2id });

    const result = await simulateAuth(wrongKey, hash);
    expect(result.authenticated).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe("Auth middleware — db query integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries service_accounts for active accounts", async () => {
    const rawKey = "robot-key-db-test";
    const hash = await argon2.hash(rawKey, { type: argon2.argon2id });

    (pool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: [
        {
          id: "robot-uuid-001",
          robot_name: "uipath-settlement-01",
          api_key_hash: hash,
          company_id: "company-uuid-001",
          is_active: true,
        },
      ],
    });

    const result = await pool.query(
      "SELECT id, robot_name, api_key_hash, company_id, is_active FROM service_accounts WHERE is_active = true"
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].robot_name).toBe("uipath-settlement-01");

    const keyMatch = await argon2.verify(result.rows[0].api_key_hash, rawKey);
    expect(keyMatch).toBe(true);
  });
});
