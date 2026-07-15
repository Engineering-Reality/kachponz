import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string; threadId: string }> },
) {
  const { agentId, threadId } = await params;
  const body = await request.text();
  return passthrough(
    await backendFetch(`/feature-sharing/thread/share-visitor-with/${agentId}/${threadId}`, { method: "POST", body }),
  );
}
