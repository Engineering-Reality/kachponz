import type { AuthContext, DomainError } from '../../types/domain.js';
import { A2A_ERROR } from './protocol_v1.js';
import type { 
  JsonRpcRequest, 
  JsonRpcResponse,
  TaskSubmitParams,
  TaskGetParams,
  TaskCancelParams,
  TaskProvideInputParams
} from './protocol_v1.js';
import * as a2aTasks from '../../services/a2aTasks.js';
import { buildAgentCard } from './agentCard.js';
import { txLogger } from '../../lib/logger.js';

function formatError(id: string | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data }
  };
}

function mapDomainError(id: string, err: any): JsonRpcResponse {
  if (err.name === 'DomainError') {
    const dErr = err as DomainError;
    let code: number = A2A_ERROR.INTERNAL_ERROR;
    switch (dErr.code) {
      case 'TASK_NOT_FOUND': code = A2A_ERROR.TASK_NOT_FOUND; break;
      case 'TASK_TERMINAL': code = A2A_ERROR.TASK_ALREADY_TERMINAL; break;
      case 'STEP_MISMATCH': code = A2A_ERROR.STEP_MISMATCH; break;
      case 'INVALID_STEP': code = A2A_ERROR.INVALID_PARAMS; break;
    }
    return formatError(id, code, dErr.message, dErr.details);
  }
  return formatError(id, A2A_ERROR.INTERNAL_ERROR, 'Internal Server Error');
}

export async function handleRpc(
  req: JsonRpcRequest,
  auth: AuthContext,
  rawBody: string,
): Promise<JsonRpcResponse> {
  const log = txLogger('rpc-handler');
  
  try {
    switch (req.method) {
      case 'task.submit': {
        const p = req.params as TaskSubmitParams;
        if (!p.transactionId || !p.step || !p.correlationId) {
          return formatError(req.id, A2A_ERROR.INVALID_PARAMS, 'Missing required params');
        }
        
        const task = await a2aTasks.submitTask({
          transactionId: p.transactionId,
          step: p.step,
          correlationId: p.correlationId,
          submittedBy: auth.serviceAccountId,
          data: p.data,
          clientMessageBody: req,
          signatureHmac: p.signature?.hmac,
          signatureTimestamp: p.signature?.timestamp
        });
        
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            taskId: task.id,
            state: task.state,
            transactionId: task.transaction_id,
            step: task.step,
            assigneeHint: task.assignee_hint
          }
        };
      }
      
      case 'task.get': {
        const p = req.params as TaskGetParams;
        const { task, messages } = await a2aTasks.getTaskWithMessages(p.taskId);
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            taskId: task.id,
            transactionId: task.transaction_id,
            step: task.step,
            state: task.state,
            submittedBy: task.submitted_by,
            assigneeHint: task.assignee_hint,
            correlationId: task.correlation_id,
            inputRequiredMsg: task.input_required_msg,
            resultData: task.result_data,
            failReason: task.fail_reason,
            createdAt: task.created_at.toISOString(),
            updatedAt: task.updated_at.toISOString(),
            messages: messages.map(m => ({
              seq: m.seq,
              role: m.role,
              messageType: m.message_type,
              content: m.content,
              sentAt: m.sent_at.toISOString()
            }))
          }
        };
      }
      
      case 'task.cancel': {
        const p = req.params as TaskCancelParams;
        const task = await a2aTasks.cancelTask(p.taskId, auth.serviceAccountId, p.reason);
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            taskId: task.id,
            state: task.state
          }
        };
      }
      
      case 'task.provideInput': {
        const p = req.params as TaskProvideInputParams;
        const task = await a2aTasks.provideInput(p.taskId, auth.serviceAccountId, p.data);
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            taskId: task.id,
            state: task.state
          }
        };
      }
      
      case 'agent.card': {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: buildAgentCard()
        };
      }
      
      default:
        return formatError(req.id, A2A_ERROR.METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
  } catch (err: any) {
    log.error({ err, method: req.method }, 'RPC Handler error');
    return mapDomainError(req.id, err);
  }
}
