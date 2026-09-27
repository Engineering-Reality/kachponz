import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET() {
  return passthrough(await backendFetch("/orchestrator/mcp/status"));
}
