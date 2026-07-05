import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

export function registerDispatchStep(server: McpServer): void {
  server.tool(
    "dispatch_step",
    "MAIN ACTION — dispatch current step to the appropriate executor (LLM/UiPath/PAD) via cost-aware router. Returns outcome: completed|dispatched|failed.",
    {
      transactionId: z.string().uuid().describe("Transaction UUID to dispatch"),
      idempotencyKey: z
        .string()
        .min(8)
        .describe(
          "Unique key for exactly-once delivery. Use format: dispatch-{txId}-{step}-{timestamp}"
        ),
    },
    async (args) => {
      const data = (await client.dispatchStep({
        transactionId: args.transactionId,
        idempotencyKey: args.idempotencyKey,
      })) as Record<string, unknown>;

      const outcome = String(data["outcome"] ?? "unknown");
      const executor = String(data["executor"] ?? "unknown");
      const step = String(data["step"] ?? "unknown");
      const stepAfter = String(data["currentStepAfter"] ?? "unknown");

      let summary: string;
      if (outcome === "completed") {
        summary =
          `✅ Step "${step}" completed by ${executor}.\n` +
          `State advanced to: ${stepAfter}\n` +
          `Call dispatch_step again for the next step.`;
      } else if (outcome === "dispatched") {
        summary =
          `🚀 Step "${step}" dispatched to ${executor} (external job).\n` +
          `Job ID: ${data["externalJobId"] ?? "pending"}\n` +
          `Waiting for robot to call A2A complete. Check back with get_transaction.`;
      } else {
        summary =
          `❌ Step "${step}" failed via ${executor}.\n` +
          `Reason: ${data["reason"] ?? "unknown"}\n` +
          `State remains at: ${stepAfter}. Call fail_step or retry.`;
      }

      return { content: [{ type: "text", text: summary }] };
    }
  );
}
