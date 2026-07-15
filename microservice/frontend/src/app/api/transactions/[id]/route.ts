import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return passthrough(await backendFetch(`/transactions/${id}`));
}
