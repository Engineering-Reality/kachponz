import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import { requireAdmin } from "@/lib/ebook/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { orderRef, note } = await request.json().catch(() => ({}));
  if (!orderRef) return NextResponse.json({ error: "orderRef wajib." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "rejected",
      rejection_note: note || null,
      verified_at: new Date().toISOString(),
      verified_by: "admin",
    })
    .eq("order_ref", orderRef);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
