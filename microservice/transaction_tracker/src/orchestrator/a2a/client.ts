import type {
  TaskSubmitParams,
  TaskSubmitResult,
  TaskGetResult,
  TaskCancelResult,
  TaskProvideInputResult,
  AgentCard,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess
} from './protocol_v1.js';
import { createHash, createHmac } from 'node:crypto';

export class A2AClient {
  constructor(
    private baseUrl: string, 
    private robotKey: string, 
    private signingSecret?: string
  ) {}

  private async rpcCall<T>(method: string, params: unknown, includeSignature: boolean = false): Promise<T> {
    const id = Math.random().toString(36).substring(7);
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method: method as any,
      params,
    };
    
    const rawBody = JSON.stringify(body);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Robot-Key': this.robotKey,
    };

    if (includeSignature && this.signingSecret) {
      const ts = Math.floor(Date.now() / 1000).toString();
      const bodySha256 = createHash('sha256').update(rawBody, 'utf8').digest('hex');
      const payload = `POST\n/a2a/rpc\n${ts}\n${bodySha256}`;
      const hmac = createHmac('sha512', this.signingSecret).update(payload, 'utf8').digest('hex');
      
      headers['X-Signature'] = hmac;
      headers['X-Robot-Timestamp'] = ts;
      headers['X-Robot-Signing-Secret'] = this.signingSecret;
    }

    const res = await fetch(`${this.baseUrl}/a2a/rpc`, {
      method: 'POST',
      headers,
      body: rawBody
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const resData = await res.json() as JsonRpcResponse<T>;
    if ('error' in resData) {
      throw new Error(`RPC Error [${resData.error.code}]: ${resData.error.message}`);
    }

    return resData.result;
  }

  async submitTask(params: TaskSubmitParams): Promise<TaskSubmitResult> {
    return this.rpcCall<TaskSubmitResult>('task.submit', params, !!params.signature);
  }

  async getTask(taskId: string): Promise<TaskGetResult> {
    return this.rpcCall<TaskGetResult>('task.get', { taskId });
  }

  async cancelTask(taskId: string, reason: string): Promise<TaskCancelResult> {
    return this.rpcCall<TaskCancelResult>('task.cancel', { taskId, reason });
  }

  async provideInput(taskId: string, data: Record<string, unknown>): Promise<TaskProvideInputResult> {
    return this.rpcCall<TaskProvideInputResult>('task.provideInput', { taskId, data });
  }

  async getAgentCard(): Promise<AgentCard> {
    // Agent card can be retrieved via RPC or HTTP GET. Here we use RPC.
    return this.rpcCall<AgentCard>('agent.card', {});
  }

  async streamTask(taskId: string, onUpdate: (task: TaskGetResult) => void, signal: AbortSignal): Promise<void> {
    const res = await fetch(`${this.baseUrl}/a2a/tasks/${taskId}/stream`, {
      headers: {
        'X-Robot-Key': this.robotKey
      },
      signal
    });
    
    if (!res.ok || !res.body) {
      throw new Error(`Failed to stream task: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (chunk.startsWith('event: update\ndata: ')) {
            const dataStr = chunk.slice('event: update\ndata: '.length);
            try {
              const task = JSON.parse(dataStr) as TaskGetResult;
              onUpdate(task);
            } catch (e) {
              console.error('Failed to parse SSE data', e);
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        throw e;
      }
    }
  }
}
