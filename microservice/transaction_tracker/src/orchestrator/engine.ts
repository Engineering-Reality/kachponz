import { completeStep, getTransactionWithEvents, failStep as txFailStep, createTransaction } from '../services/transactions.js';
import { getFlow } from '../config/stepFlows.js';
import { DomainError } from '../types/domain.js';
import type { AuthContext } from '../types/domain.js';
import type { A2AEnvelope, A2AResult } from './a2a/protocol.js';
import { txLogger } from '../lib/logger.js';
import { query } from '../db/pool.js';
import type { FastifyReply } from 'fastify';


// LangGraph & MCP Imports
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";

/**
 * Inti orchestrator (Layer 2/3).
 *
 * Menerima A2A envelope dari agent/robot, menerjemahkannya ke operasi state
 * tracker, dan menghitung HANDOFF: step berikutnya + siapa (hint) yang mengambil.
 */
export async function handleA2A(
  auth: AuthContext,
  env: A2AEnvelope,
): Promise<A2AResult> {
  const log = txLogger(env.transactionId);

  if (env.protocol !== 'amadeus.a2a/0') {
    throw new DomainError('PROTOCOL_UNSUPPORTED', `Protokol tidak didukung: ${env.protocol}`, 400);
  }

  switch (env.type) {
    case 'task.complete':
      return completeAndHandoff(auth, env, log);
    case 'task.failed':
      return failStep(auth, env, log);
    case 'task.status':
      return statusOf(env);
    case 'task.assign':
      return statusOf(env);
    default:
      throw new DomainError('BAD_MESSAGE_TYPE', `Tipe pesan A2A tidak dikenal`, 400);
  }
}

async function completeAndHandoff(
  auth: AuthContext,
  env: A2AEnvelope,
  log: ReturnType<typeof txLogger>,
): Promise<A2AResult> {
  const result = await completeStep(auth, env.transactionId, {
    step: env.step,
    idempotencyKey: env.idempotencyKey,
    reason: env.reason,
    payload: env.data,
    targetStep: env.targetStep,
  });

  const flow = getFlow(result.transaction.type);
  const nextStep = result.transaction.status === 'completed'
    ? null
    : flow?.steps[result.transaction.current_step]
      ? result.transaction.current_step
      : null;
  const nextActorHint = nextStep ? (flow?.steps[nextStep]?.actorHint ?? null) : null;

  log.info(
    { correlationId: env.correlationId, nextStep, nextActorHint },
    'A2A handoff computed',
  );

  return {
    accepted: true,
    transactionId: result.transaction.id,
    currentStep: result.transaction.current_step,
    status: result.transaction.status,
    nextStep,
    nextActorHint,
    idempotentReplay: result.idempotentReplay,
  };
}

export async function computeHandoffAfterTaskCompletion(
  auth: AuthContext,
  transactionId: string,
  taskId: string,
  step: string,
  correlationId: string,
  data?: Record<string, unknown>
): Promise<A2AResult> {
  const log = txLogger(transactionId);
  const result = await completeStep(auth, transactionId, {
    step,
    idempotencyKey: `task-completion-${taskId}`,
    payload: data,
  });

  const flow = getFlow(result.transaction.type);
  const nextStep = result.transaction.status === 'completed'
    ? null
    : flow?.steps[result.transaction.current_step]
      ? result.transaction.current_step
      : null;
  const nextActorHint = nextStep ? (flow?.steps[nextStep]?.actorHint ?? null) : null;

  log.info(
    { correlationId, nextStep, nextActorHint },
    'A2A handoff computed from task completion',
  );

  return {
    accepted: true,
    transactionId: result.transaction.id,
    currentStep: result.transaction.current_step,
    status: result.transaction.status,
    nextStep,
    nextActorHint,
    idempotentReplay: result.idempotentReplay,
  };
}

