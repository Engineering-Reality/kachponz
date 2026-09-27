import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.email || !body?.password) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Name, email, and password are required" } }, { status: 400 });
  }

  const baseUrl = process.env.AMADEUS_API_URL;
  if (!baseUrl) throw new Error("AMADEUS_API_URL is not set");

  const backendRes = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: body.name, email: body.email, password: body.password }),
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  
  if (!backendRes.ok) {
    return NextResponse.json(
      { error: data?.error ?? { code: "REGISTRATION_ERROR", message: "Gagal mendaftar" } },
      { status: backendRes.status || 400 },
    );
  }

  // After successful registration, we need to log them in to get a token.
  // The backend registration doesn't return a token directly yet, so we call login.
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });

  const loginData = await loginRes.json().catch(() => null);

  if (!loginRes.ok || !loginData?.token) {
    return NextResponse.json({ success: true, redirect: "/login" }, { status: 201 });
  }

  const response = NextResponse.json({ success: true, user: loginData.user, redirect: "/dashboard" });
  response.cookies.set(SESSION_COOKIE, loginData.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60, // matches backend's 12h token expiry
  });
  
  return response;
}
