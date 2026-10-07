"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * Scroll-linked parallax. `speed` is how far the child travels relative to
 * the scroll, as a fraction of its own height range: negative drifts up
 * faster than the page, positive lags behind. Sprung so it feels physical.
 */
export function Parallax({
  children,
  speed = -0.15,
  className = "",
  rotate = 0,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  /** Optional degrees of rotation across the scroll range. */
  rotate?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const raw = useTransform(scrollYProgress, [0, 1], [`${-speed * 100}%`, `${speed * 100}%`]);
  const y = useSpring(raw as never, { stiffness: 120, damping: 24, mass: 0.6 });
  const r = useTransform(scrollYProgress, [0, 1], [-rotate, rotate]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y, rotate: r }}>
      {children}
    </motion.div>
  );
}

/**
 * Scroll-scrubbed reveal: the child slides and un-clips as its section
 * enters, and the progress is tied to scroll position (scrubbing back
 * reverses it) rather than firing once.
 */
export function ScrubReveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 95%", "start 45%"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });
  const y = useTransform(p, [0, 1], [70, 0]);
  const opacity = useTransform(p, [0, 1], [0, 1]);
  const clip = useTransform(p, [0, 1], ["inset(18% 0% 0% 0% round 28px)", "inset(0% 0% 0% 0% round 28px)"]);
  const scale = useTransform(p, [0, 1], [0.94, 1]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : { y, opacity, clipPath: clip, scale }}>
      {children}
    </motion.div>
  );
}

/**
 * Pointer-tilt surface. Leans toward the cursor in 3D and moves a foil
 * highlight with it. Pure CSS variables — no React state per move.
 */
export function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-ny * max).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(nx * max).toFixed(2)}deg`);
    el.style.setProperty("--sx", `${((nx + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--sy", `${((ny + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`tilt holo-sheen ${className}`}>
      {children}
    </div>
  );
}

/**
 * Brutalist ticker band. Scroll velocity speeds it up (via CSS var set by
 * HoloRuntime's --holo-angle drift); content is duplicated for a seamless loop.
 */
export function Marquee({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const row = items.join("  +++  ") + "  +++  ";
  return (
    <div className="marquee" aria-hidden="true">
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`}>
        <span>{row}</span>
        <span>{row}</span>
      </div>
    </div>
  );
}
