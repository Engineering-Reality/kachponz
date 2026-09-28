import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";

// Membuat "klaim" (order awaiting_verification) + mengembalikan signed upload URL
// untuk bukti bayar & bukti webinar. Browser meng-upload langsung ke Storage
// (hindari limit body 4.5MB serverless). Bukti diverifikasi admin nanti; akses
// baru diberikan setelah admin approve (Fase 3).
export const dynamic = "force-dynamic";

const PROOF_BUCKET = "payment-proofs";
const MAX_PENDING_PER_WA = 3;

const normalizeWa = (s: string) => s.replace(/[^0-9+]/g, "");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const slug = String(body.slug || "").trim();
    const buyerName = String(body.name || "").trim();
    const buyerWhatsapp = normalizeWa(String(body.whatsapp || ""));

    if (!slug) return NextResponse.json({ error: "Produk tidak valid." }, { status: 400 });
    if (buyerName.length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    if (buyerWhatsapp.length < 9) return NextResponse.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const { data: product } = await supabase
      .from("products")
      .select("id, title")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });

    // Anti-spam: batasi klaim yang masih menunggu verifikasi per nomor WA.
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_whatsapp", buyerWhatsapp)
      .eq("status", "awaiting_verification");
    if ((count ?? 0) >= MAX_PENDING_PER_WA) {
      return NextResponse.json(
        { error: "Anda punya beberapa klaim yang masih menunggu verifikasi. Mohon tunggu diproses dulu." },
        { status: 429 }
      );
    }

    const orderRef = `NT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const proofPath = `proofs/${orderRef}/payment`;
    const webinarPath = `proofs/${orderRef}/webinar`;

    const { error: insErr } = await supabase.from("orders").insert({
      order_ref: orderRef,
      product_id: product.id,
      buyer_name: buyerName,
      buyer_whatsapp: buyerWhatsapp,
      amount: 0,
      status: "awaiting_verification",
      proof_path: proofPath,
      webinar_proof_path: webinarPath,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    const [pay, web] = await Promise.all([
      supabase.storage.from(PROOF_BUCKET).createSignedUploadUrl(proofPath),
      supabase.storage.from(PROOF_BUCKET).createSignedUploadUrl(webinarPath),
    ]);
    if (pay.error || web.error || !pay.data || !web.data) {
      return NextResponse.json({ error: "Gagal menyiapkan unggahan bukti." }, { status: 500 });
    }

    return NextResponse.json({
      orderRef,
      paymentUploadUrl: pay.data.signedUrl,
      webinarUploadUrl: web.data.signedUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Terjadi kesalahan." }, { status: 500 });
  }
}
