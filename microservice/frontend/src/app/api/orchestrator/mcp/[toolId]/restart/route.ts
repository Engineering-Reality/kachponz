import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  return passthrough(await backendFetch(`/orchestrator/mcp/${toolId}/restart`, { method: "POST" }));
}
