import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import { requireAdmin } from "@/lib/ebook/adminAuth";

// Daftar klaim untuk dashboard admin + signed URL bukti (bayar & webinar).
// Juga dipakai sbg cek login: 200 = password benar, 401 = salah.
export const dynamic = "force-dynamic";

const PROOF_BUCKET = "payment-proofs";

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Password admin salah atau belum diset." }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("order_ref, buyer_name, buyer_whatsapp, status, proof_path, webinar_proof_path, created_at, verified_at, product:products(slug, title)")
    .in("status", ["awaiting_verification", "paid", "rejected"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: s } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 60 * 30);
    return s?.signedUrl ?? null;
  };

  const orders = await Promise.all(
    (data || []).map(async (o) => {
      const prod = (o as unknown as { product: { slug: string; title: string } | null }).product;
      return {
        orderRef: o.order_ref,
        buyerName: o.buyer_name,
        buyerWhatsapp: o.buyer_whatsapp,
        status: o.status,
        createdAt: o.created_at,
        verifiedAt: o.verified_at,
        productTitle: prod?.title ?? "-",
        productSlug: prod?.slug ?? "",
        paymentProofUrl: await sign(o.proof_path),
        webinarProofUrl: await sign(o.webinar_proof_path),
      };
    })
  );

  return NextResponse.json({ orders });
}
