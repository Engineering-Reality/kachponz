import { query } from '../db/pool.js';
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Connects to an MCP server and returns LangChain-compatible tools.
 */
async function loadMcpTools(toolConfigs: any[]) {
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
        command: "node",
        args: [release.args]
      });
    }

    if (!transport) continue;

    const mcpClient = new Client({ name: "amadeus-client", version: "1.0.0" });
    clients.push(mcpClient);

    try {
      await mcpClient.connect(transport);
      const { tools: mcpTools } = await mcpClient.listTools();
      
      // Convert MCP Tools to LangChain Tools
      for (const mcpTool of mcpTools) {
        langchainTools.push(
          new DynamicStructuredTool({
            name: mcpTool.name,
            description: mcpTool.description || "MCP Tool",
            schema: z.record(z.any()), // Map JSON schema to Zod in a real implementation
            func: async (args) => {
              const res = await mcpClient.callTool({
                name: mcpTool.name,
                arguments: args
              });
              return res.content.map(c => c.type === 'text' ? c.text : JSON.stringify(c)).join("\n");
            },
          })
        );
      }
    } catch (e) {
      console.warn(`[MCP] Failed to connect to tool ${config.name}:`, e);
    }
  }

  return { tools: langchainTools, clients };
}

/**
 * Invokes an agent dynamically from the database.
 */
export async function invokeAgent(agentId: string, payload: any) {
  const agentRes = await query("SELECT * FROM agents WHERE agent_id = $1", [agentId]);
  if (agentRes.rows.length === 0) {
    throw new Error("Agent not found");
  }
  const agentConfig = agentRes.rows[0];

  let toolConfigs: any[] = [];
  if (agentConfig.tools && agentConfig.tools.length > 0) {
    const toolsRes = await query("SELECT * FROM tools WHERE tool_id = ANY($1::uuid[])", [agentConfig.tools]);
    toolConfigs = toolsRes.rows;
  }

  console.log(`[Agent] Booting agent ${agentConfig.agent_name} with ${toolConfigs.length} tools`);

  // Load MCP Tools
  const { tools, clients } = await loadMcpTools(toolConfigs);

  // Fallback to a mock tool if none loaded (to prevent LangGraph errors)
  if (tools.length === 0) {
    tools.push(
      new DynamicStructuredTool({
        name: "mock_tool",
        description: "A placeholder tool since no real tools are attached.",
        schema: z.object({}),
        func: async () => "Mock tool executed successfully.",
      })
    );
  }

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini", // Fallback, could be dynamic
    temperature: 0,
  });

  const agent = createReactAgent({
    llm,
    tools,
    stateModifier: agentConfig.agent_style || "You are a helpful assistant.",
  });

  try {
    const result = await agent.invoke({
      messages: [{ role: "user", content: JSON.stringify(payload) }]
    });

    return {
      status: "success",
      result: result.messages[result.messages.length - 1].content
    };
  } catch (err: any) {
    console.error(`[Agent] Execution failed:`, err);
    return {
      status: "failed",
      error: err.message
    };
  } finally {
    // Cleanup MCP clients
    for (const client of clients) {
      try { await client.close(); } catch(e) {}
    }
  }
}
