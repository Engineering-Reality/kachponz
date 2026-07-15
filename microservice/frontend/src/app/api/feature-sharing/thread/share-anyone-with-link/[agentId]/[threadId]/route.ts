import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
  const { agentId, threadId } = await params;
  return passthrough(
    await backendFetch(`/feature-sharing/thread/share-anyone-with-link/${agentId}/${threadId}`, { method: "POST" }),
  );
}
