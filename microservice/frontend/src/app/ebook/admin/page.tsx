"use client";

import { useCallback, useEffect, useState } from "react";

interface Order {
  orderRef: string;
  buyerName: string;
  buyerWhatsapp: string;
  status: string;
  createdAt: string;
  productTitle: string;
  productSlug: string;
  paymentProofUrl: string | null;
  webinarProofUrl: string | null;
}

interface LinkInfo {
  orderRef: string;
  buyerName: string;
  accessUrl: string;
  waLink: string;
}

const badge: Record<string, string> = {
  awaiting_verification: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function AdminPage() {
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<LinkInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const headers = useCallback(
    (u: string, p: string) => ({ "Content-Type": "application/json", "x-admin-user": u, "x-admin-password": p }),
    []
  );

  const load = useCallback(
    async (u: string, p: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ebook/admin/orders", { headers: headers(u, p) });
        if (res.status === 401) {
          setAuthed(false);
          setError("Username atau password salah.");
          localStorage.removeItem("ebook_admin_cred");
          return;
        }
        const data = await res.json();
        setOrders(data.orders || []);
        setAuthed(true);
        localStorage.setItem("ebook_admin_cred", JSON.stringify({ u, p }));
      } catch {
        setError("Gagal memuat.");
      } finally {
        setLoading(false);
      }
    },
    [headers]
  );

  useEffect(() => {
    const saved = localStorage.getItem("ebook_admin_cred");
    if (saved) {
      try {
        const { u, p } = JSON.parse(saved);
        setUser(u);
        setPw(p);
        load(u, p);
      } catch {}
    }
  }, [load]);

  // Approve juga dipakai untuk "ambil link" order paid (idempotent → token sama).
  async function getLink(o: Order) {
    const res = await fetch("/api/ebook/admin/approve", { method: "POST", headers: headers(user, pw), body: JSON.stringify({ orderRef: o.orderRef }) });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Gagal.");
    setLinkModal({ orderRef: o.orderRef, buyerName: o.buyerName, accessUrl: data.accessUrl, waLink: data.waLink });
    setCopied(false);
    load(user, pw); // refresh daftar; modal tetap tampil (state terpisah)
  }
  async function reject(o: Order) {
    const note = prompt("Alasan tolak (opsional):") ?? "";
    const res = await fetch("/api/ebook/admin/reject", { method: "POST", headers: headers(user, pw), body: JSON.stringify({ orderRef: o.orderRef, note }) });
    const data = await res.json();
    if (!res.ok) return alert(data.error || "Gagal reject.");
    load(user, pw);
  }

  if (!authed)
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-6">
        <form
          onSubmit={(e) => { e.preventDefault(); load(user, pw); }}
          className="w-full max-w-sm bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 space-y-4"
        >
          <h1 className="text-xl font-semibold">Admin E-Book</h1>
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username" autoComplete="username"
            className="w-full rounded-lg border border-zinc-300 dark:border-white/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/40" />
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoComplete="current-password"
            className="w-full rounded-lg border border-zinc-300 dark:border-white/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/40" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full rounded-full bg-pink-500 hover:bg-pink-600 text-white py-2.5" disabled={loading}>
            {loading ? "Masuk…" : "Masuk"}
          </button>
        </form>
      </div>
    );

  const pending = orders.filter((o) => o.status === "awaiting_verification");
  const history = orders.filter((o) => o.status !== "awaiting_verification");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-foreground p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard Admin E-Book</h1>
        <div className="flex gap-3">
          <button onClick={() => load(user, pw)} className="text-sm text-zinc-500 hover:underline">Muat ulang</button>
          <button onClick={() => { localStorage.removeItem("ebook_admin_cred"); setAuthed(false); setPw(""); }} className="text-sm text-zinc-500 hover:underline">Keluar</button>
        </div>
      </div>

      <h2 className="font-medium mb-3">Menunggu verifikasi ({pending.length})</h2>
      {pending.length === 0 && <p className="text-sm text-zinc-500 mb-8">Tidak ada klaim yang menunggu.</p>}
      <div className="space-y-4 mb-10">
        {pending.map((o) => (
          <div key={o.orderRef} className="bg-white dark:bg-white/5 rounded-2xl border border-zinc-200 dark:border-white/10 p-5">
            <div className="flex flex-wrap justify-between gap-2 mb-3">
              <div>
                <p className="font-semibold">{o.buyerName} · <a className="text-pink-600 hover:underline" href={`https://wa.me/${o.buyerWhatsapp.replace(/[^0-9]/g, "").replace(/^0/, "62")}`} target="_blank">{o.buyerWhatsapp}</a></p>
                <p className="text-sm text-zinc-500">{o.productTitle} · <span className="font-mono">{o.orderRef}</span></p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full h-fit ${badge[o.status]}`}>{o.status}</span>
            </div>
            <div className="flex gap-4 mb-4">
              {(["paymentProofUrl", "webinarProofUrl"] as const).map((k) => (
                <a key={k} href={o[k] ?? "#"} target="_blank" className="block">
                  <span className="text-xs text-zinc-500 block mb-1">{k === "paymentProofUrl" ? "Bukti bayar" : "Bukti webinar"}</span>
                  {o[k] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o[k]!} alt="bukti" className="w-28 h-36 object-cover rounded-lg border border-zinc-200 dark:border-white/10" />
                  ) : (
                    <span className="text-xs text-red-500">belum ada</span>
                  )}
                </a>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => getLink(o)} className="rounded-full bg-pink-500 hover:bg-pink-600 text-white text-sm px-5 py-2">Approve → buat link</button>
              <button onClick={() => reject(o)} className="rounded-full border border-zinc-300 dark:border-white/15 text-sm px-5 py-2">Tolak</button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-medium mb-3">Riwayat ({history.length})</h2>
      <div className="space-y-2">
        {history.map((o) => (
          <div key={o.orderRef} className="flex items-center justify-between gap-3 bg-white dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-white/10 px-4 py-2 text-sm">
            <span className="min-w-0 truncate">{o.buyerName} · <span className="text-zinc-500">{o.buyerWhatsapp}</span> · <span className="font-mono text-xs">{o.orderRef}</span></span>
            <div className="flex items-center gap-2 shrink-0">
              {o.status === "paid" && (
                <button onClick={() => getLink(o)} className="rounded-full bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5">Kirim link</button>
              )}
              <span className={`text-xs px-2 py-1 rounded-full ${badge[o.status]}`}>{o.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Popup link — TETAP tampil sampai ditutup manual, tidak hilang saat daftar refresh. */}
      {linkModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setLinkModal(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 p-6 max-w-lg w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Link akses siap dikirim</h3>
              <button onClick={() => setLinkModal(null)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-zinc-500">Untuk <b>{linkModal.buyerName}</b> · {linkModal.orderRef}</p>
            <div className="rounded-lg bg-zinc-100 dark:bg-white/5 p-3 text-xs break-all font-mono">{linkModal.accessUrl}</div>
            <div className="flex flex-wrap gap-2">
              <a href={linkModal.waLink} target="_blank" className="rounded-full bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2.5">Kirim via WhatsApp</a>
              <button
                onClick={() => { navigator.clipboard.writeText(linkModal.accessUrl); setCopied(true); }}
                className="rounded-full border border-zinc-300 dark:border-white/15 text-sm px-5 py-2.5"
              >
                {copied ? "Tersalin ✓" : "Salin link"}
              </button>
              <button onClick={() => setLinkModal(null)} className="rounded-full border border-zinc-300 dark:border-white/15 text-sm px-5 py-2.5">Tutup</button>
            </div>
            <p className="text-xs text-zinc-400">Link ini tersimpan permanen. Kalau perlu lagi, klik &quot;Kirim link&quot; pada order tersebut di Riwayat.</p>
          </div>
        </div>
      )}
    </div>
  );
}
