"use client";

import { useEffect, useState } from "react";

export function AuroraBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[900px] h-[900px] pointer-events-none opacity-40 md:opacity-60 z-0 overflow-hidden md:overflow-visible">
      {/* Cyan Blob */}
      <div 
        className="absolute top-0 left-1/4 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#22d3ee]/30 rounded-full blur-[80px] md:blur-[120px] mix-blend-screen"
        style={{ animation: 'aurora-drift 60s ease-in-out infinite' }}
      />
      {/* Fuchsia Blob */}
      <div 
        className="absolute top-1/4 right-1/4 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[#d946ef]/20 rounded-full blur-[80px] md:blur-[140px] mix-blend-screen" 
        style={{ animation: 'aurora-drift 75s ease-in-out infinite reverse', animationDelay: '-15s' }} 
      />
      {/* Yellow Blob */}
      <div 
        className="absolute bottom-1/4 left-1/4 w-[300px] md:w-[700px] h-[300px] md:h-[700px] bg-[#fde047]/15 rounded-full blur-[80px] md:blur-[160px] mix-blend-screen" 
        style={{ animation: 'aurora-drift 90s ease-in-out infinite', animationDelay: '-30s' }} 
      />
    </div>
  );
}
