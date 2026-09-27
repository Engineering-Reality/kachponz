import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/ebook/supabaseAdmin";
import { decideDeviceAccess } from "@/lib/ebook/deviceLock";

// Menyajikan e-book HTML mandiri (gambar ter-embed) HANYA ke device dgn token
// valid. Berbeda dari reader gambar (get-reader-url): e-book ini punya UI+kuis
// sendiri, jadi kita serahkan HTML-nya utuh, cukup digerbang + diberi watermark.
export const dynamic = "force-dynamic";

const MAX_DEVICES = 2;
const EBOOKS_BUCKET = "ebooks";

function errPage(status: number, msg: string) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#18181b;color:#fff;font-family:system-ui;text-align:center;padding:24px"><div><h2>Tidak bisa membuka e-book</h2><p style="color:#a1a1aa;max-width:28rem">${msg}</p></div></body>`;
  return new NextResponse(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function watermark(orderRef: string) {
  const tile = `${orderRef} · neutrack.id`;
  const spans = Array.from({ length: 40 }, () => `<span style="font:700 20px/1 system-ui;white-space:nowrap">${tile}</span>`).join("");
  return `<div aria-hidden="true" style="position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:70px 90px;transform:rotate(-30deg) scale(1.5);opacity:.08;color:#888">${spans}</div>`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const sp = request.nextUrl.searchParams;
    const token = sp.get("t");
    const deviceId = sp.get("d");
    if (!token) return errPage(401, "Buka e-book dari link yang dikirim admin lewat WhatsApp.");
    if (!deviceId) return errPage(400, "Perangkat tidak dikenali. Muat ulang halaman.");

    const supabase = getSupabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("id, order_ref, product_id, status, access_devices")
      .eq("access_token", token)
      .maybeSingle();
    if (!order || order.status !== "paid") {
      return errPage(403, "Link tidak valid atau pembayaran belum diverifikasi.");
    }

    const devices: string[] = order.access_devices || [];
    const decision = decideDeviceAccess(devices, deviceId, MAX_DEVICES);
    if (decision === "deny") {
      return errPage(403, `Akses e-book ini sudah terdaftar di ${MAX_DEVICES} perangkat. Hubungi admin dengan kode pesanan ${order.order_ref} untuk reset.`);
    }
    if (decision === "claim") {
      await supabase.from("orders").update({ access_devices: [...devices, deviceId] }).eq("id", order.id);
    }

    // Ambil folder HTML dari produk (slug harus cocok dgn order-nya).
    const { data: product } = await supabase
      .from("products")
      .select("pages_path, slug")
      .eq("id", order.product_id)
      .maybeSingle();
    if (!product?.pages_path || product.slug !== slug) {
      return errPage(404, "E-book tidak ditemukan.");
    }

    const { data: blob, error } = await supabase.storage
      .from(EBOOKS_BUCKET)
      .download(`${product.pages_path}/index.html`);
    if (error || !blob) return errPage(404, "Berkas e-book belum tersedia.");

    let html = await blob.text();
    // Sisipkan watermark tepat sebelum </body> (traceable per pembeli).
    const wm = watermark(order.order_ref);
    html = html.includes("</body>") ? html.replace(/<\/body>/i, `${wm}</body>`) : html + wm;

    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        // Boleh di-embed <iframe> hanya oleh origin kita sendiri.
        "content-security-policy": "frame-ancestors 'self'",
      },
    });
  } catch (e) {
    return errPage(500, e instanceof Error ? e.message : "Terjadi kesalahan.");
  }
}
