import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

export function registerCreateTransaction(server: McpServer): void {
  server.tool(
    "create_transaction",
    "Create a new LC/SKBDN/SBLC transaction. Only use when customer submission enters the pipeline.",
    {
      type: z
        .enum(["import_lc", "skbdn", "sblc"])
        .describe("Transaction type matching the LC product"),
    },
    async (args) => {
      const idempotencyKey = `mcp-create-${args.type}-${Date.now()}`;
      const data = (await client.createTransaction({
        type: args.type,
        idempotencyKey,
      })) as Record<string, unknown>;

      const shortId = String(data["id"] ?? "").substring(0, 8);
      return {
        content: [
          {
            type: "text",
            text:
              `Created transaction ${shortId} (type: ${args.type}).\n` +
              `Initial step: ${data["current_step"]}\n` +
              `Full ID: ${data["id"]}\n` +
              `Next: call dispatch_step with transactionId="${data["id"]}" to start execution.`,
          },
        ],
      };
    }
  );
}
