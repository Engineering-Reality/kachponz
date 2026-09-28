"use client";

import { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

// Spread 2-halaman desktop dengan page-turn 3D (engsel tengah). Flip HANYA lewat
// tombol/keyboard (parent) + zona sudut 48px di sini. Mengetik/klik di dalam
// halaman TIDAK memicu flip (tak ada drag global; zona sudut kecil di tepi luar).
export interface SpreadHandle {
  next: () => void;
  prev: () => void;
}

interface Props {
  spread: number; // indeks spread (2 halaman/ spread)
  maxSpread: number;
  renderPage: (pageIndex: number) => ReactNode; // node .page (atau kosong bila di luar)
  pageW: number;
  pageH: number;
  onSpread: (s: number) => void;
}

const EASE = [0.33, 0, 0.2, 1] as const;
const DUR = 0.62;

export const BookSpread = forwardRef<SpreadHandle, Props>(function BookSpread(
  { spread, maxSpread, renderPage, pageW, pageH, onSpread },
  ref
) {
  const [flip, setFlip] = useState<null | "next" | "prev">(null);

  const go = (dir: "next" | "prev") => {
    if (flip) return;
    if (dir === "next" && spread >= maxSpread) return;
    if (dir === "prev" && spread <= 0) return;
    setFlip(dir);
  };
  useImperativeHandle(ref, () => ({ next: () => go("next"), prev: () => go("prev") }), [flip, spread, maxSpread]);

  const L = spread * 2;
  const R = spread * 2 + 1;
  const commit = () => {
    onSpread(flip === "next" ? spread + 1 : spread - 1);
    setFlip(null);
  };

  // Halaman statis di bawah leaf saat flip (yang tersingkap).
  const staticLeft = flip === "prev" ? (spread - 1) * 2 : L;
  const staticRight = flip === "next" ? (spread + 1) * 2 + 1 : R;

  // Leaf yang berputar.
  const leaf = flip
    ? flip === "next"
      ? { front: R, back: (spread + 1) * 2, side: "right" as const, from: 0, to: -180 }
      : { front: L, back: (spread - 1) * 2 + 1, side: "left" as const, from: 0, to: 180 }
    : null;

  const Sheet = ({ i }: { i: number }) => (
    <div style={{ width: pageW, height: pageH, flex: "0 0 auto" }}>{renderPage(i)}</div>
  );
  const cornerZone = (dir: "next" | "prev") => (
    <button
      aria-label={dir === "next" ? "Halaman berikutnya" : "Halaman sebelumnya"}
      onClick={() => go(dir)}
      style={{ position: "absolute", top: 0, bottom: 0, [dir === "next" ? "right" : "left"]: 0, width: 48, background: "transparent", border: 0, cursor: "pointer", zIndex: 5 }}
    />
  );

  return (
    <div style={{ position: "relative", width: pageW * 2, height: pageH, background: "#0000",
      boxShadow: "0 30px 80px rgba(0,0,0,.45)", perspective: 2400 }}>
      {/* dua halaman dasar */}
      <div style={{ display: "flex", width: pageW * 2, height: pageH }}>
        <Sheet i={staticLeft} />
        <Sheet i={staticRight} />
      </div>
      {/* bayangan lipatan tengah (gutter) */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: pageW - 18, width: 36, pointerEvents: "none",
        background: "linear-gradient(90deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.18) 48%,rgba(0,0,0,0) 52%,rgba(0,0,0,.10) 100%)", zIndex: 3 }} />

      {/* leaf berputar */}
      {leaf && (
        <motion.div
          initial={{ rotateY: leaf.from }}
          animate={{ rotateY: leaf.to }}
          transition={{ duration: DUR, ease: EASE }}
          onAnimationComplete={commit}
          style={{ position: "absolute", top: 0, [leaf.side === "right" ? "left" : "right"]: pageW, width: pageW, height: pageH,
            transformStyle: "preserve-3d", transformOrigin: leaf.side === "right" ? "left center" : "right center", zIndex: 4 }}
        >
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}><Sheet i={leaf.front} /></div>
          <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}><Sheet i={leaf.back} /></div>
          {/* bayangan bergerak mengikuti putaran */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(105deg, rgba(0,0,0,.25), rgba(0,0,0,0) 60%)" }} />
        </motion.div>
      )}

      {cornerZone("prev")}
      {cornerZone("next")}
    </div>
  );
});