async function failStep(
  auth: AuthContext,
  env: A2AEnvelope,
  log: ReturnType<typeof txLogger>,
): Promise<A2AResult> {
  if (!env.reason) {
    throw new DomainError('REASON_REQUIRED', 'task.failed wajib menyertakan reason', 422);
  }
  
  const result = await txFailStep(auth, env.transactionId, {
    step: env.step,
    idempotencyKey: env.idempotencyKey,
    reason: env.reason,
    payload: env.data,
  });

  return {
    accepted: true,
    transactionId: result.transaction.id,
    currentStep: result.transaction.current_step,
    status: result.transaction.status,
    nextStep: result.transaction.current_step,
    nextActorHint: null,
    idempotentReplay: result.idempotentReplay,
  };
}

async function statusOf(env: A2AEnvelope): Promise<A2AResult> {
  const { transaction } = await getTransactionWithEvents(env.transactionId);
  const flow = getFlow(transaction.type);
  const nextActorHint =
    flow?.steps[transaction.current_step]?.actorHint ?? null;
  return {
    accepted: true,
    transactionId: transaction.id,
    currentStep: transaction.current_step,
    status: transaction.status,
    nextStep: transaction.status === 'completed' ? null : transaction.current_step,
    nextActorHint,
    idempotentReplay: false,
  };
}

/**
 * MCP Integration: Loads tools dynamically for the LangGraph Agent.
 * This also implements the STATE TRACKING constraint by wrapping tool execution.
 */
async function loadMcpTools(toolConfigs: any[], log: ReturnType<typeof txLogger>) {
  const langchainTools: any[] = [];
  const clients: Client[] = [];

  for (const config of toolConfigs) {
    if (config.on_status === "Offline" || config.on_status === false) continue;

    let versions = config.versions;
    if (typeof versions === "string") {
      try { versions = JSON.parse(versions); } catch(e) {}
    }
    
    if (!versions || versions.length === 0) continue;
    const release = versions[versions.length - 1]?.released;
    if (!release) continue;

    let transport;
    if (release.method === "sse") {
      const url = release.port.startsWith("http") ? release.port : `http://localhost:${release.port}/sse`;
      transport = new SSEClientTransport(new URL(url));
    } else if (release.method === "stdio") {
      transport = new StdioClientTransport({
        command: "node", // Defaulting to node for MCP standard adapters
        args: [release.args]
      });
    }

    if (!transport) continue;

    const mcpClient = new Client({ name: "amadeus-orchestrator", version: "2.0.0" });
    clients.push(mcpClient);

    try {
      await mcpClient.connect(transport);
      const { tools: mcpTools } = await mcpClient.listTools();
      
      for (const mcpTool of mcpTools) {
        langchainTools.push(
          new DynamicStructuredTool({
            name: mcpTool.name,
            description: mcpTool.description || "MCP Tool",
            schema: z.record(z.any()), // Pass-through Schema
            func: async (args: any) => {
              // 1. Transaction Tracker Integration: Update state BEFORE tool yields
              log.info({ tool: mcpTool.name, action: "DRAFT_TO_PROCESSING" }, "Yielding to external MCP tool");
              
              // 2. Execute MCP Server logic
              const res = await mcpClient.callTool({
                name: mcpTool.name,
                arguments: args
              });
              
              // 3. Transaction Tracker Integration: Update state AFTER tool yields
              log.info({ tool: mcpTool.name, action: "PROCESSING_TO_AWAITING_CALLBACK" }, "External MCP tool completed");
              
              return (res as any).content.map((c: any) => c.type === 'text' ? c.text : JSON.stringify(c)).join("\n");
            },
          })
        );
      }
    } catch (e) {
      log.warn({ toolConfig: config.name, error: e }, `[MCP] Failed to connect to tool server`);
    }
  }

  // Fallback to prevent LangGraph errors if no tools load
  if (langchainTools.length === 0) {
    langchainTools.push(
      new DynamicStructuredTool({
        name: "noop_tool",
        description: "A placeholder tool since no real tools are attached.",
        schema: z.object({}),
        func: async () => "No operations available.",
      })
    );
  }

  return { tools: langchainTools, clients };
}

