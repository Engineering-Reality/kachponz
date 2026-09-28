"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronLeft, ChevronRight, ListTree, Moon, Sun, Maximize2, X, Printer, Compass, Sparkles } from "lucide-react";
import { BlockView } from "@/components/ebook/Blocks";
import { printSheets } from "@/components/ebook/Interactive";
import { BookSpread, type SpreadHandle } from "@/components/ebook/BookSpread";
import { MobilePager } from "@/components/ebook/MobilePager";
import { EbookProvider } from "@/components/ebook/state";
import { paginate, type PageAtom } from "@/components/ebook/Paginator";
import { prepareChapters } from "@/components/ebook/BlockSplitter";
import type { Block, Book } from "@/components/ebook/types";
import { AuroraBackground } from "@/components/AuroraBackground";
import { PalaceMapModal } from "@/components/ebook/PalaceMap";
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
  const [spread, setSpread] = useState(0);
  const [cur, setCur] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [chrome, setChrome] = useState(true); // mobile: toolbar/bar terlihat
  const [reduced, setReduced] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<SpreadHandle>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deviceId = useRef("");
  if (!deviceId.current && typeof window !== "undefined") {
    let id = localStorage.getItem("reader_device_id");
    if (!id) {
      id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("reader_device_id", id);
    }
    deviceId.current = id;
  }

  useEffect(() => {
    setProfile(pickProfile());
    setReduced(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);
  useEffect(() => {
    const r = () => setProfile(pickProfile());
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const qs = token ? `?t=${encodeURIComponent(token)}&d=${encodeURIComponent(deviceId.current)}` : "";
        const res = await fetch(`/api/ebook/${slug}/content${qs}`);
        const data = await res.json();
        if (!res.ok) return setError(data.error || "Akses ditolak.");
        setBook(data);
      } catch {
        setError("Terjadi kesalahan memuat e-book.");
      }
    })();
  }, [slug, token]);

  // Siapkan dan pecah blok menggunakan BlockSplitter agar tidak ada atom yang overflow
  const flat = useMemo(() => {
    if (!book) return [] as { id: string; block: Block; ci: number }[];
    return prepareChapters(book.chapters);
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
        const rect = n.getBoundingClientRect();
        return block.type === "fullPage"
          ? { id, height: contentH, fullPage: true, alignRight: block.kind === "chapterOpener" && profile === "desktop" }
          : { id, height: rect.height };
      });
      const laid = paginate(atoms, contentH, { alignOpeners: profile === "desktop", gap: 12 });
      if (!cancelled) {
        setPages(laid.map((p) => p.atoms));
        setSpread(0);
        setCur(0);
      }
    };
    (document.fonts?.ready || Promise.resolve()).then(run);
    return () => {
      cancelled = true;
    };
  }, [book, flat, contentH, profile]);

  const byId = useMemo(() => new Map(flat.map((f) => [f.id, f.block])), [flat]);
  const maxSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);

  const chapterStart = useMemo(() => {
    const m = new Map<number, number>();
    pages.forEach((ids, pi) => {
      const ci = Number(ids[0]?.split(".")[0]);
      if (!m.has(ci)) m.set(ci, pi);
    });
    return m;
  }, [pages]);

  const gotoPage = useCallback((pi: number) => {
    const p = Math.max(0, Math.min(pages.length - 1, pi));
    if (profile === "desktop") setSpread(Math.floor(p / 2));
    else setCur(p);
  }, [pages.length, profile]);

  const nextPage = useCallback(() => {
    if (profile === "desktop") {
      spreadRef.current?.next();
    } else {
      setCur((c) => Math.min(pages.length - 1, c + 1));
    }
  }, [profile, pages.length]);

  // Chrome mobile: auto-hide 3 detik saat terlihat.
  const pokeChrome = useCallback((show: boolean) => {
    setChrome(show);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (show) hideTimer.current = setTimeout(() => setChrome(false), 3000);
  }, []);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

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
        <div className="page-content" style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pages[i].map((id) => (
              <BlockView key={id} b={byId.get(id)!} onNextPage={nextPage} />
            ))}
          </div>
        </div>
        <div className={`pageno ${i % 2 === 0 ? "l" : "r"}`}>{i + 1}</div>
      </div>
    );
  }, [pages, byId, prof, nextPage]);

  if (error) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B0A1F] text-white gap-3 px-6 text-center"><h2 className="text-xl font-bold font-[family-name:var(--font-fraunces)]">Tidak bisa membuka e-book</h2><p className="text-zinc-400 max-w-md">{error}</p></div>;
  if (!book) return <div className="min-h-screen flex items-center justify-center bg-[#0B0A1F] text-white font-[family-name:var(--font-fraunces)]">Membuka Istana Pikiran…</div>;

  const isDark = resolvedTheme === "dark";
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const desktopScale = Math.min(1, (vw - 56) / (prof.w * 2));
  const mobileScale = Math.min(1, (vw - 8) / prof.w);
  const curPage = profile === "desktop" ? spread * 2 : cur;
  const iconBtn = "p-2 rounded-xl text-zinc-200 hover:bg-white/10 disabled:opacity-40 transition-colors";
  const themeCls = `ebook ${isDark ? "dark" : ""}`;
  const storageKey = `mmp:${slug}:${book.watermark || "guest"}`;

  // ── MOBILE ───────────────────────────────────────────────────────────────
  const mobile = (
    <div className={`${themeCls} fixed inset-0 flex items-center justify-center overflow-hidden`} style={{ background: isDark ? "#0b0a1f" : "#26262e" }}>
      {isDark && <AuroraBackground />}

      <div ref={measureRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: prof.w - prof.margin * 2, visibility: "hidden" }}>
        {flat.map((f) => (
          <div key={f.id} data-atom={f.id} style={{ display: "flow-root" }}>
            {f.block.type !== "fullPage" && <BlockView b={f.block} />}
          </div>
        ))}
      </div>

      {pages.length > 0 && (
        <div style={{ width: prof.w * mobileScale, height: prof.h * mobileScale }}>
          <div style={{ transform: `scale(${mobileScale})`, transformOrigin: "top left" }}>
            <MobilePager cur={cur} count={pages.length} renderPage={renderPage} pageW={prof.w} pageH={prof.h} onCur={setCur} onTap={() => pokeChrome(!chrome)} reduced={reduced} />
          </div>
        </div>
      )}

      {/* top chrome */}
      <header className={`absolute top-0 inset-x-0 bg-black/70 backdrop-blur-md text-white flex items-center justify-between px-3 transition-transform ${chrome ? "translate-y-0" : "-translate-y-full"}`} style={{ paddingTop: "env(safe-area-inset-top,0px)", height: "calc(48px + env(safe-area-inset-top,0px))" }}>
        <h1 className="text-xs font-semibold truncate font-[family-name:var(--font-fraunces)]">{book.title}</h1>
        <div className="flex items-center gap-1">
          <button className={iconBtn} onClick={() => setMapOpen(true)} aria-label="Peta Istana"><Compass size={18} className="text-amber-400" /></button>
          <button className={iconBtn} onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Ganti tema">{isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} />}</button>
        </div>
      </header>

      {/* bottom chrome */}
      <footer className={`absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-md text-white px-4 pt-2 transition-transform ${chrome ? "translate-y-0" : "translate-y-full"}`} style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom,0px))" }}>
        <div className="flex items-center gap-3">
          <button className={iconBtn} onClick={() => setTocOpen(true)} aria-label="Daftar isi"><ListTree size={18} /></button>
          <input type="range" min={1} max={pages.length} value={cur + 1} onChange={(e) => setCur(Number(e.target.value) - 1)} className="flex-1 accent-amber-400" aria-label="Geser halaman" />
          <span className="text-xs tabular-nums font-mono">{cur + 1}/{pages.length}</span>
        </div>
      </footer>

      {tocOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setTocOpen(false)}>
          <nav className="w-full max-h-[70vh] bg-zinc-900 text-white rounded-t-3xl p-5 overflow-auto border-t border-white/10" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom,0px))" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h2 className="font-bold font-[family-name:var(--font-fraunces)]">Daftar Isi</h2><button onClick={() => setTocOpen(false)} aria-label="Tutup"><X size={18} /></button></div>
            <ol className="space-y-1.5">
              {book.chapters.map((c, ci) => (
                <li key={c.id}><button className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm flex items-center justify-between" onClick={() => { const p = chapterStart.get(ci); if (p != null) setCur(p); setTocOpen(false); }}><span>{c.title}</span></button></li>
              ))}
            </ol>
          </nav>
        </div>
      )}

      {mapOpen && (
        <PalaceMapModal chapters={book.chapters} chapterStart={chapterStart} onJump={(p) => { gotoPage(p); setMapOpen(false); }} onClose={() => setMapOpen(false)} />
      )}
    </div>
  );

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  const desktop = (
    <div className={`${themeCls} min-h-screen flex flex-col relative`} style={{ background: isDark ? "#0b0a1f" : "#1e1b4b" }}>
      {isDark && <AuroraBackground />}

      <header className="flex items-center justify-between gap-3 px-6 py-3 bg-black/50 backdrop-blur-md text-white border-b border-white/10 relative z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button className={iconBtn} onClick={() => setTocOpen(true)} aria-label="Daftar isi"><ListTree size={18} /></button>
          <button className={`${iconBtn} flex items-center gap-1.5 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-xl`} onClick={() => setMapOpen(true)} aria-label="Peta Istana">
            <Compass size={16} />
            <span className="text-xs font-bold font-[family-name:var(--font-fraunces)]">Peta Istana</span>
          </button>
          <h1 className="text-sm font-semibold truncate font-[family-name:var(--font-fraunces)]">{book.title}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={iconBtn} onClick={() => printSheets("all")} aria-label="Cetak semua lembar kerja"><Printer size={18} /></button>
          <button className={iconBtn} onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Ganti tema">{isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} />}</button>
          <button className={iconBtn} onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Layar penuh"><Maximize2 size={18} /></button>
        </div>
      </header>

      <div ref={measureRef} aria-hidden style={{ position: "absolute", left: -99999, top: 0, width: prof.w - prof.margin * 2, visibility: "hidden" }}>
        {flat.map((f) => (
          <div key={f.id} data-atom={f.id} style={{ display: "flow-root" }}>
            {f.block.type !== "fullPage" && <BlockView b={f.block} />}
          </div>
        ))}
      </div>

      {book.preview && <p className="text-amber-300 text-xs text-center py-1.5 bg-amber-500/10 relative z-10 font-medium">Pratinjau — bab preview saja.</p>}

      <main className="flex-1 flex items-center justify-center overflow-auto p-4 relative z-10">
        {pages.length === 0 ? (
          <div className="flex items-center gap-2 text-white/80 font-[family-name:var(--font-fraunces)]">
            <Sparkles size={18} className="text-amber-400 animate-spin" />
            <span>Membuka Ruangan Istana…</span>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button className="text-white/80 hover:text-white disabled:opacity-20 p-2 transition-opacity" disabled={spread <= 0} onClick={() => spreadRef.current?.prev()} aria-label="Sebelumnya"><ChevronLeft size={44} /></button>
            <div style={{ width: prof.w * 2 * desktopScale, height: prof.h * desktopScale }}>
              <div style={{ transform: `scale(${desktopScale})`, transformOrigin: "top left" }}>
                <BookSpread ref={spreadRef} spread={spread} maxSpread={maxSpread} onSpread={setSpread} renderPage={renderPage} pageW={prof.w} pageH={prof.h} />
              </div>
            </div>
            <button className="text-white/80 hover:text-white disabled:opacity-20 p-2 transition-opacity" disabled={spread >= maxSpread} onClick={() => spreadRef.current?.next()} aria-label="Berikutnya"><ChevronRight size={44} /></button>
          </div>
        )}
      </main>

      {pages.length > 0 && (
        <footer className="px-8 py-3 bg-black/50 backdrop-blur-md border-t border-white/10 relative z-20">
          <input type="range" min={1} max={pages.length} value={curPage + 1} onChange={(e) => gotoPage(Number(e.target.value) - 1)} className="w-full accent-amber-400" aria-label="Geser halaman" />
          <p className="text-center text-white/70 text-xs mt-1 font-mono">Halaman {curPage + 1}–{Math.min(curPage + 2, pages.length)} dari {pages.length}</p>
        </footer>
      )}

      {tocOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex" onClick={() => setTocOpen(false)}>
          <nav className="w-80 max-w-[80vw] h-full bg-zinc-900 text-white p-6 overflow-auto border-r border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold font-[family-name:var(--font-fraunces)] text-lg">Daftar Isi</h2><button onClick={() => setTocOpen(false)} aria-label="Tutup"><X size={18} /></button></div>
            <ol className="space-y-1.5">
              {book.chapters.map((c, ci) => (
                <li key={c.id}><button className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm flex items-center justify-between" onClick={() => { const p = chapterStart.get(ci); if (p != null) gotoPage(p); setTocOpen(false); }}><span>{c.title}</span></button></li>
              ))}
            </ol>
          </nav>
        </div>
      )}

      {mapOpen && (
        <PalaceMapModal chapters={book.chapters} chapterStart={chapterStart} onJump={(p) => { gotoPage(p); setMapOpen(false); }} onClose={() => setMapOpen(false)} />
      )}
    </div>
  );

  return <EbookProvider storageKey={storageKey} profile={profile}>{profile === "mobile" ? mobile : desktop}</EbookProvider>;
}
