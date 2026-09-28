import React from "react";

export function SparkleStar({
  size = 18,
  className = "",
  fill = "currentColor",
}: {
  size?: number;
  className?: string;
  fill?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2C12.5 7 17 11.5 22 12C17 12.5 12.5 17 12 22C11.5 17 7 12.5 2 12C7 11.5 11.5 7 12 2Z"
        fill={fill}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TwinkleStarRow({ count = 3, filled = 3, size = 20 }: { count?: number; filled?: number; size?: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${filled} dari ${count} bintang`}>
      {Array.from({ length: count }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="transition-all duration-300"
          >
            <path
              d="M12 2L14.8 8.6L22 9.3L16.5 14.1L18.2 21.1L12 17.3L5.8 21.1L7.5 14.1L2 9.3L9.2 8.6L12 2Z"
              fill={isFilled ? "#facc15" : "none"}
              stroke={isFilled ? "#eab308" : "var(--line)"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}

export function FloatingCloud({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 48 30"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 24C6 24 3 21 3 17C3 13.5 5.5 10.5 9 10.1C10.5 5 15.5 1 21.5 1C27.5 1 32.5 5 34 10.1C37.5 10.5 40 13.5 40 17C40 21 37 24 33 24L10 24Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
