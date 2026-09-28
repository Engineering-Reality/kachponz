"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Sparkles, Award, Star, Compass } from "lucide-react";
import { useEbook } from "./state";
import { TwinkleStarRow } from "./ornaments/StarOrnaments";
import { SketchBorder } from "./SketchBorder";
import type { Chapter } from "./types";

export interface RoomInfo {
  index: number;
  id: string;
  name: string;
  badge: string;
  color: string;
}

export const PALACE_ROOMS: RoomInfo[] = [
  { index: 0, id: "ruang-1", name: "Ruang Paradoks", badge: "Kunci Pertanyaan", color: "#3b82f6" },
  { index: 1, id: "ruang-2", name: "Taman Kebijaksanaan", badge: "Kompas Rasa Ingin Tahu", color: "#10b981" },
  { index: 2, id: "ruang-3", name: "Menara Metakognisi", badge: "Cermin Pengawas", color: "#8b5cf6" },
  { index: 3, id: "ruang-4", name: "Studio Renaisans", badge: "Kuas Polimatik", color: "#f59e0b" },
  { index: 4, id: "ruang-5", name: "Laboratorium Strategi", badge: "Botol Wow", color: "#ec4899" },
  { index: 5, id: "ruang-6", name: "Benteng Keberanian", badge: "Perisai Ketahanan", color: "#ef4444" },
];

export function PalaceMap({
  chapters = [],
  chapterStart = new Map<number, number>(),
  onJump,
}: {
  chapters?: Chapter[];
  chapterStart?: Map<number, number>;
  onJump?: (pageIndex: number) => void;
}) {
  const { getStarCount, getBadgeUnlocked } = useEbook();
  const reduced = useReducedMotion();

  return (
    <div className="w-full flex flex-col items-center justify-between p-2">
      <div className="w-full text-center mb-4">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
          <Compass size={14} />
          <span>Peta Penjelajahan Istana Pikiran</span>
        </div>
        <h2 className="text-2xl font-bold font-[family-name:var(--serif)] text-[var(--ink)]">
          Enam Ruangan Istana
        </h2>
        <p className="text-xs text-[var(--ink-soft)] max-w-sm mx-auto mt-1">
          Kumpulkan 3 bintang di setiap ruangan untuk menyalakan jendela dan meraih lencana stiker.
        </p>
      </div>

      {/* Castle Illustration with 6 Interactive Glowing Windows */}
      <div className="relative w-full max-w-md aspect-[4/3] bg-[var(--sheet)] border border-[var(--line)] rounded-3xl p-4 shadow-xl flex flex-col justify-between overflow-hidden">
        {/* Decorative Background Roof Outline */}
        <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
          <svg viewBox="0 0 400 300" className="w-full h-full" fill="currentColor">
            <path d="M 50,280 L 50,140 L 100,80 L 150,140 L 250,140 L 300,80 L 350,140 L 350,280 Z" />
            <polygon points="100,80 70,140 130,140" />
            <polygon points="300,80 270,140 330,140" />
            <polygon points="200,30 160,100 240,100" />
          </svg>
        </div>

        {/* 6 Windows Grid */}
        <div className="grid grid-cols-3 gap-3 relative z-10 my-auto">
          {PALACE_ROOMS.map((room, i) => {
            const stars = getStarCount(room.id);
            const badgeUnlocked = getBadgeUnlocked(room.id);
            const isLit = stars > 0;
            const targetPage = chapterStart.get(i + 2) ?? 0; // Skip cover & TOC

            return (
              <motion.button
                key={room.id}
                type="button"
                onClick={() => onJump?.(targetPage)}
                whileTap={reduced ? {} : { scale: 0.95 }}
                className="squish-btn flex flex-col items-center justify-between p-3 rounded-2xl border transition-all text-center relative overflow-hidden"
                style={{
                  background: isLit ? "var(--sheet)" : "var(--paper)",
                  borderColor: isLit ? room.color : "var(--line)",
                  boxShadow: isLit ? `0 0 16px ${room.color}33` : "none",
                }}
              >
                {/* Arch Window Shape */}
                <div
                  className="w-10 h-12 rounded-t-full border-2 flex items-center justify-center transition-colors mb-2 relative"
                  style={{
                    borderColor: isLit ? room.color : "var(--line)",
                    background: isLit ? `${room.color}22` : "transparent",
                  }}
                >
                  <span className="font-bold text-xs font-mono" style={{ color: isLit ? room.color : "var(--ink-soft)" }}>
                    0{i + 1}
                  </span>
                  {badgeUnlocked && (
                    <div className="absolute -top-1 -right-1 text-amber-400">
                      <Sparkles size={12} fill="#facc15" />
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-bold font-[family-name:var(--serif)] text-[var(--ink)] leading-tight mb-1 truncate w-full">
                  {room.name}
                </span>

                <TwinkleStarRow count={3} filled={stars} size={11} />
              </motion.button>
            );
          })}
        </div>

        {/* Certificate Banner Footer */}
        <div className="w-full flex items-center justify-between pt-2 border-t border-[var(--line)] text-xs text-[var(--ink-soft)] relative z-10">
          <span className="flex items-center gap-1.5 font-medium">
            <Award size={15} className="text-amber-400" />
            <span>Sertifikat Akhir Terbuka:</span>
          </span>
          <span className="font-bold font-mono text-[var(--accent)]">
            {PALACE_ROOMS.filter((r) => getBadgeUnlocked(r.id)).length} / 6 Lencana
          </span>
        </div>
      </div>
    </div>
  );
}

export function PalaceMapModal({
  chapters = [],
  chapterStart = new Map<number, number>(),
  onJump,
  onClose,
}: {
  chapters?: Chapter[];
  chapterStart?: Map<number, number>;
  onJump?: (pageIndex: number) => void;
  onClose?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--paper)] text-[var(--ink)] rounded-3xl p-6 relative border border-[var(--line)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--ink-soft)] hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Tutup Peta"
        >
          <X size={20} />
        </button>

        <PalaceMap chapters={chapters} chapterStart={chapterStart} onJump={onJump} />
      </div>
    </div>
  );
}
