import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListTransactions } from "./listTransactions.js";
import { registerGetTransaction } from "./getTransaction.js";
import { registerCreateTransaction } from "./createTransaction.js";
import { registerDispatchStep } from "./dispatchStep.js";
import { registerCompleteStep } from "./completeStep.js";
import { registerFailStep } from "./failStep.js";
import { registerListExecutors } from "./listExecutors.js";
import { registerExplainRoute } from "./explainRoute.js";

export function registerTools(server: McpServer): void {
  registerListTransactions(server);
  registerGetTransaction(server);
  registerCreateTransaction(server);
  registerDispatchStep(server);
  registerCompleteStep(server);
  registerFailStep(server);
  registerListExecutors(server);
  registerExplainRoute(server);
}
