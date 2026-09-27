import Link from "next/link";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";

// Ambil produk saat request (butuh env Supabase); jangan dieksekusi saat build.
export const dynamic = "force-dynamic";

interface Product {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  cover_url: string | null;
}

async function getProducts(): Promise<{ products: Product[]; error: string | null }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, title, description, price, cover_url")
      .eq("kind", "ebook")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) return { products: [], error: error.message };
    const products = (data as Product[]) || [];
    // cover_url disimpan sbg path di bucket privat 'ebooks' → sign biar bisa tampil.
    await Promise.all(
      products.map(async (p) => {
        if (p.cover_url && !/^https?:\/\//.test(p.cover_url)) {
          const { data: s } = await supabase.storage.from("ebooks").createSignedUrl(p.cover_url, 60 * 60);
          p.cover_url = s?.signedUrl ?? null;
        }
      })
    );
    return { products, error: null };
  } catch (e) {
    return { products: [], error: e instanceof Error ? e.message : "Gagal memuat produk." };
  }
}

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function EbookPage() {
  const { products, error } = await getProducts();

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[var(--background)] text-foreground overflow-x-hidden w-full">
      <MarketingHeader />
      <main className="pt-32 pb-24 max-w-6xl mx-auto px-6">
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-6">E-Book</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Sudah punya link akses dari admin? Buka langsung dari WhatsApp. Ingin klaim e-book?
            Kirim bukti pembayaran &amp; webinar — admin akan mengirim link bacanya.
          </p>
        </header>

        {error && (
          <p className="text-center text-amber-600 dark:text-amber-400 mb-8 text-sm">
            E-book belum bisa dimuat ({error}). Pastikan env Supabase sudah diisi.
          </p>
        )}

        {products.length === 0 && !error && (
          <p className="text-center text-slate-500 dark:text-slate-400">Belum ada e-book yang tersedia.</p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 flex flex-col">
              {p.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.cover_url} alt={p.title} className="rounded-lg mb-4 aspect-[3/4] object-cover" />
              )}
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{p.title}</h2>
              {p.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex-1">{p.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-white">{p.price > 0 ? rupiah(p.price) : "Gratis"}</span>
                <Link href={`/ebook/klaim?slug=${p.slug}`} className="rounded-full bg-pink-500 hover:bg-pink-600 text-white text-sm px-4 py-2">
                  Klaim
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
