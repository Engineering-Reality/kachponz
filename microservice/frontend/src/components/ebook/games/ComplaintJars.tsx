"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Sparkles, Plus, Archive } from "lucide-react";
import { useEbook } from "../state";

export const DAYS_OF_WEEK = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export function ComplaintJars({
  id = "complaint-jars",
  title = "Jurnal Keluhan: 7 Toples Masalah",
}: {
  id?: string;
  title?: string;
}) {
  const { get, set, profile, openEditor } = useEbook();
  const [activeDay, setActiveDay] = useState(0);

  // Array of complaints per day
  const rawData = (get(id) as Record<string, string>) || {};
  const currentText = rawData[DAYS_OF_WEEK[activeDay]] || "";

  // Count words / intensity for each jar
  const jarCounts = DAYS_OF_WEEK.map((day) => (rawData[day] ? rawData[day].trim().split(/\s+/).filter(Boolean).length : 0));
  const maxCount = Math.max(...jarCounts);
  const fullestDayIndex = maxCount > 0 ? jarCounts.indexOf(maxCount) : -1;

  const handleSaveText = (text: string) => {
    set(id, { ...rawData, [DAYS_OF_WEEK[activeDay]]: text });
  };

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Archive size={18} className="text-amber-500" />
          <span className="text-xs uppercase font-bold tracking-wider text-[var(--accent)] font-mono">
            Koleksi Toples
          </span>
        </div>
        <span className="text-xs font-bold text-[var(--ink-soft)] font-mono">
          7 Hari Eksplorasi
        </span>
      </div>

      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">
        {title}
      </h3>

      {/* 7 Glass Jars Row */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {DAYS_OF_WEEK.map((day, idx) => {
          const isSelected = activeDay === idx;
          const count = jarCounts[idx];
          const isFullest = fullestDayIndex === idx && count > 0;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(idx)}
              className="squish-btn flex flex-col items-center p-1.5 rounded-xl border transition-all text-center relative"
              style={{
                background: isSelected ? "var(--accent-soft)" : "var(--paper)",
                borderColor: isSelected ? "var(--blue)" : isFullest ? "#facc15" : "var(--line)",
                boxShadow: isFullest ? "0 0 10px rgba(250, 204, 21, 0.4)" : "none",
              }}
            >
              {/* Mini Jar SVG with origami paper fill inside */}
              <div className="w-7 h-9 rounded-b-lg border-2 border-current flex items-end justify-center overflow-hidden p-0.5 relative text-[var(--ink-soft)]">
                <div
                  className="w-full bg-amber-400 rounded-sm transition-all duration-300"
                  style={{ height: `${Math.min(100, count * 20)}%` }}
                />
                {isFullest && (
                  <div className="absolute -top-1 right-0 text-amber-500">
                    <Sparkles size={8} fill="#facc15" />
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold mt-1 text-[var(--ink)] truncate w-full">
                {day.slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day's Input Editor */}
      <div className="bg-[var(--paper)] border border-[var(--line)] p-3 rounded-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold font-[family-name:var(--serif)] text-[var(--ink)] flex items-center gap-1.5">
            <FileText size={14} className="text-amber-500" />
            <span>Kertas Lipat: {DAYS_OF_WEEK[activeDay]}</span>
          </span>
          <span className="text-[10px] text-[var(--ink-soft)] font-mono">
            {jarCounts[activeDay]} kata
          </span>
        </div>

        {profile === "mobile" ? (
          <button
            type="button"
            onClick={() => openEditor({ id: `${id}.${DAYS_OF_WEEK[activeDay]}`, label: `Keluhan Hari ${DAYS_OF_WEEK[activeDay]}` })}
            className="w-full min-h-[60px] text-left text-xs p-2 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)]"
          >
            {currentText || <span className="text-[var(--ink-soft)] italic">Ketuk untuk memasukkan catatan keluhan…</span>}
          </button>
        ) : (
          <textarea
            rows={3}
            value={currentText}
            onChange={(e) => handleSaveText(e.target.value)}
            placeholder="Apa hal yang bikin kamu kesal atau terganjal hari ini? Tulis tanpa filter…"
            className="w-full text-xs p-2.5 rounded-xl border border-[var(--line)] bg-[var(--sheet)] text-[var(--ink)] outline-none resize-none"
          />
        )}
      </div>
    </div>
  );
}
