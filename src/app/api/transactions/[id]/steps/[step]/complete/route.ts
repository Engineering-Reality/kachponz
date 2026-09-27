import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; step: string }> },
) {
  const { id, step } = await params;
  const body = await request.text();
  return passthrough(
    await backendFetch(`/transactions/${id}/steps/${step}/complete`, { method: "POST", body }),
  );
}
