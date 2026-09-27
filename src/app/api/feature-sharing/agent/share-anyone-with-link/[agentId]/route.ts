import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return passthrough(
    await backendFetch(`/feature-sharing/agent/share-anyone-with-link/${agentId}`, { method: "POST" }),
  );
}
