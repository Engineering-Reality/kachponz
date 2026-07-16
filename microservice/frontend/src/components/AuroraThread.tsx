"use client";

import { useEffect, useRef, useState } from "react";

const STOPS = ["#22D3EE", "#D946EF", "#FDE047"];

/**
 * The Aurora Thread — the site's one signature motif, reused in three forms:
 *  - "mesh": blurred ambient blob glow, for hero/section backgrounds
 *  - "divider": a thin glowing line between sections that draws on as it scrolls into view
 * Both derive from the same 3-stop Cyan-Fuchsia-Yellow spectrum so they read as one system.
 */
export function AuroraThread({
  variant,
  size = "lg",
  className = "",
  position,
}: {
  variant: "mesh" | "divider";
  size?: "sm" | "lg";
  className?: string;
  /** Divider only — how the wrapper itself is positioned. Defaults to "relative". */
  position?: "relative" | "absolute";
}) {
  if (variant === "mesh") return <AuroraMesh size={size} className={className} />;
  return <AuroraDivider className={className} position={position ?? "relative"} />;
}

function AuroraMesh({ size, className }: { size: "sm" | "lg"; className: string }) {
  const dims = size === "lg"
    ? ["w-[600px] h-[600px]", "w-[750px] h-[750px]", "w-[900px] h-[900px]"]
    : ["w-[240px] h-[240px]", "w-[320px] h-[320px]", "w-[380px] h-[380px]"];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <div
        className={`aurora-blob ${dims[0]} top-[-10%] left-[8%] opacity-[0.18] dark:opacity-[0.3]`}
        style={{ background: STOPS[0] }}
      />
      <div
        className={`aurora-blob ${dims[1]} top-[15%] right-[5%] opacity-[0.15] dark:opacity-[0.28]`}
        style={{ background: STOPS[1], animationDelay: "-20s" }}
      />
      <div
        className={`aurora-blob ${dims[2]} bottom-[-20%] left-[25%] opacity-[0.15] dark:opacity-[0.25]`}
        style={{ background: STOPS[2], animationDelay: "-45s" }}
      />
    </div>
  );
}

function AuroraDivider({ className, position }: { className: string; position: "relative" | "absolute" }) {
  const ref = useRef<SVGPathElement>(null);
  const [drawn, setDrawn] = useState(false);
  const particles = useRef(
    Array.from({ length: 5 }).map((_, i) => ({ id: i, delay: i * 3.2 }))
  ).current;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setDrawn(true); },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${position} w-full h-px my-0 ${className}`} aria-hidden="true">
      <svg className="absolute inset-x-0 -top-px w-full h-[2px] overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="aurora-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={STOPS[0]} />
            <stop offset="50%" stopColor={STOPS[1]} />
            <stop offset="100%" stopColor={STOPS[2]} />
          </linearGradient>
        </defs>
        <path
          ref={ref}
          d="M0,1 L1000,1"
          vectorEffect="non-scaling-stroke"
          stroke="url(#aurora-line-gradient)"
          strokeWidth="2"
          className="aurora-draw-path"
          style={{
            filter: "drop-shadow(0 0 6px rgba(139,92,246,0.5))",
            strokeDasharray: 1000,
            strokeDashoffset: drawn ? 0 : 1000,
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </svg>
      {particles.map((p) => (
        <span
          key={p.id}
          className="aurora-particle absolute top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-white shadow-[0_0_6px_2px_rgba(217,70,239,0.6)]"
          style={{
            offsetPath: "path('M0,1 L1000,1')",
            animation: `aurora-particle-drift ${14 + p.id * 2}s linear infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
