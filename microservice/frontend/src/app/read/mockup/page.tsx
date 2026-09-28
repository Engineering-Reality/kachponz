"use client";

import React, { useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Sparkles, BookOpen, Layers, Smartphone, Monitor } from "lucide-react";
import { SketchBorder } from "@/components/ebook/SketchBorder";
import { QuestCard } from "@/components/ebook/QuestCard";
import { CharacterCard } from "@/components/ebook/CharacterCard";
import { BunnyBuddy } from "@/components/ebook/BunnyBuddy";
import { RibbonDivider } from "@/components/ebook/ornaments/RibbonWave";
import { SparkleStar, TwinkleStarRow, FloatingCloud } from "@/components/ebook/ornaments/StarOrnaments";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function MockupShowcasePage() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"opener" | "quest" | "character">("opener");
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-[#0B0A1F] text-white" : "bg-[#f4efe6] text-zinc-900"} p-4 md:p-8 relative overflow-hidden`}>
      {/* Background Aurora for Dark Mode */}
      {isDark && <AuroraBackground />}

      {/* Floating Ornaments in Background */}
      <div className="absolute top-12 left-10 text-yellow-400 opacity-60 animate-pulse pointer-events-none">
        <SparkleStar size={24} />
      </div>
      <div className="absolute top-24 right-16 text-cyan-400 opacity-50 pointer-events-none">
        <SparkleStar size={20} />
      </div>
      <div className="absolute bottom-16 left-20 text-fuchsia-400 opacity-40 pointer-events-none">
        <FloatingCloud size={40} />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header Controls */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs uppercase font-bold tracking-widest text-amber-500">Pratinjau Arah Visual</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-fraunces)] mt-1">
              Buku Cerita Ajaib: My Mind Palace
            </h1>
            <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400">
              Tema: <strong className="text-amber-500">{isDark ? "Langit Malam (Indigo + Aurora)" : "Kertas Pagi (Krem + Tinta Biru)"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-black/5 dark:bg-white/10 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode("desktop")}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${viewMode === "desktop" ? "bg-white dark:bg-zinc-800 shadow" : "opacity-70"}`}
              >
                <Monitor size={15} />
                <span>Desktop (Spread)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mobile")}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${viewMode === "mobile" ? "bg-white dark:bg-zinc-800 shadow" : "opacity-70"}`}
              >
                <Smartphone size={15} />
                <span>Mobile (380px)</span>
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center gap-2 text-xs font-bold"
            >
              {isDark ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} className="text-indigo-600" />}
              <span>{isDark ? "Ganti ke Kertas Pagi" : "Ganti ke Langit Malam"}</span>
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("opener")}
            className={`px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === "opener" ? "bg-blue-600 text-white shadow-lg scale-105" : "bg-black/5 dark:bg-white/10 opacity-80"}`}
          >
            <BookOpen size={16} />
            <span>1. Pembuka Bab</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("quest")}
            className={`px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === "quest" ? "bg-blue-600 text-white shadow-lg scale-105" : "bg-black/5 dark:bg-white/10 opacity-80"}`}
          >
            <Sparkles size={16} />
            <span>2. QuestCard Interaktif</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("character")}
            className={`px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === "character" ? "bg-blue-600 text-white shadow-lg scale-105" : "bg-black/5 dark:bg-white/10 opacity-80"}`}
          >
            <Layers size={16} />
            <span>3. Kartu Karakter Hasil</span>
          </button>
        </div>

        {/* Reader Preview Canvas Container */}
        <div className="flex justify-center items-center py-4">
          <div
            className={`ebook ${isDark ? "dark" : ""} transition-all duration-300`}
            style={{
              width: viewMode === "desktop" ? 560 : 380,
              minHeight: viewMode === "desktop" ? 720 : 640,
            }}
          >
            <div className="page w-full h-full p-6 md:p-8 flex flex-col justify-between">
              {/* Top Page Header */}
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2 mb-4 text-xs font-bold text-[var(--ink-soft)]">
                <span className="flex items-center gap-1.5 font-[family-name:var(--serif)]">
                  <SparkleStar size={14} className="text-amber-400" />
                  <span>My Mind Palace</span>
                </span>
                <span className="uppercase tracking-widest text-[10px] text-[var(--num)] font-mono">Bab 01 · Ruang Paradoks</span>
              </div>

              {/* Tab 1: Pembuka Bab */}
              {activeTab === "opener" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
                  <div className="relative mb-4">
                    <SketchBorder hasRainbowShimmer padding="p-2" rounded="rounded-3xl" className="shadow-lg">
                      <div className="w-48 h-48 md:w-56 md:h-56 rounded-2xl bg-[var(--accent-soft)] flex flex-col items-center justify-center relative overflow-hidden border border-[var(--line)]">
                        <BunnyBuddy mood="idle" size={110} />
                        <span className="absolute bottom-2 text-[10px] font-bold text-[var(--ink-soft)] tracking-wider">RUANGAN I</span>
                      </div>
                    </SketchBorder>
                  </div>

                  <div className="text-3xl font-extrabold text-[var(--num)] font-[family-name:var(--serif)] mb-1">
                    01
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold font-[family-name:var(--serif)] text-[var(--ink)] leading-tight mb-2">
                    Paradoks Ilmu Pengetahuan
                  </h2>
                  <p className="text-sm text-[var(--ink-soft)] max-w-xs leading-relaxed mb-4">
                    Kenapa makin banyak rumus yang kita hafal, makin canggung kita menghadapi masalah nyata di luar kelas?
                  </p>

                  <RibbonDivider />

                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--ink-soft)]">Misi Ruangan:</span>
                    <TwinkleStarRow count={3} filled={0} size={16} />
                  </div>
                </div>
              )}

              {/* Tab 2: QuestCard */}
              {activeTab === "quest" && (
                <div className="flex-1 flex flex-col justify-center">
                  <QuestCard
                    id="q1"
                    questionIndex={0}
                    totalQuestions={3}
                    prompt="Ketika menemui bug aneh yang belum pernah kamu lihat sebelumnya, langkah pertama apa yang paling jujur?"
                    options={[
                      { id: "a", label: "Langsung ganti-ganti baris kode secara acak sampai jalan." },
                      { id: "b", label: "Tarik napas, tulis asumsi yang kita percaya, lalu uji asumsi itu satu per satu.", correct: true },
                      { id: "c", label: "Tutup laptop dan pura-pura tidak melihat bug-nya." },
                    ]}
                    explanation="Developer hebat bukan orang yang tidak pernah bingung, melainkan orang yang tahu cara mengurai kebingungan menjadi hipotesis kecil yang bisa diuji."
                    variant="knowledge"
                  />
                </div>
              )}

              {/* Tab 3: Character Card */}
              {activeTab === "character" && (
                <div className="flex-1 flex flex-col justify-center py-2">
                  <CharacterCard />
                </div>
              )}

              {/* Bottom Page Footer */}
              <div className="mt-4 pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs text-[var(--ink-soft)]">
                <span className="font-[family-name:var(--hand)] text-base text-[var(--ink-soft)]">
                  ~ Istana Pikiran Nara
                </span>
                <span className="font-bold text-[var(--num)]">Hal 12</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
