/**
 * Amadeus A2A Protocol v1 — In-house Multi-Agent Coordination.
 *
 * Milik Bank Mandiri. Protokol ini dirancang internal untuk koordinasi antar-
 * robot RPA (UiPath, PAD) dan agent LLM (Qwen VL, dll) dalam alur settlement
 * Import LC/SKBDN/SBLC. Bukan produk vendor manapun.
 *
 * Prinsip desain (dari research umum multi-agent systems 2025-2026):
 *  - Agent Card discovery: kapabilitas orchestrator diekspos machine-readable.
 *  - JSON-RPC 2.0 sebagai transport request/response.
 *  - Task lifecycle multi-turn (submitted → working → completed/failed).
 *  - Streaming update via SSE (opsional).
 *  - Setiap message ditandatangani HMAC-SHA512, timestamp anti-replay.
 *
 * Backwards compat: server tetap terima envelope amadeus.a2a/0 (lihat protocol.ts).
 */

export const A2A_PROTOCOL_V1 = 'amadeus.a2a/1' as const;

// ---- JSON-RPC 2.0 envelope ----
export interface JsonRpcRequest<P = unknown> {
  jsonrpc: '2.0';
  id: string;
  method: A2AMethod;
  params: P;
}
export interface JsonRpcSuccess<R = unknown> {
  jsonrpc: '2.0';
  id: string;
  result: R;
}
export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | null;
  error: { code: number; message: string; data?: unknown };
}
export type JsonRpcResponse<R = unknown> = JsonRpcSuccess<R> | JsonRpcError;

// ---- Methods yang di-support ----
export type A2AMethod =
  | 'task.submit'
  | 'task.get'
  | 'task.cancel'
  | 'task.provideInput'
  | 'agent.card';

// ---- Task lifecycle ----
export type TaskState =
  | 'submitted'
  | 'working'
  | 'input_required'
  | 'completed'
  | 'failed'
  | 'canceled';

// ---- Params & Result untuk tiap method ----
export interface TaskSubmitParams {
  transactionId: string;
  step: string;
  correlationId: string;
  data?: Record<string, unknown>;
  signature?: {
    timestamp: string;
    hmac: string;
  };
}
export interface TaskSubmitResult {
  taskId: string;
  state: TaskState;
  transactionId: string;
  step: string;
  assigneeHint: string | null;
}

export interface TaskGetParams { taskId: string; }
export interface TaskGetResult {
  taskId: string;
  transactionId: string;
  step: string;
  state: TaskState;
  submittedBy: string;
  assigneeHint: string | null;
  correlationId: string;
  inputRequiredMsg: string | null;
  resultData: Record<string, unknown> | null;
  failReason: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    seq: number;
    role: 'client' | 'agent';
    messageType: string;
    content: Record<string, unknown>;
    sentAt: string;
  }>;
}

export interface TaskCancelParams { taskId: string; reason: string; }
export interface TaskCancelResult { taskId: string; state: TaskState; }

export interface TaskProvideInputParams {
  taskId: string;
  data: Record<string, unknown>;
}
export interface TaskProvideInputResult {
  taskId: string;
  state: TaskState;
}

// ---- Agent Card ----
export interface AgentCard {
  name: string;
  version: string;
  protocol: typeof A2A_PROTOCOL_V1;
  description: string;
  capabilities: Array<{
    step: string;
    types: string[];
    financial: boolean;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  }>;
  authentication: {
    schemes: Array<'robot_key' | 'hmac_signature' | 'oauth2_client_credentials'>;
    tokenEndpoint?: string;
  };
  endpoints: {
    rpc: string;
    stream: string;
    card: string;
  };
  supportedProtocols: string[];
}

// ---- Error codes ----
export const A2A_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TASK_NOT_FOUND: -32001,
  TASK_ALREADY_TERMINAL: -32002,
  SIGNATURE_REQUIRED: -32003,
  SIGNATURE_INVALID: -32004,
  STEP_MISMATCH: -32005,
  UNAUTHORIZED_ACTOR: -32006,
} as const;
