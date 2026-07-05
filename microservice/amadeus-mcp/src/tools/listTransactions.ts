import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

export function registerListTransactions(server: McpServer): void {
  server.tool(
    "list_transactions",
    "List Amadeus transactions with optional filter. Use this to see what LC/SKBDN/SBLC are in flight.",
    {
      status: z
        .enum(["in_progress", "completed", "failed"])
        .optional()
        .describe("Filter by transaction status"),
      type: z
        .enum(["import_lc", "skbdn", "sblc"])
        .optional()
        .describe("Filter by transaction type"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max records to return (default 20)"),
    },
    async (args) => {
      const data = (await client.listTransactions({
        status: args.status,
        type: args.type,
        limit: args.limit,
      })) as { items?: unknown[]; count?: number };

      const items = data.items ?? [];
      const count = data.count ?? items.length;

      if (items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No transactions found${args.status ? ` with status=${args.status}` : ""}${args.type ? ` type=${args.type}` : ""}.`,
            },
          ],
        };
      }

      const lines = (items as Record<string, unknown>[]).map((tx, i) => {
        const id = String(tx["id"] ?? "").substring(0, 8);
        return `${i + 1}. ${id}  type=${tx["type"]}  step=${tx["current_step"]}  status=${tx["status"]}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${count} transaction(s):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );
}
