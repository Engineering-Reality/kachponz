"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronLeft, ChevronRight, ListTree, Moon, Sun, Maximize2, X } from "lucide-react";
import { BlockView } from "@/components/ebook/Blocks";
import { BookSpread, type SpreadHandle } from "@/components/ebook/BookSpread";
import { paginate, type PageAtom } from "@/components/ebook/Paginator";
import type { Block, Book } from "@/components/ebook/types";
import "@/app/read/ebook-theme.css";

const PROFILE = { desktop: { w: 560, h: 790, margin: 40 }, mobile: { w: 380, h: 680, margin: 24 } };
function pickProfile() {
  if (typeof window === "undefined") return "desktop" as const;
  const landscape = window.innerWidth >= window.innerHeight;
  return window.innerWidth >= 1024 && landscape ? ("desktop" as const) : ("mobile" as const);
}

export default function ReaderV2({ slug }: { slug: string }) {
  const token = useSearchParams().get("t");
  const { resolvedTheme, setTheme } = useTheme();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<"desktop" | "mobile">("desktop");
  const [pages, setPages] = useState<string[][]>([]);
  const [spread, setSpread] = useState(0); // desktop: indeks spread
  const [cur, setCur] = useState(0); // mobile: indeks halaman
  const [tocOpen, setTocOpen] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<SpreadHandle>(null);

  const deviceId = useRef("");
  if (!deviceId.current && typeof window !== "undefined") {
    let id = localStorage.getItem("reader_device_id");
    if (!id) { id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; localStorage.setItem("reader_device_id", id); }
    deviceId.current = id;
  }

  useEffect(() => setProfile(pickProfile()), []);
  useEffect(() => { const r = () => setProfile(pickProfile()); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);

  useEffect(() => {
    (async () => {
      try {
        const qs = token ? `?t=${encodeURIComponent(token)}&d=${encodeURIComponent(deviceId.current)}` : "";
        const res = await fetch(`/api/ebook/${slug}/content${qs}`);
        const data = await res.json();
        if (!res.ok) return setError(data.error || "Akses ditolak.");
        setBook(data);
      } catch { setError("Terjadi kesalahan memuat e-book."); }
    })();
  }, [slug, token]);

  const flat = useMemo(() => {
    if (!book) return [] as { id: string; block: Block; ci: number }[];
    const out: { id: string; block: Block; ci: number }[] = [];
    book.chapters.forEach((c, ci) => c.blocks.forEach((b, bi) => out.push({ id: `${ci}.${bi}`, block: b, ci })));
    return out;
  }, [book]);

  const prof = PROFILE[profile];
  const contentH = prof.h - prof.margin * 2;

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
      if (!cancelled) { setPages(laid.map((p) => p.atoms)); setSpread(0); setCur(0); }
    };
    (document.fonts?.ready || Promise.resolve()).then(run);
    return () => { cancelled = true; };
  }, [book, flat, contentH, profile]);

  const byId = useMemo(() => new Map(flat.map((f) => [f.id, f.block])), [flat]);
  const maxSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);

  // Peta bab -> halaman pertama (untuk daftar isi).
  const chapterStart = useMemo(() => {
    const m = new Map<number, number>();
    pages.forEach((ids, pi) => { const ci = Number(ids[0]?.split(".")[0]); if (!m.has(ci)) m.set(ci, pi); });
    return m;
  }, [pages]);

  const gotoPage = useCallback((pi: number) => {
    const p = Math.max(0, Math.min(pages.length - 1, pi));
    if (profile === "desktop") setSpread(Math.floor(p / 2)); else setCur(p);
  }, [pages.length, profile]);

  // Keyboard (desktop).
  useEffect(() => {
    if (profile !== "desktop") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") spreadRef.current?.next();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") spreadRef.current?.prev();
      else if (e.key === "Home") setSpread(0);
      else if (e.key === "End") setSpread(maxSpread);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile, maxSpread]);

  const renderPage = useCallback((i: number) => {
    if (i < 0 || i >= pages.length) return <div className="page" style={{ width: prof.w, height: prof.h }} />;
    return (
      <div className="page" style={{ width: prof.w, height: prof.h, padding: prof.margin }}>
        <div style={{ position: "relative", zIndex: 1 }}>{pages[i].map((id) => <BlockView key={id} b={byId.get(id)!} />)}</div>
        <div className={`pageno ${i % 2 === 0 ? "l" : "r"}`}>{i + 1}</div>
      </div>
    );
  }, [pages, byId, prof]);

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white gap-3 px-6 text-center"><h2 className="text-xl font-bold">Tidak bisa membuka e-book</h2><p className="text-zinc-300 max-w-md">{error}</p></div>;
  if (!book) return <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">Memuat e-book…</div>;

  const isDark = resolvedTheme === "dark";
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const desktopScale = Math.min(1, (vw - 56) / (prof.w * 2));
  const mobileScale = Math.min(1, (vw - 24) / prof.w);
  const curPage = profile === "desktop" ? spread * 2 : cur;

  const iconBtn = "p-2 rounded-lg text-zinc-300 hover:bg-white/10 disabled:opacity-40";

  return (
    <div className={`ebook min-h-screen flex flex-col ${isDark ? "dark" : ""}`} style={{ background: "var(--desk, #2b2b33)" }}>
      {/* toolbar */}
      <header className="flex items-center justify-between gap-3 px-4 py-2 bg-black/40 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <button className={iconBtn} onClick={() => setTocOpen(true)} aria-label="Daftar isi"><ListTree size={18} /></button>
          <h1 className="text-sm font-medium truncate">{book.title}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button className={iconBtn} onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Ganti tema">{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className={iconBtn} onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Layar penuh"><Maximize2 size={18} /></button>
        </div>
      </header>

      {/* hidden measure */}
      <div ref={measureRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: prof.w - prof.margin * 2, visibility: "hidden" }}>
        {flat.map((f) => <div key={f.id} data-atom={f.id}>{f.block.type !== "fullPage" && <BlockView b={f.block} />}</div>)}
      </div>

      {book.preview && <p className="text-amber-300 text-sm text-center py-2">Pratinjau — bab preview saja.</p>}

      {/* viewer */}
      <main className="flex-1 flex items-center justify-center overflow-auto p-4">
        {pages.length === 0 ? (
          <p className="text-white/70">Menyusun halaman…</p>
        ) : profile === "desktop" ? (
          <div className="flex items-center gap-3">
            <button className="text-white/80 hover:text-white disabled:opacity-30" disabled={spread <= 0} onClick={() => spreadRef.current?.prev()} aria-label="Sebelumnya"><ChevronLeft size={40} /></button>
            <div style={{ width: prof.w * 2 * desktopScale, height: prof.h * desktopScale }}>
              <div style={{ transform: `scale(${desktopScale})`, transformOrigin: "top left" }}>
                <BookSpread ref={spreadRef} spread={spread} maxSpread={maxSpread} onSpread={setSpread} renderPage={renderPage} pageW={prof.w} pageH={prof.h} />
              </div>
            </div>
            <button className="text-white/80 hover:text-white disabled:opacity-30" disabled={spread >= maxSpread} onClick={() => spreadRef.current?.next()} aria-label="Berikutnya"><ChevronRight size={40} /></button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div style={{ width: prof.w * mobileScale, height: prof.h * mobileScale }}>
              <div style={{ transform: `scale(${mobileScale})`, transformOrigin: "top left", boxShadow: "0 10px 40px rgba(0,0,0,.4)" }}>{renderPage(cur)}</div>
            </div>
            <div className="flex items-center gap-4 text-white">
              <button className={iconBtn} disabled={cur <= 0} onClick={() => setCur((c) => c - 1)}><ChevronLeft size={20} /></button>
              <span className="text-sm">{cur + 1} / {pages.length}</span>
              <button className={iconBtn} disabled={cur >= pages.length - 1} onClick={() => setCur((c) => c + 1)}><ChevronRight size={20} /></button>
            </div>
          </div>
        )}
      </main>

      {/* slider halaman */}
      {pages.length > 0 && (
        <footer className="px-6 py-3 bg-black/40">
          <input type="range" min={1} max={pages.length} value={curPage + 1} onChange={(e) => gotoPage(Number(e.target.value) - 1)} className="w-full accent-pink-500" aria-label="Geser halaman" />
          <p className="text-center text-white/60 text-xs mt-1">Halaman {curPage + 1}–{Math.min(curPage + (profile === "desktop" ? 2 : 1), pages.length)} dari {pages.length}</p>
        </footer>
      )}

      {/* TOC drawer */}
      {tocOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex" onClick={() => setTocOpen(false)}>
          <nav className="w-72 max-w-[80vw] h-full bg-zinc-900 text-white p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Daftar Isi</h2><button onClick={() => setTocOpen(false)} aria-label="Tutup"><X size={18} /></button></div>
            <ol className="space-y-1">
              {book.chapters.map((c, ci) => (
                <li key={c.id}>
                  <button className="w-full text-left px-2 py-2 rounded hover:bg-white/10 text-sm" onClick={() => { const p = chapterStart.get(ci); if (p != null) gotoPage(p); setTocOpen(false); }}>{c.title}</button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}
    </div>
  );
}
