"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Boxes, Sparkles, Plus, ArrowRight, Check } from "lucide-react";
import { useEbook } from "../state";

export interface IdeaSticker {
  id: string;
  text: string;
  category?: "now" | "how" | "wow";
}

export function CocdStickers({
  id = "cocd-stickers",
  title = "COCD Box: Menata Stiker Ide",
}: {
  id?: string;
  title?: string;
}) {
  const { get, set } = useEbook();
  const [newIdea, setNewIdea] = useState("");

  const ideas = (get(id) as IdeaSticker[]) || [
    { id: "1", text: "Otomatisasi pengingat via bot", category: "now" },
    { id: "2", text: "Bangun AI tutor lokal", category: "how" },
    { id: "3", text: "Game retro berbasis suara", category: "wow" },
  ];

  const handleAdd = () => {
    if (!newIdea.trim()) return;
    const item: IdeaSticker = { id: `${Date.now()}`, text: newIdea.trim(), category: "now" };
    set(id, [...ideas, item]);
    setNewIdea("");
  };

  const handleMove = (ideaId: string, toCategory: "now" | "how" | "wow") => {
    const updated = ideas.map((item) => (item.id === ideaId ? { ...item, category: toCategory } : item));
    set(id, updated);
  };

  const categories = [
    { key: "now" as const, title: "Now", desc: "Mudah & Berdampak", color: "#3b82f6", bg: "var(--blue-soft)" },
    { key: "how" as const, title: "How", desc: "Sulit tapi Terobosan", color: "#8b5cf6", bg: "var(--accent-soft)" },
    { key: "wow" as const, title: "Wow", desc: "Ide Liar & Ajaib", color: "#facc15", bg: "var(--gold-soft)", isGlow: true },
  ];

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Boxes size={18} className="text-amber-500" />
          <span className="text-xs uppercase font-bold tracking-wider text-[var(--accent)] font-mono">
            Matriks Ide
          </span>
        </div>
        <span className="text-xs font-bold text-[var(--ink-soft)] font-mono">
          {ideas.length} Stiker
        </span>
      </div>

      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">
        {title}
      </h3>

      {/* Input New Sticker */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newIdea}
          onChange={(e) => setNewIdea(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Tulis ide baru di sini…"
          className="field flex-1 text-xs py-1.5 px-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="squish-btn bg-[var(--blue)] text-white p-2 rounded-xl text-xs font-bold"
          aria-label="Tambah Ide"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* 3 Target Boxes: Now, How, Wow */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {categories.map((cat) => {
          const catIdeas = ideas.filter((item) => item.category === cat.key);
          const hasWowItems = cat.key === "wow" && catIdeas.length > 0;

          return (
            <div
              key={cat.key}
              className="p-2.5 rounded-2xl border flex flex-col justify-between min-h-[140px] relative transition-all"
              style={{
                borderColor: cat.color,
                background: cat.bg,
                boxShadow: hasWowItems ? "0 0 16px rgba(250, 204, 21, 0.4)" : "none",
                overflow: "hidden",
              }}
            >
              {/* Aurora rainbow beranimasi di belakang isi box ideation */}
              <motion.div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(120deg, #ff6b6b, #feca57, #1dd1a1, #48dbfb, #a55eea, #ff6b6b)",
                  backgroundSize: "300% 300%",
                  mixBlendMode: "overlay",
                  opacity: 0.35,
                }}
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative z-10 flex items-center justify-between mb-1.5">
                <span className="font-extrabold text-xs font-[family-name:var(--serif)] text-[var(--ink)] flex items-center gap-1">
                  {cat.isGlow && <Sparkles size={12} className="text-amber-500 animate-pulse" />}
                  <span>{cat.title}</span>
                </span>
                <span className="text-[10px] font-bold font-mono text-[var(--ink-soft)]">
                  {catIdeas.length}
                </span>
              </div>
              <p className="relative z-10 text-[9px] text-[var(--ink-soft)] mb-2 leading-tight">{cat.desc}</p>

              {/* Stickers inside box */}
              <div className="relative z-10 flex-1 space-y-1.5 overflow-y-auto max-h-[90px]">
                {catIdeas.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[var(--sheet)] border border-[var(--line)] p-1.5 rounded-xl text-[10px] font-medium text-[var(--ink)] shadow-sm flex items-center justify-between gap-1"
                  >
                    <span className="truncate flex-1">{item.text}</span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {cat.key !== "now" && (
                        <button
                          type="button"
                          onClick={() => handleMove(item.id, "now")}
                          title="Pindah ke Now"
                          className="p-0.5 hover:bg-black/10 rounded text-[9px] font-bold"
                        >
                          N
                        </button>
                      )}
                      {cat.key !== "how" && (
                        <button
                          type="button"
                          onClick={() => handleMove(item.id, "how")}
                          title="Pindah ke How"
                          className="p-0.5 hover:bg-black/10 rounded text-[9px] font-bold"
                        >
                          H
                        </button>
                      )}
                      {cat.key !== "wow" && (
                        <button
                          type="button"
                          onClick={() => handleMove(item.id, "wow")}
                          title="Pindah ke Wow"
                          className="p-0.5 hover:bg-black/10 rounded text-[9px] font-bold text-amber-500"
                        >
                          W
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