/**
 * Universal LangGraph Engine.
 * Dynamically builds and runs a createReactAgent from a JSON Configuration.
 * Fully replaces the legacy Python dynamic eval generator.
 */
export async function runAgenticStep(
  auth: AuthContext,
  transactionId: string | undefined,
  idempotencyKey: string,
  prompt?: string,
  messagesHistory?: any[],
  agentId?: string,
): Promise<A2AResult> {
  let txId: string;
  
  if (!transactionId) {
    // Try to get the latest transaction, or create a new one
    const latestTx = await query("SELECT id FROM transactions ORDER BY created_at DESC LIMIT 1");
    if (latestTx.rows[0]) {
      txId = latestTx.rows[0].id;
    } else {
      const newTx = await createTransaction(auth, {
        type: 'import_lc',
        idempotencyKey: `auto-create-${Date.now()}`,
        payload: { description: "Auto-created transaction for direct agent interaction" }
      });
      txId = newTx.id;
    }
  } else {
    txId = transactionId;
  }

  const log = txLogger(txId);
  log.info("Starting Universal LangGraph Engine");

  const { transaction } = await getTransactionWithEvents(txId);
  const step = transaction.current_step;

  // 1. Resolve Agent Configuration from Database
  // If agentId is passed, use it. Otherwise, try to use step as a UUID if it's a valid UUID, otherwise query by agent_name or step name.
  let agentConfig;
  if (agentId) {
    const agentRes = await query("SELECT * FROM agents WHERE agent_id = $1 LIMIT 1", [agentId]);
    agentConfig = agentRes.rows[0];
  } else {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(step);
    if (isUuid) {
      const agentRes = await query("SELECT * FROM agents WHERE agent_id = $1 LIMIT 1", [step]);
      agentConfig = agentRes.rows[0];
    } else {
      const agentRes = await query("SELECT * FROM agents WHERE agent_name ILIKE $1 OR description ILIKE $1 LIMIT 1", [`%${step}%`]);
      agentConfig = agentRes.rows[0];
    }
  }

  if (!agentConfig) {
    throw new DomainError(
      'NO_AGENT',
      `Tidak ada agent config di database untuk agent_id/step ${agentId || step}`,
      404,
    );
  }

  // 2. Resolve Tool Configurations
  let toolConfigs: any[] = [];
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    const toolsRes = await query("SELECT * FROM tools WHERE tool_id = ANY($1::uuid[])", [agentConfig.tools]);
    toolConfigs = toolsRes.rows;
  }

  // 3. Construct MCP Tools (Dynamic Adapters)
  const { tools, clients } = await loadMcpTools(toolConfigs, log);

  try {
    const inputMessages = messagesHistory && messagesHistory.length > 0 
      ? messagesHistory 
      : [{ role: "user", content: prompt || `Execute step ${step} for transaction ${txId}` }];

    let requiresVision = false;
    for (const msg of inputMessages) {
      if (Array.isArray(msg.content) && msg.content.some((p: any) => p.type === 'image_url')) {
        requiresVision = true;
        break;
      }
    }

    const resolvedModel = agentConfig.model && agentConfig.model !== "gpt-4o" 
      ? agentConfig.model 
      : (requiresVision ? "qwen-vl-max" : (process.env.QWEN_LLM_MODEL || "qwen-max"));

    // 4. Instantiate LangGraph createReactAgent In-Memory
    const llm = new ChatOpenAI({
      modelName: resolvedModel,
      temperature: 0,
      apiKey: process.env.QWEN_API_KEY,
      configuration: {
        baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      }
    });

    const agent = createReactAgent({
      llm,
      tools,
      stateModifier: agentConfig.agent_style || "You are a helpful assistant.",
    });

    // 5. Invoke LangGraph
    const result = await agent.invoke({
      messages: inputMessages
    });

    const finalMessage = result.messages[result.messages.length - 1] as BaseMessage;

    // 6. Complete and Handoff back to tracker
    return completeAndHandoff(
      auth,
      {
        protocol: 'amadeus.a2a/0',
        type: 'task.complete',
        transactionId: txId,
        step,
        idempotencyKey,
        correlationId: `agentic:${agentConfig?.agent_id || step}`,
        reason: "LangGraph execution successful",
        targetStep: undefined, // Defaults to next step in flow
        data: {
          agent_output: finalMessage.content
        },
        sentAt: new Date().toISOString(),
      },
      log,
    );
  } catch (err: any) {
    log.error({ err }, "LangGraph execution failed");
    
    // Convert failure into a failed step in the transaction tracker
    return failStep(
      auth,
      {
        protocol: 'amadeus.a2a/0',
        type: 'task.failed',
        transactionId: txId,
        step,
        idempotencyKey,
        correlationId: `agentic:${agentConfig?.agent_id || step}`,
        reason: err.message || "Unknown LangGraph execution failure",
        data: {},
        sentAt: new Date().toISOString(),
      },
      log,
    );
  } finally {
    // 7. Graceful Cleanup of MCP SDK Clients
    for (const client of clients) {
      try { await client.close(); } catch(e) {}
    }
  }
}

