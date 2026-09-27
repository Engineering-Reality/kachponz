import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  return passthrough(await backendFetch(`/transactions${qs}`));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return passthrough(await backendFetch("/transactions", { method: "POST", body }));
}
