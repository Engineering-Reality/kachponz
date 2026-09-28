import { Suspense } from "react";
import Reader from "./Reader";
import HtmlReader from "./HtmlReader";
import ReaderV2 from "./ReaderV2";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";

// Reader V2 aktif secara default (bisa di-disable dengan EBOOK_READER_V2=false jika perlu)
const READER_V2 = process.env.EBOOK_READER_V2 !== "false";

export const dynamic = "force-dynamic";

// Deteksi format tanpa kolom tambahan: page_count NULL = e-book HTML mandiri;
// page_count terisi = reader gambar per-halaman.
async function isHtmlEbook(slug: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("products").select("page_count").eq("slug", slug).maybeSingle();
    return !!data && data.page_count == null;
  } catch {
    return false;
  }
}

export default async function ReadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const html = await isHtmlEbook(slug);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0B0A1F] text-white">Memuat e-book…</div>}>
      {html ? (READER_V2 ? <ReaderV2 slug={slug} /> : <HtmlReader slug={slug} />) : <Reader slug={slug} />}
    </Suspense>
  );
}
