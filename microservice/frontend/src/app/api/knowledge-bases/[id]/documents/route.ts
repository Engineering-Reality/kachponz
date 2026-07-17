import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

// Multipart uploads can't go through backendFetch's default JSON
// content-type handling — forward the raw bytes with the original
// multipart boundary content-type intact instead of re-encoding as JSON.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contentType = request.headers.get("content-type");
  const body = await request.arrayBuffer();
  return passthrough(
    await backendFetch(`/knowledge-bases/${id}/documents`, {
      method: "POST",
      body,
      headers: contentType ? { "Content-Type": contentType } : undefined,
    }),
  );
}
