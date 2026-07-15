import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return passthrough(await backendFetch(`/orchestrator/agents/${id}/recipe`));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  return passthrough(await backendFetch(`/orchestrator/agents/${id}/recipe`, { method: "PUT", body }));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return passthrough(await backendFetch(`/orchestrator/agents/${id}/recipe`, { method: "DELETE" }));
}
