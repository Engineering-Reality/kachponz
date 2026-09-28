"use client";

import React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

export type BunnyMood = "idle" | "waiting" | "correct" | "wrong";

export function BunnyBuddy({
  mood = "idle",
  size = 64,
  className = "",
}: {
  mood?: BunnyMood;
  size?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  // Animation variants per mood
  const headVariants: Variants = {
    idle: { rotate: [0, 1.5, 0, -1.5, 0], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } },
    waiting: { rotate: -8, y: 2, transition: { duration: 0.3 } },
    correct: { y: [-2, -8, 0], rotate: [0, -3, 3, 0], transition: { duration: 0.5, repeat: 2 } },
    wrong: { y: [0, 3, 0, 3, 0], rotate: 0, transition: { duration: 0.8 } },
  };

  const earLeftVariants: Variants = {
    idle: { rotate: [0, 2, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
    waiting: { rotate: -12, transition: { duration: 0.3 } },
    correct: { rotate: -5, y: -2, transition: { duration: 0.3 } },
    wrong: { rotate: 8, transition: { duration: 0.4 } },
  };

  const earRightVariants: Variants = {
    idle: { rotate: [0, -2, 0], transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 } },
    waiting: { rotate: 6, transition: { duration: 0.3 } },
    correct: { rotate: 5, y: -2, transition: { duration: 0.3 } },
    wrong: { rotate: -8, transition: { duration: 0.4 } },
  };

  const eyeVariants: Variants = {
    idle: { scaleY: [1, 1, 0.1, 1, 1], transition: { duration: 3.2, repeat: Infinity, times: [0, 0.9, 0.95, 0.98, 1] } },
    waiting: { scaleY: 1 },
    correct: { scaleY: 1 },
    wrong: { scaleY: 0.8 },
  };

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      aria-label="Maskot Kelinci"
    >
      <motion.svg
        viewBox="0 0 100 100"
        fill="none"
        className="w-full h-full"
        initial={false}
      >
        {/* Shadow */}
        <ellipse cx="50" cy="90" rx="26" ry="6" fill="currentColor" className="opacity-10" />

        {/* Body */}
        <motion.path
          d="M 32,56 C 32,48 68,48 68,56 C 72,66 74,84 66,86 C 58,88 42,88 34,86 C 26,84 28,66 32,56 Z"
          fill="var(--sheet)"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Head & Face Container */}
        <motion.g
          style={{ originX: "50px", originY: "50px" }}
          variants={reduced ? {} : headVariants}
          animate={mood}
        >
          {/* Left Ear */}
          <motion.path
            d="M 40,32 C 36,12 28,10 32,4 C 36,-2 46,12 44,32"
            fill="var(--sheet)"
            stroke="var(--ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ originX: "42px", originY: "32px" }}
            variants={reduced ? {} : earLeftVariants}
            animate={mood}
          />
          {/* Left Ear Inner Pink */}
          <path d="M 38,26 C 35,14 31,12 33,8 C 35,5 41,14 41,26" fill="rgba(217, 70, 239, 0.2)" />

          {/* Right Ear */}
          <motion.path
            d="M 60,32 C 64,12 72,10 68,4 C 64,-2 54,12 56,32"
            fill="var(--sheet)"
            stroke="var(--ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ originX: "58px", originY: "32px" }}
            variants={reduced ? {} : earRightVariants}
            animate={mood}
          />
          {/* Right Ear Inner Pink */}
          <path d="M 62,26 C 65,14 69,12 67,8 C 65,5 59,14 59,26" fill="rgba(217, 70, 239, 0.2)" />

          {/* Head Base */}
          <circle
            cx="50"
            cy="46"
            r="20"
            fill="var(--sheet)"
            stroke="var(--ink)"
            strokeWidth="2.5"
          />

          {/* Cheeks */}
          <circle cx="37" cy="51" r="3" fill="#f472b6" opacity="0.3" />
          <circle cx="63" cy="51" r="3" fill="#f472b6" opacity="0.3" />

          {/* Eyes */}
          <motion.ellipse
            cx="42"
            cy="45"
            rx="2.2"
            ry="3.2"
            fill="var(--ink)"
            style={{ originX: "42px", originY: "45px" }}
            variants={reduced ? {} : eyeVariants}
            animate={mood}
          />
          <motion.ellipse
            cx="58"
            cy="45"
            rx="2.2"
            ry="3.2"
            fill="var(--ink)"
            style={{ originX: "58px", originY: "45px" }}
            variants={reduced ? {} : eyeVariants}
            animate={mood}
          />

          {/* Cute Nose & Mouth */}
          <path
            d="M 49,49 L 51,49 L 50,51 Z"
            fill="var(--ink)"
          />
          {mood === "wrong" ? (
            <path
              d="M 46,55 Q 50,52 54,55"
              stroke="var(--ink)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M 45,53 Q 50,57 55,53"
              stroke="var(--ink)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </motion.g>

        {/* Paws */}
        <ellipse cx="40" cy="68" rx="4" ry="3" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" />
        <ellipse cx="60" cy="68" rx="4" ry="3" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" />
      </motion.svg>
    </div>
  );
}
