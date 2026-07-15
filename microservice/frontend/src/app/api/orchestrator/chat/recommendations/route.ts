import { backendFetch, passthrough } from "@/lib/backendClient";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  return passthrough(
    await backendFetch("/orchestrator/chat/recommendations", { method: "POST", body }),
  );
}
