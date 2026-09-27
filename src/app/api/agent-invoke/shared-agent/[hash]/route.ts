import { NextRequest } from "next/server";
import { passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

/** Public — no session/JWT, matches the backend's public GET (no authenticateRobot hook). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const baseUrl = process.env.AMADEUS_API_URL;
  if (!baseUrl) throw new Error("AMADEUS_API_URL is not set");
  return passthrough(await fetch(`${baseUrl}/agent-invoke/shared-agent/${hash}`, { cache: "no-store" }));
}
