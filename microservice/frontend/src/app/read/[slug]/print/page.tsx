"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Book, Block } from "@/components/ebook/types";
import "@/app/read/ebook-theme.css";

// Cetak lembar kerja A4 hitam-putih, isian pembaca ikut tercetak. Dipanggil dari
// tombol "Cetak lembar ini" / "Cetak semua lembar kerja".
//   /read/<slug>/print?t=<token>&sheets=<id|all>
type Worksheet = Extract<Block, { type: "worksheet" }>;

export default function PrintPage() {
  const slug = String(useParams().slug || "");
  const sp = useSearchParams();
  const token = sp.get("t");
  const want = (sp.get("sheets") || "all").split(",");
  const [book, setBook] = useState<Book | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let deviceId = localStorage.getItem("reader_device_id") || "";
    (async () => {
      try {
        const res = await fetch(`/api/ebook/${slug}/content?t=${encodeURIComponent(token || "")}&d=${encodeURIComponent(deviceId)}`);
        const data = await res.json();
        if (!res.ok) return setErr(data.error || "Akses ditolak.");
        setBook(data);
        const key = `mmp:${slug}:${data.watermark || "guest"}`;
        try { setAnswers(JSON.parse(localStorage.getItem(key) || "{}")); } catch {}
      } catch { setErr("Gagal memuat."); }
    })();
  }, [slug, token]);

  const sheets = useMemo(() => {
    if (!book) return [] as Worksheet[];
    const all: Worksheet[] = [];
    book.chapters.forEach((c) => c.blocks.forEach((b) => { if (b.type === "worksheet") all.push(b); }));
    return want.includes("all") ? all : all.filter((w) => want.includes(w.id));
  }, [book, want]);

  useEffect(() => { if (book && sheets.length) { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } }, [book, sheets.length]);

  if (err) return <div style={{ padding: 40 }}>Tidak bisa mencetak: {err}</div>;
  if (!book) return <div style={{ padding: 40 }}>Menyiapkan cetakan…</div>;

  return (
    <div className="ebook print-root">
      {sheets.map((w) => (
        <section key={w.id} className="print-sheet">
          <h2>{w.title}</h2>
          {w.fields.map((f) => (
            <div key={f.id} className="print-field">
              <div className="print-lbl">{f.label}</div>
              <div className="print-val">{String(answers[`${w.id}.${f.id}`] ?? "")}</div>
            </div>
          ))}
        </section>
      ))}
      {sheets.length === 0 && <p style={{ padding: 40 }}>Tidak ada lembar kerja untuk dicetak.</p>}
    </div>
  );
}
