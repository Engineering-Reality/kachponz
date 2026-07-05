import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

const app = express();

const server = new McpServer({
  name: "UiPath MCP Server",
  version: "1.0.0",
});

// Configure UiPath Tool
server.tool(
  "trigger_uipath_job",
  "Trigger a UiPath RPA job and pass arguments",
  {
    processName: z.string().describe("Name of the UiPath Process to run"),
    arguments: z.record(z.any()).describe("JSON arguments to pass to the UiPath Process"),
  },
  async (args) => {
    console.log(`[UiPath MCP] Triggering job: ${args.processName} with args:`, args.arguments);
    
    // Here you would integrate with UiPath Orchestrator API
    // e.g. using process.env.UIPATH_CLIENT_ID, UIPATH_USER_KEY, etc.
    // For this boilerplate, we simulate success
    const result = {
      jobId: `job-${Math.floor(Math.random() * 10000)}`,
      status: "Successful",
      message: `Triggered process ${args.processName} successfully.`
    };

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

let transport: SSEServerTransport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(500).send("Transport not initialized");
  }
});

const PORT = process.env.PORT || 10001;

app.listen(PORT, () => {
  console.log(`UiPath MCP Server running on SSE at http://localhost:${PORT}/sse`);
});
