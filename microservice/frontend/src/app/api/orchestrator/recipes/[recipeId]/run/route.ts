import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  const body = await request.text();
  return passthrough(
    await backendFetch(`/orchestrator/recipes/${recipeId}/run`, { method: "POST", body }),
  );
}
