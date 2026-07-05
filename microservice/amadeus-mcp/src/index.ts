import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { registerTools } from "./tools/index.js";

const app = express();

const server = new McpServer({
  name: "Amadeus Orchestrator MCP",
  version: "1.0.0",
});

// Register all 8 Amadeus tools
registerTools(server);

let transport: SSEServerTransport;

app.get("/sse", async (_req, res) => {
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

const PORT = process.env.PORT ?? 10002;

app.listen(PORT, () => {
  process.stderr.write(
    `[amadeus-mcp] Amadeus Orchestrator MCP running on SSE at http://localhost:${PORT}/sse\n`
  );
});
