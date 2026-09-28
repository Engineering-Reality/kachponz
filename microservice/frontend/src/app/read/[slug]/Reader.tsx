"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ZoomIn, ZoomOut, BookOpen, Scroll, Bookmark, ChevronLeft } from "lucide-react";
import { pageWindow, needsFetch } from "@/lib/ebook/pageWindow";

// react-pageflip pakai API browser → jangan SSR.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as unknown as React.ComponentType<Record<string, unknown>>;

const RADIUS = 10;

// Satu halaman flipbook: <img> WebP (lazy). react-pageflip wajib forwardRef.
const PageImg = React.forwardRef<HTMLDivElement, { url?: string; pageNum: number; height: number }>(
  ({ url, pageNum, height }, ref) => (
    <div ref={ref} className="bg-white overflow-hidden shadow-inner flex items-center justify-center" data-density="soft" style={{ height }}>
      {url ? (
        <img src={url} alt={`Halaman ${pageNum}`} loading="lazy" draggable={false} className="w-full h-full object-contain pointer-events-none select-none" />
      ) : (
        <span className="text-zinc-300 text-xs select-none">Hal {pageNum}…</span>
      )}
    </div>
  )
);
PageImg.displayName = "PageImg";

const btn = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40";
const btnActive = "bg-zinc-800 text-white";

