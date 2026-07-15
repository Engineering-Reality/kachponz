import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Optimistic redirect only — cheap cookie-presence check, no JWT verify.
 * The real gate is (protected)/layout.tsx's verifySession(), which checks
 * signature + expiry server-side. Don't rely on this alone (Next's own
 * auth guide explicitly warns a matcher/route refactor can silently drop
 * middleware coverage).
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup');

  if (isAuthPage) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/tools/:path*",
    "/playground/:path*",
    "/agent-creator/:path*",
    "/login",
    "/signup"
  ],
};
