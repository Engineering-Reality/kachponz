import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qs = request.nextUrl.search;
  return passthrough(await backendFetch(`/orchestrator/tools/${id}/uipath-queue-transactions${qs}`));
}
