import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET() {
  return passthrough(await backendFetch("/knowledge-bases"));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return passthrough(await backendFetch("/knowledge-bases", { method: "POST", body }));
}
