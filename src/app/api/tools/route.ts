import { NextRequest } from "next/server";
import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function GET() {
  return passthrough(await backendFetch("/tools"));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  return passthrough(await backendFetch("/tools", { method: "POST", body }));
}
