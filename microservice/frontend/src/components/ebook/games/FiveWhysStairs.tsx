"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Footprints, Sparkles, Sprout } from "lucide-react";
import { useEbook } from "../state";
import { BunnyBuddy } from "../BunnyBuddy";

export function FiveWhysStairs({
  id = "five-whys",
  title = "5 Whys: Menuruni Tangga ke Akar Masalah",
}: {
  id?: string;
  title?: string;
}) {
  const { get, set, profile, openEditor } = useEbook();
  const reduced = useReducedMotion();

  const answers = Array.from({ length: 5 }).map((_, i) => String(get(`${id}.why_${i + 1}`) ?? ""));
  const filledCount = answers.filter((a) => a.trim().length > 0).length;
  const isRootReached = filledCount === 5;

  const handleStepChange = (index: number, val: string) => {
    set(`${id}.why_${index + 1}`, val);
  };

  return (
    <div className="story-card w-full p-4 md:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Footprints size={18} className="text-amber-500" />
          <span className="text-xs uppercase font-bold tracking-wider text-[var(--accent)] font-mono">
            Eksplorasi Tangga
          </span>
        </div>
        <span className="text-xs font-bold text-[var(--ink-soft)] font-mono">
          Anak Tangga {filledCount}/5
        </span>
      </div>

      <h3 className="text-base font-bold font-[family-name:var(--serif)] text-[var(--ink)] mb-3">
        {title}
      </h3>

      {/* 5 Steps Staircase Visual Container */}
      <div className="space-y-2 relative">
        {answers.map((val, idx) => {
          const isCurrentStep = filledCount === idx;
          const isFilled = val.trim().length > 0;

          return (
            <div
              key={idx}
              className="flex items-center gap-2 transition-transform duration-200"
              style={{ marginLeft: `${idx * 12}px` }}
            >
              {/* Step number badge / Bunny indicator */}
              <div className="relative flex-shrink-0">
                {isCurrentStep ? (
                  <div className="absolute -top-6 -left-2 z-20">
                    <BunnyBuddy mood="waiting" size={36} />
                  </div>
                ) : null}
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors"
                  style={{
                    background: isFilled ? "var(--accent)" : "var(--line)",
                    color: isFilled ? "#ffffff" : "var(--ink-soft)",
                  }}
                >
                  {idx + 1}
                </span>
              </div>

              {/* Input for why */}
              {profile === "mobile" ? (
                <button
                  type="button"
                  onClick={() => openEditor({ id: `${id}.why_${idx + 1}`, label: `Kenapa? (Langkah ${idx + 1})` })}
                  className="field flex-1 text-left text-xs p-2 truncate rounded-xl border border-[var(--line)]"
                >
                  {val || <span className="text-[var(--ink-soft)] italic">Kenapa hal ini terjadi?</span>}
                </button>
              ) : (
                <input
                  type="text"
                  value={val}
                  onChange={(e) => handleStepChange(idx, e.target.value)}
                  placeholder={`Kenapa langkah ke-${idx + 1}?`}
                  className="field flex-1 text-xs py-1.5 px-2.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Glowing Tree Roots at the Bottom */}
      <motion.div
        animate={isRootReached && !reduced ? { scale: [1, 1.03, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between p-2.5 rounded-2xl transition-colors"
        style={{
          background: isRootReached ? "var(--ok-soft)" : "var(--accent-soft)",
          borderColor: isRootReached ? "var(--ok)" : "var(--line)",
        }}
      >
        <div className="flex items-center gap-2">
          <Sprout size={18} className={isRootReached ? "text-green-500" : "text-amber-500"} />
          <span className="text-xs font-bold font-[family-name:var(--serif)] text-[var(--ink)]">
            {isRootReached ? "Akar Masalah Ditemukan!" : "Terus gali sampai akar terdalam"}
          </span>
        </div>
        {isRootReached && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-bold">
            <Sparkles size={14} />
            <span>Selesai</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
