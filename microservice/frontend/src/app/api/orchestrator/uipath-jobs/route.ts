import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  return passthrough(await backendFetch(`/orchestrator/uipath-jobs${qs}`));
}