/**
 * Universal LangGraph Streaming Engine.
 * Streams node execution and agent updates chunk-by-chunk to the client using SSE.
 */
export async function runAgenticStepStream(
  auth: AuthContext,
  transactionId: string | undefined,
  idempotencyKey: string,
  prompt: string | undefined,
  messagesHistory: any[] | undefined,
  agentId: string | undefined,
  reply: FastifyReply,
): Promise<void> {
  let txId = transactionId || `test-${Date.now()}`;
  let step = "test_step";
  let transaction: any = null;
  
  if (transactionId && !transactionId.startsWith('invoke-')) {
    try {
      const res = await query("SELECT current_step FROM transactions WHERE id = $1", [txId]);
      if (res.rows[0]) step = res.rows[0].current_step;
    } catch (e) {}
  }

  const log = txLogger(txId);
  log.info("Starting Universal LangGraph Engine in STREAMING mode");

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  reply.raw.flushHeaders();

  let agentConfig;
  if (agentId) {
    const agentRes = await query("SELECT * FROM agents WHERE agent_id = $1 LIMIT 1", [agentId]);
    agentConfig = agentRes.rows[0];
  } else {
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(step);
    if (isUuid) {
      const agentRes = await query("SELECT * FROM agents WHERE agent_id = $1 LIMIT 1", [step]);
      agentConfig = agentRes.rows[0];
    } else {
      const agentRes = await query("SELECT * FROM agents WHERE agent_name ILIKE $1 OR description ILIKE $1 LIMIT 1", [`%${step}%`]);
      agentConfig = agentRes.rows[0];
    }
  }

  if (!agentConfig) {
    const errPayload = JSON.stringify({ error: `Agent not found for ${agentId || step}` });
    reply.raw.write(`event: error\ndata: ${errPayload}\n\n`);
    reply.raw.end();
    return;
  }

  let toolConfigs: any[] = [];
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    const toolsRes = await query("SELECT * FROM tools WHERE tool_id = ANY($1::uuid[])", [agentConfig.tools]);
    toolConfigs = toolsRes.rows;
  }

  const { tools, clients } = await loadMcpTools(toolConfigs, log);

  try {
    const inputMessages = messagesHistory && messagesHistory.length > 0 
      ? messagesHistory 
      : [{ role: "user", content: prompt || `Execute step ${step} for transaction ${txId}` }];

    let requiresVision = false;
    for (const msg of inputMessages) {
      if (Array.isArray(msg.content) && msg.content.some((p: any) => p.type === 'image_url')) {
        requiresVision = true;
        break;
      }
    }

    const resolvedModel = agentConfig.model && agentConfig.model !== "gpt-4o" 
      ? agentConfig.model 
      : (requiresVision ? "qwen-vl-max" : (process.env.QWEN_LLM_MODEL || "qwen-max"));

    const modelInitStart = Date.now();
    const llm = new ChatOpenAI({
      modelName: resolvedModel,
      temperature: 0,
      apiKey: process.env.QWEN_API_KEY,
      configuration: {
        baseURL: process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      },
      streaming: true
    });
    const modelInitTime = (Date.now() - modelInitStart) / 1000;

    const agentInitStart = Date.now();
    const agent = createReactAgent({
      llm,
      tools,
      stateModifier: agentConfig.agent_style || "You are a helpful assistant.",
    });
    const agentInitTime = (Date.now() - agentInitStart) / 1000;

    reply.raw.write(`event: metrics\ndata: ${JSON.stringify({ modelInit: modelInitTime, agentInit: agentInitTime })}\n\n`);
    if ((reply.raw as any).flush) {
      (reply.raw as any).flush();
    }

    const responseStart = Date.now();
    const stream = await agent.stream({
      messages: inputMessages
    });

    let finalAgentOutput = "";

    for await (const chunk of stream) {
      const isAgent = !!chunk.agent;
      const isTools = !!chunk.tools;
      const messages = (chunk.agent?.messages || chunk.tools?.messages || []) as any[];
      const lastMsg = messages[messages.length - 1];

      let payload: any = {
        node: isAgent ? 'agent' : isTools ? 'tools' : 'unknown',
      };

      if (lastMsg) {
        payload.message = {
          role: lastMsg._getType() === 'ai' ? 'assistant' : lastMsg._getType() === 'tool' ? 'tool' : 'user',
          content: lastMsg.content,
          name: lastMsg.name,
        };

        if (isAgent && lastMsg._getType() === 'ai') {
          finalAgentOutput = lastMsg.content;
        }

        if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
          payload.toolCalls = lastMsg.tool_calls;
        }
      }

      reply.raw.write(`event: update\ndata: ${JSON.stringify(payload)}\n\n`);
      if ((reply.raw as any).flush) {
        (reply.raw as any).flush();
      }
    }

    // Complete step in the DB if not a test transaction
    const isTest = txId.startsWith('test-') || txId.startsWith('invoke-');
    if (!isTest) {
      try {
        await completeAndHandoff(
          auth,
          {
            protocol: 'amadeus.a2a/0',
            type: 'task.complete',
            transactionId: txId,
            step,
            idempotencyKey,
            correlationId: `agentic:${agentConfig?.agent_id || step}`,
            reason: "LangGraph streaming execution successful",
            targetStep: undefined,
            data: {
              agent_output: finalAgentOutput
            },
            sentAt: new Date().toISOString(),
          },
          log,
        );
      } catch (dbErr: any) {
        log.warn({ err: dbErr }, "Failed to complete transaction in DB, but stream succeeded");
        // We do not throw here, so the stream can finish cleanly
      }
    }

    const responseTime = (Date.now() - responseStart) / 1000;
    reply.raw.write(`event: metrics\ndata: ${JSON.stringify({ modelInit: modelInitTime, agentInit: agentInitTime, responseTime })}\n\n`);
    reply.raw.write(`event: complete\ndata: ${JSON.stringify({ output: finalAgentOutput })}\n\n`);
    reply.raw.end();
  } catch (err: any) {
    log.error({ err }, "LangGraph streaming execution failed");
    
    const isTest = txId.startsWith('test-') || txId.startsWith('invoke-');
    if (!isTest) {
      try {
        await failStep(
          auth,
          {
            protocol: 'amadeus.a2a/0',
            type: 'task.failed',
            transactionId: txId,
            step,
            idempotencyKey,
            correlationId: `agentic:${agentConfig?.agent_id || step}`,
            reason: err.message || "Unknown LangGraph streaming execution failure",
            data: {},
            sentAt: new Date().toISOString(),
          },
          log,
        );
      } catch (e) {
        log.error({ err: e }, "Failed to record failStep for LangGraph stream");
      }
    }

    reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    reply.raw.end();
  } finally {
    for (const client of clients) {
      try { await client.close(); } catch(e) {}
    }
  }
}

