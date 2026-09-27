import Link from "next/link";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import ClaimForm from "./ClaimForm";

export const dynamic = "force-dynamic";

async function getProduct(slug: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("products")
      .select("slug, title, price")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    return data as { slug: string; title: string; price: number } | null;
  } catch {
    return null;
  }
}

export default async function KlaimPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const { slug } = await searchParams;
  const product = slug ? await getProduct(slug) : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[var(--background)] text-foreground w-full">
      <MarketingHeader />
      <main className="pt-32 pb-24 max-w-xl mx-auto px-6">
        {!product ? (
          <div className="text-center">
            <h1 className="text-3xl font-light mb-4">Klaim E-Book</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Pilih e-book yang ingin diklaim terlebih dahulu.</p>
            <Link href="/ebook" className="rounded-full bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5">Lihat daftar e-book</Link>
          </div>
        ) : (
          <>
            <header className="mb-8 text-center">
              <h1 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white mb-2">Klaim E-Book</h1>
              <p className="text-slate-500 dark:text-slate-400">{product.title}</p>
            </header>
            <ClaimForm slug={product.slug} />
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
