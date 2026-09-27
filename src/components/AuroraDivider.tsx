"use client";

import { useEffect, useRef, useState } from "react";

export function AuroraDivider({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={`w-full max-w-5xl mx-auto py-12 md:py-24 relative flex justify-center ${className}`}>
      <div className="relative w-full h-[2px] max-w-[800px] flex items-center justify-center opacity-80">
        {/* Glow backdrop */}
        <div 
          className={`absolute inset-0 bg-gradient-to-r from-transparent via-[#d946ef]/40 to-transparent blur-md transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
        />
        
        {/* SVG Animated Line */}
        <svg
          className="w-full h-[40px] absolute overflow-visible"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <path
            d="M 0,50 Q 25,30 50,50 T 100,50"
            fill="none"
            stroke="url(#aurora-gradient)"
            strokeWidth="0.5"
            strokeDasharray="100"
            strokeDashoffset={isVisible ? 0 : 100}
            className="transition-all duration-[2s] ease-in-out"
          />
          <defs>
            <linearGradient id="aurora-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="25%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#d946ef" />
              <stop offset="75%" stopColor="#fde047" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>

        {/* Drifting particle on the line */}
        <div 
          className={`absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_#fff,0_0_20px_#22d3ee] transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{
            offsetPath: "path('M 0,50 Q 25,30 50,50 T 100,50')",
            animation: isVisible ? "aurora-particle-drift 8s linear infinite" : "none"
          }}
        />
      </div>
    </div>
  );
}
