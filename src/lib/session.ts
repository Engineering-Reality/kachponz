import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export const SESSION_COOKIE = "amadeus_session";

export interface SessionUser {
  userId: string;
  name: string;
  companyId: string;
  role: string | null;
}

function getSecret(): Uint8Array {
  const secret = process.env.AMADEUS_JWT_SECRET;
  if (!secret) throw new Error("AMADEUS_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Cheap presence check — used by proxy.ts for the optimistic redirect only. */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Authoritative check — verifies signature + expiry. This is the real gate,
 * used by (protected)/layout.tsx and every Route Handler, never proxy.ts alone.
 */
export async function verifySession(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: String(payload.sub),
      name: String(payload.name ?? ""),
      companyId: String(payload.companyId ?? ""),
      role: (payload.role as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}
