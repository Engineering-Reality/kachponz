"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, useMotionValue, motion } from "framer-motion";

// Pager HP: 1 halaman, geser horizontal MENGIKUTI jari (track 3 halaman), snap
// spring. Geser TIDAK aktif bila sentuhan mulai di input/textarea/select/tabel
// bisa-geser/[data-no-swipe]. Tap (gerak kecil) memanggil onTap (toggle chrome).
interface Props {
  cur: number;
  count: number;
  renderPage: (i: number) => ReactNode;
  pageW: number;
  pageH: number;
  onCur: (i: number) => void;
  onTap: () => void;
  reduced: boolean;
}

const THRESH = 0.32; // fraksi lebar untuk pindah halaman
const SPRING = { type: "spring" as const, stiffness: 320, damping: 34 };

export function MobilePager({ cur, count, renderPage, pageW, pageH, onCur, onTap, reduced }: Props) {
  const x = useMotionValue(-cur * pageW);
  const startX = useRef(0);
  const baseX = useRef(0);
  const swiping = useRef(false);
  const moved = useRef(0);

  // Sinkronkan posisi bila cur berubah dari luar (slider/TOC/tombol).
  useEffect(() => {
    if (reduced) { x.set(-cur * pageW); return; }
    const controls = animate(x, -cur * pageW, SPRING);
    return () => controls.stop();
  }, [cur, pageW, reduced, x]);

  const noSwipeTarget = (t: EventTarget | null) =>
    !!(t as HTMLElement)?.closest?.("input,textarea,select,button,a,[data-no-swipe],.swipeable-table");

  const onDown = (e: React.PointerEvent) => {
    if (reduced) return;
    swiping.current = !noSwipeTarget(e.target);
    startX.current = e.clientX;
    baseX.current = x.get();
    moved.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!swiping.current) return;
    const dx = e.clientX - startX.current;
    moved.current = Math.abs(dx);
    // resistensi di ujung
    let nx = baseX.current + dx;
    const min = -(count - 1) * pageW, max = 0;
    if (nx > max) nx = max + (nx - max) * 0.3;
    if (nx < min) nx = min + (nx - min) * 0.3;
    x.set(nx);
  };
  const onUp = (e: React.PointerEvent) => {
    const dx = e.clientX - startX.current;
    if (swiping.current && Math.abs(dx) > pageW * THRESH) {
      const target = Math.max(0, Math.min(count - 1, cur + (dx < 0 ? 1 : -1)));
      if (target !== cur) { onCur(target); swiping.current = false; return; }
    }
    if (swiping.current) animate(x, -cur * pageW, SPRING);
    if (moved.current < 8) onTap(); // tap
    swiping.current = false;
  };

  // Virtualisasi: hanya render cur-1..cur+1.
  const items = [];
  for (let i = Math.max(0, cur - 1); i <= Math.min(count - 1, cur + 1); i++) {
    items.push(
      <div key={i} style={{ position: "absolute", left: i * pageW, top: 0, width: pageW, height: pageH,
        boxShadow: "0 8px 30px rgba(0,0,0,.35)" }}>
        {renderPage(i)}
      </div>
    );
  }

  if (reduced) {
    return (
      <div onPointerUp={() => onTap()} style={{ width: pageW, height: pageH, position: "relative", overflow: "hidden" }}>
        <motion.div key={cur} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
          style={{ position: "absolute", inset: 0 }}>{renderPage(cur)}</motion.div>
      </div>
    );
  }

  return (
    <div style={{ width: pageW, height: pageH, position: "relative", overflow: "hidden", touchAction: "pan-y" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <motion.div style={{ position: "absolute", top: 0, left: 0, height: pageH, x }}>{items}</motion.div>
    </div>
  );
}
