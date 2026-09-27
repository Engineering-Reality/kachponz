import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  return passthrough(
    await backendFetch(`/orchestrator/agents/${id}/recipe/run`, { method: "POST", body }),
  );
}
