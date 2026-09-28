import React from "react";

export function SketchBorder({
  children,
  className = "",
  hasRainbowShimmer = false,
  padding = "p-4",
  rounded = "rounded-2xl",
}: {
  children: React.ReactNode;
  className?: string;
  hasRainbowShimmer?: boolean;
  padding?: string;
  rounded?: string;
}) {
  return (
    <div className={`relative ${rounded} ${className}`}>
      {/* SVG Hand-Drawn Wavy Outline */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <path
          d="M 4,4 Q 50,2 96,4 Q 98,50 96,96 Q 50,98 4,96 Q 2,50 4,4 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[var(--line)] opacity-80"
          vectorEffect="non-scaling-stroke"
        />
        {hasRainbowShimmer && (
          <path
            d="M 4,4 Q 50,2 96,4 Q 98,50 96,96 Q 50,98 4,96 Q 2,50 4,4 Z"
            fill="none"
            stroke="url(#sketch-rainbow)"
            strokeWidth="2.5"
            strokeDasharray="16 8"
            className="animate-border-spin opacity-70"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <defs>
          <linearGradient id="sketch-rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="25%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#d946ef" />
            <stop offset="75%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
      </svg>

      <div className={`relative z-10 ${padding}`}>{children}</div>
    </div>
  );
}
