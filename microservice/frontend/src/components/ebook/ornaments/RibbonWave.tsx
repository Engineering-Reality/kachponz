import React from "react";

export function RibbonDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full flex items-center justify-center my-3 overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 400 18"
        fill="none"
        className="w-full max-w-[280px] h-[14px]"
        aria-hidden="true"
      >
        <path
          d="M0,9 C50,2 100,16 150,9 C200,2 250,16 300,9 C350,2 380,14 400,9"
          stroke="url(#rainbow-ribbon-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="rainbow-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="25%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#d946ef" />
            <stop offset="75%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
