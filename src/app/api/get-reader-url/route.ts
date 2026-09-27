import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import { decideDeviceAccess } from "@/lib/ebook/deviceLock";

// Selalu jalan di request-time: men-sign objek privat & mengklaim perangkat.
export const dynamic = "force-dynamic";

const MAX_DEVICES = 2; // hp + laptop
const EBOOKS_BUCKET = "ebooks";
const SIGN_TTL = 60 * 60 * 6; // 6 jam: cukup untuk satu sesi baca
const MAX_BATCH = 40;

const pad = (n: number) => String(n).padStart(4, "0");

/** Tanda-tangani WebP halaman [from,to] (di-clamp ke [1,pageCount]). */
async function signWindow(
  pagesPath: string,
  pageCount: number,
  from: number,
  to: number,
  extra: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin();
  const lo = Math.max(1, Math.floor(from) || 1);
  const hi = Math.min(pageCount, Math.max(lo, Math.floor(to) || lo));
  if (hi - lo + 1 > MAX_BATCH) {
    return NextResponse.json({ error: "Rentang halaman terlalu besar." }, { status: 400 });
  }
  const nums: number[] = [];
  for (let p = lo; p <= hi; p++) nums.push(p);
  const paths = nums.map((p) => `${pagesPath}/page-${pad(p)}.webp`);

  const { data, error } = await supabase.storage.from(EBOOKS_BUCKET).createSignedUrls(paths, SIGN_TTL);
  if (error || !data) {
    return NextResponse.json({ error: "Gagal membuat URL halaman." }, { status: 500 });
  }
  const pages = data.map((d, i) => ({ page: nums[i], url: d.signedUrl }));
  return NextResponse.json({ pageCount, from: lo, to: hi, pages, ...extra });
}

export async function POST(request: NextRequest) {
  try {
    const { slug, token, deviceId, from, to } = await request.json().catch(() => ({}));

    // Akses via link (tanpa login): token terikat <=2 perangkat.
    if (!token) {
      return NextResponse.json(
        { error: "Buka e-book dari link yang dikirim admin lewat WhatsApp." },
        { status: 401 }
      );
    }
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_ref, buyer_name, product_id, status, access_devices")
      .eq("access_token", token)
      .maybeSingle();

    if (!order || order.status !== "paid") {
      return NextResponse.json(
        { error: "Link tidak valid atau pembayaran belum diverifikasi." },
        { status: 403 }
      );
    }

    // ponytail: read-modify-write claim; balapan kecil bisa loloskan device ke-3
    // pada pembukaan bersamaan. Aman di volume ini; ketatkan dgn RPC bila perlu.
    const devices: string[] = order.access_devices || [];
    const decision = decideDeviceAccess(devices, deviceId, MAX_DEVICES);
    if (decision === "deny") {
      return NextResponse.json(
        {
          error: `Akses e-book ini sudah terdaftar di ${MAX_DEVICES} perangkat. Jika ganti perangkat atau menghapus data browser, hubungi admin dengan menyertakan kode pesanan ${order.order_ref}.`,
          deviceLimit: true,
          orderRef: order.order_ref,
        },
        { status: 403 }
      );
    }
    if (decision === "claim") {
      const { error: bindErr } = await supabase
        .from("orders")
        .update({ access_devices: [...devices, deviceId] })
        .eq("id", order.id);
      if (bindErr) return NextResponse.json({ error: "Gagal mengaktifkan perangkat." }, { status: 500 });
    }

    const { data: product } = await supabase
      .from("products")
      .select("pages_path, page_count")
      .eq("id", order.product_id)
      .maybeSingle();
    if (!product?.pages_path || !product.page_count) {
      return NextResponse.json({ error: "Halaman e-book belum tersedia." }, { status: 404 });
    }

    return signWindow(product.pages_path, product.page_count, from ?? 1, to ?? 21, {
      watermark: order.order_ref,
      orderRef: order.order_ref,
      buyerName: order.buyer_name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
