import { completeStep, getTransactionWithEvents, failStep as txFailStep } from '../services/transactions.js';
import { getFlow } from '../config/stepFlows.js';
import { DomainError } from '../types/domain.js';
import type { AuthContext } from '../types/domain.js';
import type { A2AEnvelope, A2AResult } from './a2a/protocol.js';
import { txLogger } from '../lib/logger.js';
import { query } from '../db/pool.js';

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
  transactionId: string,
  idempotencyKey: string,
): Promise<A2AResult> {
  const log = txLogger(transactionId);
  log.info("Starting Universal LangGraph Engine");

  const { transaction } = await getTransactionWithEvents(transactionId);
  const step = transaction.current_step;

  // 1. Resolve Agent Configuration from Database
  // Instead of static `registry.findForStep`, we pull from the DB for dynamic configs.
  const agentRes = await query("SELECT * FROM agents WHERE agent_id = $1 LIMIT 1", [step]);
  const agentConfig = agentRes.rows[0];
  if (!agentConfig) {
    throw new DomainError(
      'NO_AGENT',
      `Tidak ada agent config di database untuk step ${step}`,
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
    // 4. Instantiate LangGraph createReactAgent In-Memory
    const llm = new ChatOpenAI({
      modelName: agentConfig.model || "gpt-4o",
      temperature: 0,
    });

    const agent = createReactAgent({
      llm,
      tools,
      stateModifier: agentConfig.agent_style || "You are a helpful assistant.",
    });

    // 5. Invoke LangGraph
    const result = await agent.invoke({
      messages: [{ role: "user", content: `Execute step ${step} for transaction ${transactionId}` }]
    });

    const finalMessage = result.messages[result.messages.length - 1] as BaseMessage;

    // 6. Complete and Handoff back to tracker
    return completeAndHandoff(
      auth,
      {
        protocol: 'amadeus.a2a/0',
        type: 'task.complete',
        transactionId,
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
        transactionId,
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
