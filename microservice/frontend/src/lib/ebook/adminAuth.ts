import type { NextRequest } from "next/server";

/**
 * Gerbang admin untuk /api/ebook/admin/*. Username+password, default hardcode
 * admin / admin123 (bisa dioverride via env ADMIN_USER / ADMIN_PASSWORD).
 * Kredensial dikirim browser lewat header x-admin-user & x-admin-password.
 * ⚠️ Ganti default sebelum dipakai publik.
 */
export function requireAdmin(request: NextRequest): boolean {
  const user = (process.env.ADMIN_USER || "admin").trim();
  const pw = (process.env.ADMIN_PASSWORD || "admin123").trim();
  const givenUser = (request.headers.get("x-admin-user") || "").trim();
  const givenPw = (request.headers.get("x-admin-password") || "").trim();
  return givenUser === user && givenPw === pw;
}

/** Ubah 08xxxx / +62xxxx → 62xxxx untuk link wa.me. */
export function waNumber(whatsapp: string): string {
  const d = (whatsapp || "").replace(/[^0-9]/g, "");
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  return d;
}
