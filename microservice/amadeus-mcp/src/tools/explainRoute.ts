import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

export function registerExplainRoute(server: McpServer): void {
  server.tool(
    "explain_route",
    "Preview routing decision: which executor will handle step X for type Y, and why. Use BEFORE dispatch to confirm the plan.",
    {
      step: z
        .string()
        .min(1)
        .describe(
          "Step name (e.g. doc_examined, mt_converted, swift_released)"
        ),
      type: z
        .enum(["import_lc", "skbdn", "sblc"])
        .describe("Transaction type"),
    },
    async (args) => {
      const data = (await client.explainRoute({
        step: args.step,
        type: args.type,
      })) as {
        chosen?: Record<string, unknown>;
        reason?: string;
        alternatives?: Record<string, unknown>[];
      } | null;

      if (!data || !data.chosen) {
        return {
          content: [
            {
              type: "text",
              text: `No executor found for step="${args.step}" type="${args.type}". Step may not be registered in the router.`,
            },
          ],
        };
      }

      const { chosen, reason, alternatives } = data;
      const altStr =
        alternatives && alternatives.length > 0
          ? `\nAlternatives: ${alternatives.map((a) => `${a["id"]} (cost=${a["costUnit"]})`).join(", ")}`
          : "\nAlternatives: none";

      return {
        content: [
          {
            type: "text",
            text:
              `Route for step="${args.step}" type="${args.type}":\n` +
              `  → Executor: ${chosen["id"]} (${chosen["kind"]})\n` +
              `  → Cost unit: ${chosen["costUnit"]}\n` +
              `  → Reason: ${reason}` +
              altStr,
          },
        ],
      };
    }
  );
}
