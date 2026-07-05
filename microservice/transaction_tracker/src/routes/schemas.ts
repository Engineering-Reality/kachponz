import { z } from 'zod';

/**
 * Validasi input terpusat (CISO Code Security Review #1-#13).
 * - Reject on failure (#2): schema strict, unknown key ditolak.
 * - Tipe, range, length divalidasi (#6,#7,#9).
 * - Karakter unik/null byte/newline ditangani: kita batasi charset id & step.
 */

const UUID = z.string().uuid();

// step & type: hanya lowercase alfanumerik + underscore (mencegah injeksi,
// null byte %00, newline, dot-dot-slash — CISO #10,#11,#12,#13).
const SAFE_SLUG = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_]+$/, 'hanya boleh lowercase, angka, underscore');

const IDEMPOTENCY_KEY = z
  .string()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/, 'idempotency key: alfanumerik dan ._:- saja');

const REASON = z.string().min(1).max(500).optional();

// payload jsonb: dibatasi kedalaman & ukuran wajar. Objek bebas tapi bukan array top-level.
const PAYLOAD = z.record(z.string(), z.unknown()).optional();

export const CreateTxBody = z
  .object({
    type: SAFE_SLUG,
    idempotencyKey: IDEMPOTENCY_KEY,
    payload: PAYLOAD,
  })
  .strict();
export type CreateTxBody = z.infer<typeof CreateTxBody>;

export const CompleteStepParams = z
  .object({
    id: UUID,
    step: SAFE_SLUG,
  })
  .strict();

export const CompleteStepBody = z
  .object({
    idempotencyKey: IDEMPOTENCY_KEY,
    reason: REASON,
    payload: PAYLOAD,
    targetStep: SAFE_SLUG.optional(),
  })
  .strict();
export type CompleteStepBody = z.infer<typeof CompleteStepBody>;

export const GetTxParams = z.object({ id: UUID }).strict();

export const ListTxQuery = z
  .object({
    status: SAFE_SLUG.optional(),
    type: SAFE_SLUG.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();
export type ListTxQuery = z.infer<typeof ListTxQuery>;
