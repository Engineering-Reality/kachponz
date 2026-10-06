/**
 * schemas/transaction.ts — Zod schemas for request/response validation.
 *
 * Mirrors the Pydantic model pattern from agent_backend/routes/agents.py
 * but using Zod for TypeScript.
 */
import { z } from "zod";
import { SUPPORTED_TYPES } from "../config/stepFlows.js";

// ── Request schemas ──────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  type: z.enum(SUPPORTED_TYPES as [string, ...string[]], {
    errorMap: () => ({
      message: `type must be one of: ${SUPPORTED_TYPES.join(", ")}`,
    }),
  }),
  company_id: z.string().uuid({ message: "company_id must be a valid UUID" }),
  // Optional metadata
  metadata: z.record(z.unknown()).optional().default({}),
});

export const CompleteStepSchema = z.object({
  status: z.enum(["success", "failed"], {
    errorMap: () => ({ message: "status must be 'success' or 'failed'" }),
  }),
  actor: z
    .string()
    .min(1, "actor (robot name) is required")
    .max(200),
  reason: z
    .string()
    .max(1000)
    .optional()
    .nullable(),
  // Must be unique per (transaction_id, idempotency_key) — robot sends
  // a deterministic key (e.g. job run ID) so retries are safe.
  idempotency_key: z
    .string()
    .min(1, "idempotency_key is required")
    .max(255),
  payload: z.record(z.unknown()).optional().default({}),
});

export const ListTransactionsQuerySchema = z.object({
  status: z
    .enum(["active", "completed", "failed", "cancelled"])
    .optional(),
  type: z.enum(SUPPORTED_TYPES as [string, ...string[]]).optional(),
  company_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Types inferred from schemas ──────────────────────────────

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CompleteStepInput = z.infer<typeof CompleteStepSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
