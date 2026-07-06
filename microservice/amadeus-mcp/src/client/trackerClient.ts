/**
 * trackerClient.ts
 *
 * Thin HTTP client wrapping the transaction_tracker REST API.
 * Reads config from environment at call time (not module load) so tests
 * can override process.env before importing.
 *
 * All requests include X-Robot-Key header.
 * Financial step requests (completeStep with signature) also include
 * X-Robot-Timestamp, X-Robot-Signing-Secret, X-Signature.
 *
 * X-Signature is HMAC-SHA512 over `METHOD\nPATH\nTIMESTAMP\nsha256(body)`,
 * matching transaction_tracker's verifyFinancialSignature (see
 * transaction_tracker/src/middleware/auth.ts + lib/crypto.ts). The signing
 * secret is still sent via X-Robot-Signing-Secret because the server verifies
 * it against the stored argon2 hash and uses it as the HMAC key — this is the
 * server's current 2FA design, not an oversight.
 */
import { createHmac, createHash } from "node:crypto";

export interface ListTransactionsParams {
  status?: "in_progress" | "completed" | "failed";
  type?: "import_lc" | "skbdn" | "sblc";
  limit?: number;
}

export interface CreateTransactionParams {
  type: "import_lc" | "skbdn" | "sblc";
  idempotencyKey: string;
}

export interface CompleteStepParams {
  transactionId: string;
  step: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  signature?: {
    timestamp: string;
    secret: string;
  };
}

export interface FailStepParams {
  transactionId: string;
  step: string;
  reason: string;
  idempotencyKey: string;
}

export interface DispatchStepParams {
  transactionId: string;
  idempotencyKey: string;
}

export interface ExplainRouteParams {
  step: string;
  type: string;
}

function getConfig(): { apiBase: string; robotKey: string; signaturePepper: string } {
  const apiBase = process.env["AMADEUS_API_BASE"] ?? "http://127.0.0.1:8080";
  const robotKey = process.env["AMADEUS_ROBOT_KEY"] ?? "";
  const signaturePepper = process.env["AMADEUS_SIGNATURE_PEPPER"] ?? "";
  return { apiBase, robotKey, signaturePepper };
}

async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<unknown> {
  const { apiBase, robotKey } = getConfig();
  const url = `${apiBase}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Robot-Key": robotKey,
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(
      `tracker API ${method} ${path} → ${res.status}: ${text.substring(0, 200)}`
    );
  }

  return text.length > 0 ? JSON.parse(text) : null;
}

// ── Transactions ────────────────────────────────────────────────────────────

export async function listTransactions(
  params: ListTransactionsParams
): Promise<unknown> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return apiRequest("GET", `/transactions${query ? `?${query}` : ""}`);
}

export async function getTransaction(id: string): Promise<unknown> {
  return apiRequest("GET", `/transactions/${encodeURIComponent(id)}`);
}

export async function createTransaction(
  params: CreateTransactionParams
): Promise<unknown> {
  return apiRequest("POST", "/transactions", {
    type: params.type,
    idempotencyKey: params.idempotencyKey,
    payload: {},
  });
}

export async function completeStep(params: CompleteStepParams): Promise<unknown> {
  const extraHeaders: Record<string, string> = {};
  const path = `/transactions/${encodeURIComponent(params.transactionId)}/steps/${encodeURIComponent(params.step)}/complete`;
  const body = {
    idempotencyKey: params.idempotencyKey,
    payload: params.payload ?? {},
  };

  if (params.signature) {
    const { signaturePepper } = getConfig();
    const method = "POST";
    const timestamp = params.signature.timestamp;
    const bodySha = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const signaturePayload = `${method}\n${path}\n${timestamp}\n${bodySha}`;
    const hmacKey = signaturePepper
      ? `${params.signature.secret}:${signaturePepper}`
      : params.signature.secret;
    const hmac = createHmac("sha512", hmacKey).update(signaturePayload).digest("hex");

    extraHeaders["X-Robot-Timestamp"] = timestamp;
    extraHeaders["X-Robot-Signing-Secret"] = params.signature.secret;
    extraHeaders["X-Signature"] = hmac;
  }

  return apiRequest("POST", path, body, extraHeaders);
}

export async function failStep(params: FailStepParams): Promise<unknown> {
  // failStep in transaction_tracker is done via A2A envelope at POST /a2a
  return apiRequest("POST", "/a2a", {
    protocol: "amadeus.a2a/0",
    type: "task.failed",
    transactionId: params.transactionId,
    step: params.step,
    idempotencyKey: params.idempotencyKey,
    correlationId: `mcp:fail:${params.step}`,
    reason: params.reason,
    data: {},
    sentAt: new Date().toISOString(),
  });
}

export async function dispatchStep(params: DispatchStepParams): Promise<unknown> {
  return apiRequest("POST", "/orchestrator/dispatch", {
    transactionId: params.transactionId,
    idempotencyKey: params.idempotencyKey,
  });
}

export async function listExecutors(): Promise<unknown> {
  return apiRequest("GET", "/orchestrator/executors");
}

export async function explainRoute(params: ExplainRouteParams): Promise<unknown> {
  const qs = new URLSearchParams({ step: params.step, type: params.type });
  return apiRequest("GET", `/orchestrator/route?${qs.toString()}`);
}
