"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BlockView } from "@/components/ebook/Blocks";
import { paginate, type PageAtom } from "@/components/ebook/Paginator";
import type { Block, Book } from "@/components/ebook/types";
import "@/app/read/ebook-theme.css";

const PROFILE = {
  desktop: { w: 560, h: 790, margin: 40 },
  mobile: { w: 380, h: 680, margin: 24 },
};
function pickProfile() {
  if (typeof window === "undefined") return "desktop" as const;
  const landscape = window.innerWidth >= window.innerHeight;
  return window.innerWidth >= 1024 && landscape ? ("desktop" as const) : ("mobile" as const);
}

export default function ReaderV2({ slug }: { slug: string }) {
  const token = useSearchParams().get("t");
  const [book, setBook] = useState<Book | null>(null);
  const [watermark, setWatermark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<"desktop" | "mobile">("desktop");
  const [pages, setPages] = useState<string[][]>([]); // id blok per halaman
  const measureRef = useRef<HTMLDivElement>(null);

  const deviceId = useRef("");
  if (!deviceId.current && typeof window !== "undefined") {
    let id = localStorage.getItem("reader_device_id");
    if (!id) { id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; localStorage.setItem("reader_device_id", id); }
    deviceId.current = id;
  }

  useEffect(() => setProfile(pickProfile()), []);
  useEffect(() => {
    const onR = () => setProfile(pickProfile());
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const qs = token ? `?t=${encodeURIComponent(token)}&d=${encodeURIComponent(deviceId.current)}` : "";
        const res = await fetch(`/api/ebook/${slug}/content${qs}`);
        const data = await res.json();
        if (!res.ok) return setError(data.error || "Akses ditolak.");
        setBook(data);
        if (data.watermark) setWatermark(data.watermark);
      } catch {
        setError("Terjadi kesalahan memuat e-book.");
      }
    })();
  }, [slug, token]);

  // Daftar blok datar + id stabil (chapterIdx.blockIdx).
  const flat = useMemo(() => {
    if (!book) return [] as { id: string; block: Block }[];
    const out: { id: string; block: Block }[] = [];
    book.chapters.forEach((c, ci) => c.blocks.forEach((b, bi) => out.push({ id: `${ci}.${bi}`, block: b })));
    return out;
  }, [book]);

  const prof = PROFILE[profile];
  const contentH = prof.h - prof.margin * 2;

  // Ukur tinggi tiap blok pada lebar halaman profil → paginate.
  useLayoutEffect(() => {
    if (!book || !measureRef.current) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || !measureRef.current) return;
      const nodes = Array.from(measureRef.current.querySelectorAll<HTMLElement>("[data-atom]"));
      const atoms: PageAtom[] = nodes.map((n) => {
        const id = n.dataset.atom!;
        const block = flat.find((f) => f.id === id)!.block;
        return block.type === "fullPage"
          ? { id, height: contentH, fullPage: true, alignRight: block.kind === "chapterOpener" && profile === "desktop" }
          : { id, height: n.offsetHeight };
      });
      const laid = paginate(atoms, contentH, { alignOpeners: profile === "desktop" });
      if (!cancelled) setPages(laid.map((p) => p.atoms));
    };
    // tunggu font siap agar tinggi stabil
    (document.fonts?.ready || Promise.resolve()).then(run);
    return () => { cancelled = true; };
  }, [book, flat, contentH, profile]);

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white gap-3 px-6 text-center"><h2 className="text-xl font-bold">Tidak bisa membuka e-book</h2><p className="text-zinc-300 max-w-md">{error}</p></div>;
  if (!book) return <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">Memuat e-book…</div>;

  const byId = new Map(flat.map((f) => [f.id, f.block]));
  const scale = typeof window !== "undefined" ? Math.min(1, (window.innerWidth - 24) / prof.w) : 1;

  return (
    <div className="ebook min-h-screen bg-zinc-800 py-8 flex flex-col items-center gap-6">
      {/* Container ukur tersembunyi (lebar konten profil). */}
      <div ref={measureRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: prof.w - prof.margin * 2, visibility: "hidden" }}>
        {flat.map((f) => <div key={f.id} data-atom={f.id}>{f.block.type !== "fullPage" && <BlockView b={f.block} />}</div>)}
      </div>

      {book.preview && <p className="text-amber-300 text-sm">Pratinjau — bab preview saja. Beli untuk akses penuh.</p>}

      {pages.map((ids, i) => (
        <div key={i} style={{ width: prof.w * scale, height: prof.h * scale }}>
          <div className="page" style={{ width: prof.w, height: prof.h, padding: prof.margin, transform: `scale(${scale})`, transformOrigin: "top left", boxShadow: "0 10px 40px rgba(0,0,0,.4)", borderRadius: 6 }}>
            {watermark && <div className="wm">{Array.from({ length: 24 }).map((_, k) => <span key={k}>{watermark} · neutrack.id</span>)}</div>}
            <div style={{ position: "relative", zIndex: 1 }}>
              {ids.map((id) => <BlockView key={id} b={byId.get(id)!} />)}
            </div>
            <div className={`pageno ${i % 2 === 0 ? "l" : "r"}`}>{i + 1}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
