import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import { requireAdmin, waNumber } from "@/lib/ebook/adminAuth";

// Approve klaim: set 'paid' + mint access_token → kembalikan link baca + link
// wa.me siap kirim ke pembeli. Idempotent: token dipakai ulang kalau sudah ada.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { orderRef } = await request.json().catch(() => ({}));
  if (!orderRef) return NextResponse.json({ error: "orderRef wajib." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, access_token, buyer_name, buyer_whatsapp, product:products(slug, title)")
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Klaim tidak ditemukan." }, { status: 404 });

  const prod = (order as unknown as { product: { slug: string; title: string } | null }).product;
  const slug = prod?.slug ?? "";

  const token = (order.access_token as string) || crypto.randomUUID();
  const { error: upErr } = await supabase
    .from("orders")
    .update({
      status: "paid",
      access_token: token,
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: "admin",
    })
    .eq("order_ref", orderRef);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const accessUrl = `${request.nextUrl.origin}/read/${slug}?t=${token}`;
  const msg = `Halo ${order.buyer_name}, pembayaran kamu sudah diverifikasi ✅\n\nIni link baca e-book "${prod?.title ?? ""}":\n${accessUrl}\n\nLink berlaku di maksimal 2 perangkat. Selamat membaca!`;
  const waLink = `https://wa.me/${waNumber(order.buyer_whatsapp as string)}?text=${encodeURIComponent(msg)}`;

  return NextResponse.json({ ok: true, accessUrl, waLink, whatsapp: order.buyer_whatsapp });
}
