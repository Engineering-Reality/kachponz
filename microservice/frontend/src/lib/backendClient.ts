import { getSessionToken } from "./session";

/**
 * Forwards a request to amadeus-core with the session JWT attached
 * server-side. The token never reaches the browser — every Route Handler
 * should call this instead of `fetch`-ing NEXT_PUBLIC_API_URL directly.
 */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  if (!token) {
    return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Tidak ada sesi aktif" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const baseUrl = process.env.AMADEUS_API_URL;
  if (!baseUrl) throw new Error("AMADEUS_API_URL is not set");
  return fetch(`${baseUrl}${path}`, { ...init, headers, cache: "no-store" });
}

/** Forwards status/content-type/body as-is — body is already a ReadableStream, works for SSE too. */
export function passthrough(res: Response): Response {
  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(res.body, { status: res.status, headers });
}
