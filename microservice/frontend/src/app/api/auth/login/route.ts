import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Email dan password wajib diisi" } }, { status: 400 });
  }

  const baseUrl = process.env.AMADEUS_API_URL;
  if (!baseUrl) throw new Error("AMADEUS_API_URL is not set");

  const backendRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  if (!backendRes.ok || !data?.token) {
    return NextResponse.json(
      { error: data?.error ?? { code: "UNAUTHORIZED", message: "Kredensial tidak valid" } },
      { status: backendRes.status || 401 },
    );
  }

  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60, // matches backend's 12h token expiry
  });
  return response;
}
