"use client";

import { useEffect, useRef, useState } from "react";

export default function InteractiveAuthGradient({ title, description }: { title: string; description: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePosition({ x, y });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseenter", () => setIsHovering(true));
      container.addEventListener("mouseleave", () => setIsHovering(false));
    }
    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseenter", () => setIsHovering(true));
        container.removeEventListener("mouseleave", () => setIsHovering(false));
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-slate-900 rounded-[2rem] flex flex-col items-center justify-center"
    >
      {/* Base ambient gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-0" />

      {/* Interactive cursor gradient */}
      <div 
        className="absolute inset-0 transition-opacity duration-700 ease-out z-0 mix-blend-screen"
        style={{
          opacity: isHovering ? 0.8 : 0.4,
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(236,72,153,0.6), rgba(59,130,246,0.6) 30%, rgba(234,179,8,0.2) 60%, transparent 80%)`,
          filter: 'blur(50px)'
        }}
      />
      
      {/* Decorative background grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 z-10" />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center text-center px-12 pointer-events-none">
         <img src="/amadeus.svg" alt="Amadeus" className="w-24 h-24 mb-8 drop-shadow-2xl" />
         <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">{title}</h2>
         <p className="text-white/60 text-sm max-w-xs leading-relaxed font-medium">
           {description}
         </p>
      </div>

      {/* Floating abstract elements */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse z-0" />
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse z-0" style={{ animationDelay: '2s' }} />
    </div>
  );
}
