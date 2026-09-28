import { Suspense } from "react";
import Reader from "./Reader";
import HtmlReader from "./HtmlReader";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";

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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">Memuat e-book…</div>}>
      {html ? <HtmlReader slug={slug} /> : <Reader slug={slug} />}
    </Suspense>
  );
}