export default function Reader({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [pageCount, setPageCount] = useState(0);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const loaded = useRef<Set<number>>(new Set());
  const fetching = useRef(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [watermark, setWatermark] = useState("");
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const [viewMode, setViewMode] = useState<"flip" | "scroll">(
    (typeof window !== "undefined" && window.innerWidth < 768) || isTouch ? "scroll" : "flip"
  );
  const [isSinglePageFlip, setIsSinglePageFlip] = useState((typeof window !== "undefined" && window.innerWidth < 768) || isTouch);
  const [scale, setScale] = useState(1.0);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageScroll, setCurrentPageScroll] = useState(1);
  const [bookDim, setBookDim] = useState({ width: 450, height: 636 });
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [initialPage, setInitialPage] = useState(0);
  const [goToPageInput, setGoToPageInput] = useState("");

  type FlipBookApi = { pageFlip: () => { turnToPage: (p: number) => void; flipNext: () => void; flipPrev: () => void } };
  const flipBookRef = useRef<FlipBookApi | null>(null);
  const deviceId = useRef("");
  if (!deviceId.current && typeof window !== "undefined") {
    let id = localStorage.getItem("reader_device_id");
    if (!id) {
      id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem("reader_device_id", id);
    }
    deviceId.current = id;
  }

  const notify = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const fetchWindow = useCallback(
    async (active: number, count: number) => {
      if (!token || fetching.current) return;
      fetching.current = true;
      try {
        const { from, to } = pageWindow(active, count || 1, RADIUS);
        const res = await fetch("/api/get-reader-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, token, deviceId: deviceId.current, from, to }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setAccessError(err.error || "Akses ditolak.");
          return;
        }
        const data = await res.json();
        if (data.pageCount) setPageCount(data.pageCount);
        if (data.watermark) setWatermark(data.watermark);
        if (data.buyerName) setBuyerName(data.buyerName);
        setUrls((prev) => {
          const next = { ...prev };
          for (const { page, url } of data.pages as { page: number; url: string }[]) {
            next[page] = url;
            loaded.current.add(page);
          }
          return next;
        });
      } catch {
        setAccessError("Terjadi kesalahan. Coba lagi.");
      } finally {
        fetching.current = false;
      }
    },
    [slug, token]
  );

  useEffect(() => {
    if (!token) {
      setAccessError("Buka e-book dari link yang dikirim admin lewat WhatsApp.");
      setLoading(false);
      return;
    }
    const savedB = localStorage.getItem(`bookmarks_${slug}`);
    if (savedB) setBookmarks(JSON.parse(savedB));
    const last = parseInt(localStorage.getItem(`lastRead_${slug}`) || "1");
    if (last > 1) {
      setInitialPage(last - 1);
      setCurrentPage(last);
      setCurrentPageScroll(last);
    }
    fetchWindow(last > 1 ? last : 1, 0).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token]);

  useEffect(() => {
    if (pageCount && needsFetch(currentPage, loaded.current, pageCount, RADIUS)) {
      fetchWindow(currentPage, pageCount);
    }
  }, [currentPage, pageCount, fetchWindow]);

  useEffect(() => {
    const onResize = () => {
      const w = Math.min(450, window.innerWidth - 32);
      setBookDim({ width: w, height: w * (636 / 450) });
    };
    onResize();
    window.addEventListener("resize", onResize);
    const block = (e: Event) => {
      e.preventDefault();
      notify("Aksi dinonaktifkan demi melindungi hak cipta e-book.");
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const screenshot =
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(k)) ||
        (e.ctrlKey && e.shiftKey && k === "s") ||
        ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p"));
      if (screenshot) block(e);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    document.addEventListener("contextmenu", block);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
      document.removeEventListener("contextmenu", block);
    };
  }, []);

  const goPage = useCallback(
    (p: number) => {
      setCurrentPage(p);
      localStorage.setItem(`lastRead_${slug}`, String(p));
    },
    [slug]
  );
  useEffect(() => {
    if (viewMode === "scroll") goPage(currentPageScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageScroll, viewMode]);

  const toggleBookmark = () => {
    setBookmarks((prev) => {
      const next = prev.includes(currentPage) ? prev.filter((p) => p !== currentPage) : [...prev, currentPage].sort((a, b) => a - b);
      localStorage.setItem(`bookmarks_${slug}`, JSON.stringify(next));
      notify(prev.includes(currentPage) ? "Bookmark dihapus" : `Halaman ${currentPage} di-bookmark`);
      return next;
    });
  };

  const jumpTo = (p: number) => {
    if (viewMode === "flip") flipBookRef.current?.pageFlip()?.turnToPage(p - 1);
    else setCurrentPageScroll(p);
    setGoToPageInput("");
  };
  const handleGoTo = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(goToPageInput);
    if (!p || p < 1 || p > pageCount) return notify(`Masukkan halaman 1 - ${pageCount}`);
    jumpTo(p);
  };

  const onTap = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("button") || t.closest("input") || window.getSelection()?.toString()) return;
    const flip = flipBookRef.current?.pageFlip();
    if (e.clientX > window.innerWidth * 0.7) {
      if (viewMode === "flip") flip?.flipNext();
      else setCurrentPageScroll((p) => Math.min(pageCount, p + 1));
    } else if (e.clientX < window.innerWidth * 0.3) {
      if (viewMode === "flip") flip?.flipPrev();
      else setCurrentPageScroll((p) => Math.max(1, p - 1));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">Memuat e-book…</div>;
  if (accessError)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 text-white gap-4 px-6 text-center">
        <h2 className="text-xl font-bold">Tidak bisa membuka e-book</h2>
        <p className="text-zinc-300 max-w-md">{accessError}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center select-none overflow-hidden">
      {notice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-zinc-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg border border-zinc-700">{notice}</div>
      )}

      <header className="relative w-full bg-zinc-950 text-white p-4 flex flex-col md:flex-row gap-4 justify-between items-center z-50 border-b border-zinc-800 shadow-xl">
        <div className="flex flex-col">
          <h1 className="font-bold text-sm md:text-base truncate max-w-[200px] md:max-w-xs">{buyerName || slug}</h1>
          {pageCount > 0 && (
            <span className="text-xs text-zinc-400 mt-0.5">Hal {currentPage} dari {pageCount} ({Math.round((currentPage / pageCount) * 100)}%)</span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button className={`${btn} ${viewMode === "flip" ? btnActive : ""}`} onClick={() => { setViewMode("flip"); setScale(1); }}><BookOpen className="w-4 h-4" /> Flip</button>
          <button className={`${btn} ${viewMode === "scroll" ? btnActive : ""}`} onClick={() => setViewMode("scroll")}><Scroll className="w-4 h-4" /> Scroll</button>
          {viewMode === "flip" && (
            <>
              <span className="w-px h-6 bg-zinc-800 mx-1" />
              <button className={`${btn} ${isSinglePageFlip ? btnActive : ""}`} onClick={() => setIsSinglePageFlip(true)}>1 Hal</button>
              <button className={`${btn} ${!isSinglePageFlip ? btnActive : ""}`} onClick={() => setIsSinglePageFlip(false)}>2 Hal</button>
            </>
          )}
          <span className="w-px h-6 bg-zinc-800 mx-1" />
          <button className={`${btn} ${bookmarks.includes(currentPage) ? "text-pink-400" : ""}`} onClick={toggleBookmark}>
            <Bookmark className={`w-4 h-4 ${bookmarks.includes(currentPage) ? "fill-current" : ""}`} />
            <span className="hidden md:inline">{bookmarks.includes(currentPage) ? "Tersimpan" : "Bookmark"}</span>
          </button>
          <form onSubmit={handleGoTo} className="hidden md:flex items-center gap-1">
            <input type="number" placeholder="Hal" value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value)} className="w-16 h-8 bg-zinc-800 border border-zinc-700 rounded text-white text-center text-xs" min={1} max={pageCount || 1} />
            <button type="submit" className={`${btn} ${btnActive}`}>Go</button>
          </form>
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button className={btn} onClick={() => setScale((s) => Math.max(s - 0.2, 0.6))} disabled={scale <= 0.6}><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <button className={btn} onClick={() => setScale((s) => Math.min(s + 0.2, 2.5))} disabled={scale >= 2.5}><ZoomIn className="w-4 h-4" /></button>
        </div>

        {pageCount > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-zinc-800/50">
            <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${(currentPage / pageCount) * 100}%` }} />
          </div>
        )}
      </header>

      <main className="flex-1 w-full flex justify-center overflow-auto relative p-4 md:p-8 cursor-pointer" onClick={onTap}>
        <div id="watermark-container" className="fixed inset-0 z-40 pointer-events-none overflow-hidden rotate-[-30deg] scale-150 flex flex-wrap content-center justify-center gap-x-16 gap-y-24 opacity-[0.12]">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className="text-lg md:text-2xl font-bold text-white whitespace-nowrap">{watermark} · neutrack.id</span>
          ))}
        </div>

        {pageCount > 0 && viewMode === "flip" && (
          <div className="flex items-center justify-center gap-2 md:gap-8 w-full max-w-7xl" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
            <button className="hidden md:flex items-center justify-center rounded-full w-12 h-12 bg-zinc-800 text-white hover:bg-zinc-700 shrink-0" onClick={() => flipBookRef.current?.pageFlip()?.flipPrev()}><ChevronLeft className="w-8 h-8" /></button>
            <div className="flex justify-center shadow-2xl shrink-0">
              <HTMLFlipBook
                width={bookDim.width}
                height={bookDim.height}
                size="fixed"
                maxShadowOpacity={0.3}
                showCover
                startPage={initialPage}
                usePortrait={isSinglePageFlip}
                useMouseEvents
                onFlip={(e: { data: number }) => goPage(e.data + 1)}
                ref={flipBookRef}
                className="bg-transparent"
              >
                {Array.from({ length: pageCount }, (_, i) => (
                  <PageImg key={`p_${i + 1}`} url={urls[i + 1]} pageNum={i + 1} height={bookDim.height} />
                ))}
              </HTMLFlipBook>
            </div>
            <button className="hidden md:flex items-center justify-center rounded-full w-12 h-12 bg-zinc-800 text-white hover:bg-zinc-700 shrink-0" onClick={() => flipBookRef.current?.pageFlip()?.flipNext()}><ChevronLeft className="w-8 h-8 rotate-180" /></button>
          </div>
        )}

        {pageCount > 0 && viewMode === "scroll" && (
          <div className="flex flex-col gap-6 items-center w-full max-w-4xl pb-20" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
            {urls[currentPageScroll] ? (
              <img src={urls[currentPageScroll]} alt={`Halaman ${currentPageScroll}`} draggable={false} className="shadow-2xl bg-white rounded-sm w-full max-w-[800px] select-none pointer-events-none" />
            ) : (
              <div className="w-full max-w-[800px] aspect-[45/64] bg-zinc-800 rounded-sm flex items-center justify-center text-zinc-400">Memuat halaman {currentPageScroll}…</div>
            )}
            <div className="flex items-center gap-4 bg-zinc-950 p-2 rounded-full border border-zinc-800 pointer-events-auto">
              <button disabled={currentPageScroll <= 1} onClick={() => setCurrentPageScroll((p) => p - 1)} className={btn}>&lt; Prev</button>
              <p className="text-sm font-medium text-zinc-300">{currentPageScroll} / {pageCount}</p>
              <button disabled={currentPageScroll >= pageCount} onClick={() => setCurrentPageScroll((p) => p + 1)} className={btn}>Next &gt;</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
