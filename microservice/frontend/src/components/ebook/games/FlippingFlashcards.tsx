"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, RefreshCw } from "lucide-react";
import { useEbook } from "../state";

export interface FlashcardItem {
  id: string;
  front: string;
  promptGuide: string;
}

export function FlippingFlashcards({
  id = "empathy-map",
  title = "Peta Empati: Kartu Pembalik Perspektif",
  cards = [
    { id: "say", front: "Apa yang Pengguna Katakan?", promptGuide: "Kutipan langsung atau kata-kata yang sering diulang pengguna saat mengeluh." },
    { id: "think", front: "Apa yang Pengguna Pikirkan?", promptGuide: "Kekhawatiran atau harapan tersirat yang mungkin tidak mereka ucapkan blak-blakan." },
    { id: "do", front: "Apa yang Pengguna Lakukan?", promptGuide: "Tindakan nyata, workarounds, atau kebiasaan darurat yang mereka ambil." },
    { id: "feel", front: "Apa yang Pengguna Rasakan?", promptGuide: "Emosi utama: frustrasi, cemas, bingung, atau justru bersemangat?" },
  ],
}: {
  id?: string;
  title?: string;
  cards?: FlashcardItem[];
}) {
  const { get, set, profile, openEditor } = useEbook();
  const [activeCard, setActiveCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cur = cards[activeCard];
  const val = String(get(`${id}.${cur.id}`) ?? "");

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-amber-500" />
          <span className="text-xs uppercase font-bold tracking-wider text-[var(--accent)] font-mono">
            Kartu Panduan {activeCard + 1}/{cards.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setFlipped(!flipped)}
          className="squish-btn p-1 px-2.5 rounded-xl text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] flex items-center gap-1"
        >
          <RefreshCw size={12} />
          <span>{flipped ? "Lihat Depan" : "Balik Panduan"}</span>
        </button>
      </div>

      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">
        {title}
      </h3>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setActiveCard(idx);
              setFlipped(false);
            }}
            className={`squish-btn py-1 px-2.5 rounded-xl text-xs font-bold transition-all ${activeCard === idx ? "bg-[var(--blue)] text-white" : "bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--line)]"}`}
          >
            {c.id.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Flip Card Container */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-3.5 rounded-2xl min-h-[110px] flex flex-col justify-between mb-2">
        {flipped ? (
          <div className="text-xs text-[var(--ink)]">
            <span className="font-bold text-[var(--accent)] block mb-1">Pertanyaan Pemandu:</span>
            <p className="leading-relaxed text-[var(--ink-soft)] italic">{cur.promptGuide}</p>
          </div>
        ) : (
          <div className="w-full">
            <span className="font-bold text-xs text-[var(--ink)] block mb-2 font-[family-name:var(--serif)]">
              {cur.front}
            </span>
            {profile === "mobile" ? (
              <button
                type="button"
                onClick={() => openEditor({ id: `${id}.${cur.id}`, label: cur.front })}
                className="w-full text-left text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] truncate"
              >
                {val || <span className="text-[var(--ink-soft)] italic">Tulis catatan kartu…</span>}
              </button>
            ) : (
              <textarea
                rows={2}
                value={val}
                onChange={(e) => set(`${id}.${cur.id}`, e.target.value)}
                placeholder="Tulis observasimu di sini…"
                className="w-full text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] outline-none resize-none"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
