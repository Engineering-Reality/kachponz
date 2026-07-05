/**
 * MCP Adapters Boilerplate
 * 
 * This module provides the standard architecture for converting legacy Python tools
 * (e.g., RAG, SendGrid, external APIs) into Model Context Protocol (MCP) servers.
 * It adheres to the @modelcontextprotocol/sdk standard.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Initialize the generic Amadeus Tools MCP Server
const server = new McpServer({
  name: "Amadeus-Core-Tools",
  version: "1.0.0"
});

/**
 * Example Tool 1: Legacy SendGrid Integration
 * This demonstrates how to wrap external communication logic.
 */
server.tool(
  "send_email",
  "Send an email via SendGrid",
  {
    to: z.string().email("Destination email address"),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Email body cannot be empty")
  },
  async (args) => {
    try {
      // Mocked integration for boilerplate. 
      // Replace with actual SendGrid client (e.g., @sendgrid/mail)
      console.log(`[MCP] Sending email to ${args.to} with subject "${args.subject}"`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        content: [{ type: "text", text: `Email successfully sent to ${args.to}` }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Failed to send email: ${error.message}` }],
        isError: true
      };
    }
  }
);

/**
 * Example Tool 2: Legacy RAG Search
 * This demonstrates how to wrap retrieval augmented generation logic.
 */
server.tool(
  "rag_search",
  "Search the internal vector database for documentation",
  {
    query: z.string().min(1, "Search query is required"),
    top_k: z.number().optional().default(3)
  },
  async (args) => {
    try {
      // Mocked integration for boilerplate.
      // Replace with actual PgVector or Pinecone queries.
      console.log(`[MCP] Searching vector DB for "${args.query}", limit ${args.top_k}`);
      
      const results = [
        `[Doc 1] Info about ${args.query}`,
        `[Doc 2] More info relating to ${args.query}`
      ];
      
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `RAG search failed: ${error.message}` }],
        isError: true
      };
    }
  }
);

/**
 * Start the MCP Server using Stdio transport.
 * This allows the LangGraph engine to spawn this Node process and communicate natively.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Amadeus MCP Tools Server running on stdio");
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error starting MCP Server:", error);
    process.exit(1);
  });
}
