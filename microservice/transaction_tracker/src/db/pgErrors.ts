import { DomainError } from '../types/domain.js';

const PG_ERROR_MAP: Record<string, { code: string; message: string; status: number }> = {
  P0002: { code: 'NOT_FOUND', message: 'Transaksi tidak ditemukan', status: 404 },
  P0003: { code: 'VERSION_CONFLICT', message: 'Update konkuren ditolak (optimistic lock)', status: 409 },
};

/** Maps a custom SQLSTATE raised by a `db/functions/*.sql` RPC to a DomainError. */
export function mapPgFunctionError(err: unknown): DomainError | null {
  const code = (err as { code?: string } | undefined)?.code;
  const mapped = code ? PG_ERROR_MAP[code] : undefined;
  return mapped ? new DomainError(mapped.code, mapped.message, mapped.status) : null;
}
