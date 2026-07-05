import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

const FINANCIAL_STEPS = new Set(["mt_converted", "swift_released", "settled"]);

export function registerCompleteStep(server: McpServer): void {
  server.tool(
    "complete_step",
    "Mark a step as completed and advance state. For financial steps (mt_converted, swift_released, settled), signature is REQUIRED.",
    {
      transactionId: z.string().uuid().describe("Transaction UUID"),
      step: z.string().min(1).describe("Step name to complete (must be current_step)"),
      idempotencyKey: z
        .string()
        .min(8)
        .describe("Unique key for exactly-once delivery"),
      payload: z
        .record(z.unknown())
        .optional()
        .describe("Optional result payload from agent"),
      signature: z
        .object({
          timestamp: z
            .string()
            .describe("ISO timestamp for HMAC signing (X-Robot-Timestamp)"),
          secret: z
            .string()
            .describe("Signing secret (X-Robot-Signing-Secret)"),
        })
        .optional()
        .describe("Required for financial steps (mt_converted, swift_released, settled)"),
    },
    async (args) => {
      const isFinancial = FINANCIAL_STEPS.has(args.step);

      if (isFinancial && !args.signature) {
        return {
          content: [
            {
              type: "text",
              text:
                `Financial step "${args.step}" requires a signature.\n` +
                `Provide signature: { timestamp: "<ISO timestamp>", secret: "<signing secret>" }\n` +
                `Get the signing secret from your robot credentials (registerRobot.ts output).`,
            },
          ],
        };
      }

      const data = (await client.completeStep({
        transactionId: args.transactionId,
        step: args.step,
        idempotencyKey: args.idempotencyKey,
        payload: args.payload as Record<string, unknown> | undefined,
        signature: args.signature,
      })) as {
        transaction?: Record<string, unknown>;
        idempotentReplay?: boolean;
      };

      const tx = data.transaction ?? {};
      const replay = data.idempotentReplay === true ? " (idempotent replay)" : "";

      return {
        content: [
          {
            type: "text",
            text:
              `✅ Step "${args.step}" marked complete${replay}.\n` +
              `Transaction now at: ${tx["current_step"]} (status: ${tx["status"]})`,
          },
        ],
      };
    }
  );
}
