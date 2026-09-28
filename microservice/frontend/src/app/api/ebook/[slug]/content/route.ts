import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import { decideDeviceAccess } from "@/lib/ebook/deviceLock";

// Konten book.json bertoken. Sama seperti read-html: gerbang token + device lock
// (2 perangkat). Bab isPreview:true boleh publik (tanpa token). Gambar di bucket
// privat di-sign di sini. cache-control: private, no-store.
export const dynamic = "force-dynamic";

const MAX_DEVICES = 2;
const EBOOKS = "ebooks";
const TTL = 60 * 60 * 6;

const noStore = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };
const err = (s: number, m: string) => new NextResponse(JSON.stringify({ error: m }), { status: s, headers: noStore });

// Tanda-tangani semua ImgRef.path (figure.img & fullPage.img) → signed URL.
async function signImages(chapters: any[], supabase: ReturnType<typeof getSupabaseAdmin>) {
  const paths = new Set<string>();
  for (const c of chapters) for (const b of c.blocks || []) {
    for (const ref of [b?.img, b?.imgDark]) {
      if (ref?.path) paths.add(ref.path);
      if (ref?.path2x) paths.add(ref.path2x);
    }
  }
  if (paths.size === 0) return;
  const list = [...paths];
  const { data } = await supabase.storage.from(EBOOKS).createSignedUrls(list, TTL);
  const map = new Map<string, string>();
  (data || []).forEach((d, i) => d.signedUrl && map.set(list[i], d.signedUrl));
  for (const c of chapters) for (const b of c.blocks || []) {
    for (const ref of [b?.img, b?.imgDark]) {
      if (ref?.path && map.has(ref.path)) ref.url = map.get(ref.path);
      if (ref?.path2x && map.has(ref.path2x)) ref.url2x = map.get(ref.path2x);
    }
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const sp = request.nextUrl.searchParams;
    const token = sp.get("t");
    const deviceId = sp.get("d");
    const supabase = getSupabaseAdmin();

    const { data: blob, error } = await supabase.storage.from(EBOOKS).download(`${slug}/book.json`);
    if (error || !blob) return err(404, "Konten e-book belum tersedia.");
    const book = JSON.parse(await blob.text());

    // Tanpa token → hanya bab preview (publik).
    if (!token) {
      book.chapters = (book.chapters || []).filter((c: any) => c.isPreview);
      await signImages(book.chapters, supabase);
      return new NextResponse(JSON.stringify({ ...book, preview: true }), { headers: noStore });
    }

    if (!deviceId) return err(400, "Perangkat tidak dikenali.");
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_ref, status, access_devices, product:products(slug)")
      .eq("access_token", token)
      .maybeSingle();
    const prodSlug = (order as any)?.product?.slug;
    if (!order || order.status !== "paid" || prodSlug !== slug) {
      return err(403, "Link tidak valid atau pembayaran belum diverifikasi.");
    }

    const devices: string[] = order.access_devices || [];
    const decision = decideDeviceAccess(devices, deviceId, MAX_DEVICES);
    if (decision === "deny") {
      return err(403, `Akses sudah terdaftar di ${MAX_DEVICES} perangkat. Hubungi admin dengan kode ${order.order_ref}.`);
    }
    if (decision === "claim") {
      await supabase.from("orders").update({ access_devices: [...devices, deviceId] }).eq("id", order.id);
    }

    await signImages(book.chapters || [], supabase);
    return new NextResponse(JSON.stringify({ ...book, watermark: order.order_ref }), { headers: noStore });
  } catch (e) {
    return err(500, e instanceof Error ? e.message : "Terjadi kesalahan.");
  }
}
