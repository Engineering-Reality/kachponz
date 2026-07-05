import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as client from "../client/trackerClient.js";

const FINANCIAL_STEPS = new Set(["mt_converted", "swift_released", "settled"]);

function formatTimestamp(ts: unknown): string {
  if (!ts) return "unknown";
  try {
    return new Date(String(ts)).toISOString().replace("T", " ").substring(0, 19);
  } catch {
    return String(ts);
  }
}

export function registerGetTransaction(server: McpServer): void {
  server.tool(
    "get_transaction",
    "Get one transaction with full event/handoff timeline. Shows every step completion, actor, and signature status.",
    {
      id: z.string().uuid().describe("Transaction UUID"),
    },
    async (args) => {
      const data = (await client.getTransaction(args.id)) as {
        transaction?: Record<string, unknown>;
        events?: Record<string, unknown>[];
      };

      const tx = data.transaction;
      if (!tx) {
        return {
          content: [{ type: "text", text: `Transaction ${args.id} not found.` }],
        };
      }

      const shortId = String(tx["id"] ?? "").substring(0, 8);
      const step = String(tx["current_step"] ?? "unknown");
      const isFinancial = FINANCIAL_STEPS.has(step);

      const header =
        `Transaction ${shortId} — type: ${tx["type"]}, status: ${tx["status"]}\n` +
        `Current step: ${step} (financial: ${isFinancial ? "yes — requires signature" : "no"})`;

      const events = data.events ?? [];
      const timeline =
        events.length === 0
          ? "\nTimeline: (no events yet)"
          : "\n\nTimeline:\n" +
            events
              .map(
                (evt, i) =>
                  `${i + 1}. ${String(evt["step"] ?? "").padEnd(24)} — ${evt["status"]} by ${evt["actor"]} at ${formatTimestamp(evt["created_at"])}`
              )
              .join("\n");

      return {
        content: [{ type: "text", text: header + timeline }],
      };
    }
  );
}
