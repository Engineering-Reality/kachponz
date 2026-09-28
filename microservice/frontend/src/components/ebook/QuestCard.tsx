"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X, ArrowRight, Sparkles } from "lucide-react";
import { BunnyBuddy, type BunnyMood } from "./BunnyBuddy";
import { TwinkleStarRow } from "./ornaments/StarOrnaments";
import { SketchBorder } from "./SketchBorder";

export interface QuestOption {
  id: string;
  label: string;
  correct?: boolean;
}

export interface QuestCardProps {
  id: string;
  questionIndex: number;
  totalQuestions: number;
  prompt: string;
  options: QuestOption[];
  explanation?: string;
  variant?: "knowledge" | "type" | "scale";
  selectedId?: string;
  onSelect?: (optionId: string) => void;
  onNext?: () => void;
  hasNext?: boolean;
}

export function QuestCard({
  questionIndex = 0,
  totalQuestions = 3,
  prompt,
  options = [],
  explanation,
  variant = "knowledge",
  selectedId: controlledSelected,
  onSelect,
  onNext,
  hasNext = true,
}: QuestCardProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const reduced = useReducedMotion();

  const selectedId = controlledSelected !== undefined ? controlledSelected : internalSelected;
  const selectedOption = options.find((o) => o.id === selectedId);
  const isKnowledge = variant === "knowledge";
  const isCorrect = isKnowledge && selectedOption?.correct === true;

  let bunnyMood: BunnyMood = "idle";
  if (selectedId) {
    if (isKnowledge) bunnyMood = isCorrect ? "correct" : "wrong";
    else bunnyMood = "waiting";
  }

  const handlePick = (e: React.MouseEvent, opt: QuestOption) => {
    setInternalSelected(opt.id);
    onSelect?.(opt.id);

    if (isKnowledge) {
      if (opt.correct && !reduced) {
        const rect = e.currentTarget.getBoundingClientRect();
        const newSparkles = Array.from({ length: 8 }).map((_, i) => ({
          id: Date.now() + i,
          x: (Math.random() - 0.5) * 60,
          y: (Math.random() - 0.5) * 40 - 20,
        }));
        setSparkles(newSparkles);
        setTimeout(() => setSparkles([]), 600);
      }
      if (explanation) {
        setFlipped(true);
      }
    }
  };

  const optionLetters = ["A", "B", "C", "D", "E"];

  return (
    <div className="relative w-full flex flex-col items-center justify-between h-full py-2">
      <SketchBorder
        hasRainbowShimmer={isCorrect}
        className="w-full bg-[var(--sheet)] shadow-md transition-all duration-300"
        padding="p-5"
      >
        {/* Header: Star progress & question tag */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider uppercase text-[var(--num)] bg-[var(--accent-soft)] px-2.5 py-1 rounded-full">
              Tantangan {questionIndex + 1}/{totalQuestions}
            </span>
          </div>
          <TwinkleStarRow count={totalQuestions} filled={questionIndex + (selectedId ? 1 : 0)} size={18} />
        </div>

        {/* Question Prompt */}
        <h3 className="text-xl font-bold font-[family-name:var(--serif)] text-[var(--ink)] leading-snug mb-5">
          {prompt}
        </h3>

        {/* Options List */}
        <div className="grid gap-3 mb-4">
          {options.map((opt, i) => {
            const isSel = selectedId === opt.id;
            let btnStyle = "bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--blue)]";
            let badgeStyle = "bg-[var(--accent-soft)] text-[var(--accent)]";

            if (isSel) {
              if (isKnowledge) {
                if (opt.correct) {
                  btnStyle = "bg-[var(--ok-soft)] border-[var(--ok)] text-[var(--ink)] shadow-md";
                  badgeStyle = "bg-[var(--ok)] text-white";
                } else {
                  btnStyle = "bg-[var(--red-soft)] border-[var(--red)] text-[var(--ink)] shadow-md";
                  badgeStyle = "bg-[var(--red)] text-white";
                }
              } else {
                btnStyle = "bg-[var(--blue-soft)] border-[var(--blue)] text-[var(--ink)] shadow-md";
                badgeStyle = "bg-[var(--blue)] text-white";
              }
            }

            return (
              <motion.button
                key={opt.id}
                type="button"
                onClick={(e) => handlePick(e, opt)}
                whileTap={reduced ? {} : { scale: 0.97 }}
                animate={isSel && isKnowledge && !opt.correct && !reduced ? { x: [-3, 3, -3, 3, 0] } : {}}
                transition={{ duration: 0.3 }}
                className={`squish-btn relative w-full text-left p-3.5 border-2 rounded-2xl flex items-center gap-3 transition-colors ${btnStyle}`}
              >
                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 transition-colors ${badgeStyle}`}>
                  {isSel && isKnowledge ? (
                    opt.correct ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />
                  ) : (
                    optionLetters[i] || i + 1
                  )}
                </span>
                <span className="flex-1 font-medium text-sm leading-relaxed">{opt.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Golden Sparkle Burst Effect */}
        <AnimatePresence>
          {sparkles.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
              animate={{ opacity: 0, scale: 1.4, x: s.x, y: s.y }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute pointer-events-none text-yellow-400 z-50 left-1/2 top-1/2"
            >
              <Sparkles size={18} fill="#facc15" />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Explanation / Bunny Feedback Box */}
        <AnimatePresence>
          {selectedId && explanation && (
            <motion.div
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 pt-3 border-t border-[var(--line)] flex items-start gap-3 bg-[var(--accent-soft)] p-3 rounded-2xl"
            >
              <BunnyBuddy mood={bunnyMood} size={48} className="flex-shrink-0" />
              <div className="flex-1 text-xs">
                <span className="font-bold block text-[var(--accent)] font-[family-name:var(--serif)] mb-1">
                  {isKnowledge ? (isCorrect ? "Nah, tepat sekali!" : "Hampir tepat! Yuk renungkan:") : "Catatan Kelinci:"}
                </span>
                <p className="text-[var(--ink)] leading-relaxed">{explanation}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SketchBorder>

      {/* Action Footer */}
      {selectedId && hasNext && (
        <div className="w-full flex justify-end mt-3">
          <button
            type="button"
            onClick={onNext}
            className="squish-btn bg-[var(--blue)] text-white hover:bg-blue-600 shadow-md px-5 py-2.5 text-sm"
          >
            <span>Yuk Lanjut</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
