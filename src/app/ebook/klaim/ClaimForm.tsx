"use client";

import { useState } from "react";

const MAX_MB = 15;
const okFile = (f: File | null) =>
  !!f && f.size <= MAX_MB * 1024 * 1024 && (f.type.startsWith("image/") || f.type === "application/pdf");

async function putSigned(url: string, file: File) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: file,
  });
  if (!res.ok) throw new Error("Gagal mengunggah bukti. Coba lagi.");
}

const input =
  "w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/40";
const label = "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5";

export default function ClaimForm({ slug }: { slug: string }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [payment, setPayment] = useState<File | null>(null);
  const [webinar, setWebinar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Isi nama lengkap (min 2 karakter).");
    if (whatsapp.replace(/[^0-9+]/g, "").length < 9) return setError("Isi nomor WhatsApp yang valid.");
    if (!okFile(payment)) return setError(`Bukti pembayaran harus gambar/PDF maks ${MAX_MB}MB.`);
    if (!okFile(webinar)) return setError(`Bukti webinar harus gambar/PDF maks ${MAX_MB}MB.`);

    setBusy(true);
    try {
      const res = await fetch("/api/ebook/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, whatsapp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim klaim.");
      await putSigned(data.paymentUploadUrl, payment!);
      await putSigned(data.webinarUploadUrl, webinar!);
      setDone(data.orderRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="rounded-2xl border border-green-300 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">Klaim terkirim! 🎉</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Kode klaim: <span className="font-mono font-semibold">{done}</span>
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          Admin akan memverifikasi bukti pembayaran &amp; webinar, lalu mengirim <b>link baca e-book</b> ke WhatsApp
          kamu. Simpan kode klaim ini bila perlu menghubungi admin.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={label}>Nama lengkap</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama sesuai bukti bayar" />
      </div>
      <div>
        <label className={label}>Nomor WhatsApp</label>
        <input className={input} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" />
        <p className="text-xs text-slate-400 mt-1">Link akses e-book akan dikirim ke nomor ini.</p>
      </div>
      <div>
        <label className={label}>Bukti pembayaran</label>
        <input className={input} type="file" accept="image/*,application/pdf" onChange={(e) => setPayment(e.target.files?.[0] ?? null)} />
      </div>
      <div>
        <label className={label}>Bukti ikut webinar</label>
        <input className={input} type="file" accept="image/*,application/pdf" onChange={(e) => setWebinar(e.target.files?.[0] ?? null)} />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white font-medium py-3"
      >
        {busy ? "Mengirim…" : "Kirim klaim"}
      </button>
      <p className="text-xs text-slate-400 text-center">
        Dengan mengirim, kamu setuju datanya dipakai admin untuk verifikasi &amp; pengiriman akses.
      </p>
    </form>
  );
}
