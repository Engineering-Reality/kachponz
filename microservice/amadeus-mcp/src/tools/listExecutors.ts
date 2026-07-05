import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as client from "../client/trackerClient.js";

export function registerListExecutors(server: McpServer): void {
  server.tool(
    "list_executors",
    "List all executors (LLM/UiPath/PAD) with their cost units. Use before dispatch to understand routing options.",
    {},
    async () => {
      const data = (await client.listExecutors()) as {
        executors?: Record<string, unknown>[];
      };

      const executors = data.executors ?? [];

      if (executors.length === 0) {
        return {
          content: [
            { type: "text", text: "No executors registered in the orchestrator." },
          ],
        };
      }

      const lines = executors.map((e) => {
        const caps = (e["capabilities"] as { step: string; types: string[] }[]) ?? [];
        const stepsStr = caps.map((c) => `${c.step}[${c.types.join(",")}]`).join(", ");
        return (
          `• ${e["id"]} (${e["kind"]})\n` +
          `  costUnit: ${e["costUnit"]}  agentic: ${e["agentic"]}\n` +
          `  handles: ${stepsStr || "—"}`
        );
      });

      return {
        content: [
          {
            type: "text",
            text: `Registered executors (${executors.length}):\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    }
  );
}
