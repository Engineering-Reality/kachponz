/**
 * errors/index.ts — Structured error classes, ported from
 * agent_backend/boilerplate/errors.py but in TypeScript.
 *
 * All API errors follow the same envelope:
 * {
 *   "error": {
 *     "code": "NOT_FOUND",
 *     "message": "Transaction with ID ... not found",
 *     "additional_info": { ... }
 *   }
 * }
 */

export interface ErrorPayload {
  code: string;
  message: string;
  additional_info: Record<string, unknown>;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly payload: ErrorPayload;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    additional_info: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.payload = { code, message, additional_info };
  }

  toResponse() {
    return { error: this.payload };
  }
}

// ── 4xx ──────────────────────────────────────────────────────

export class BadRequestError extends ApiError {
  constructor(message: string, additional_info?: Record<string, unknown>) {
    super(400, "BAD_REQUEST", message, additional_info);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(
    message = "Authentication required",
    additional_info?: Record<string, unknown>
  ) {
    super(401, "UNAUTHORIZED", message, additional_info);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(
    message = "Access forbidden",
    additional_info?: Record<string, unknown>
  ) {
    super(403, "FORBIDDEN", message, additional_info);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, additional_info?: Record<string, unknown>) {
    super(404, "NOT_FOUND", message, additional_info);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, additional_info?: Record<string, unknown>) {
    super(409, "CONFLICT", message, additional_info);
    this.name = "ConflictError";
  }
}

export class UnprocessableError extends ApiError {
  constructor(message: string, additional_info?: Record<string, unknown>) {
    super(422, "UNPROCESSABLE_ENTITY", message, additional_info);
    this.name = "UnprocessableError";
  }
}

// ── 5xx ──────────────────────────────────────────────────────

export class InternalServerError extends ApiError {
  constructor(
    message = "Internal server error",
    additional_info?: Record<string, unknown>
  ) {
    super(500, "INTERNAL_SERVER_ERROR", message, additional_info);
    this.name = "InternalServerError";
  }
}

/** Check if an error thrown by pg is a unique constraint violation */
export function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
