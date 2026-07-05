export interface ServiceAccount {
  id: string;
  robot_name: string;
  api_key_hash: string;
  signing_secret_hash: string | null;
  company_id: string;
  is_active: boolean;
  allowed_types: string[] | null;
  created_at: string;
  disabled_at: string | null;
}

export interface Transaction {
  id: string;
  type: string;
  current_step: string;
  status: string;
  company_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionEvent {
  id: string;
  transaction_id: string;
  step: string;
  status: string;
  actor: string;
  reason: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
  signed: boolean;
  created_at: string;
}

/** Konteks auth yang di-attach ke request setelah middleware auth lolos. */
export interface AuthContext {
  serviceAccountId: string;
  robotName: string;
  companyId: string;
  allowedTypes: string[] | null;
  /** true bila request lolos signature finansial (bukan sekadar X-Robot-Key). */
  financiallySigned: boolean;
}

/** Error domain terstruktur (bukan stack trace ke klien — CISO Code Review #27/#32). */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
