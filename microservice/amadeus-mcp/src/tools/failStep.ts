import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

export function registerFailStep(server: McpServer): void {
  server.tool(
    "fail_step",
    "Mark a step as failed with reason. Does NOT advance state — allows retry or escalation.",
    {
      transactionId: z.string().uuid().describe("Transaction UUID"),
      step: z.string().min(1).describe("Step name to fail (must be current_step)"),
      reason: z
        .string()
        .min(5)
        .describe("Mandatory human-readable reason for the failure"),
      idempotencyKey: z
        .string()
        .min(8)
        .describe("Unique key for exactly-once delivery"),
    },
    async (args) => {
      const data = (await client.failStep({
        transactionId: args.transactionId,
        step: args.step,
        reason: args.reason,
        idempotencyKey: args.idempotencyKey,
      })) as {
        currentStep?: string;
        status?: string;
        accepted?: boolean;
      };

      return {
        content: [
          {
            type: "text",
            text:
              `⚠️ Step "${args.step}" failure recorded.\n` +
              `Reason: ${args.reason}\n` +
              `Transaction remains at: ${data.currentStep ?? args.step} (status: ${data.status ?? "in_progress"})\n` +
              `You may retry dispatch_step or escalate.`,
          },
        ],
      };
    }
  );
}
