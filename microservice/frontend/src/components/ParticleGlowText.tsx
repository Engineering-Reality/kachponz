"use client";

import { useEffect, useState } from "react";

export function ParticleGlowText({ text, className = "" }: { text: string; className?: string }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    // Generate random particles around the text
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      x: Math.random() * 120 - 10, // -10% to 110% width
      y: Math.random() * 120 - 10, // -10% to 110% height
      size: Math.random() * 2.5 + 1.5, // 1.5px to 4px
      delay: Math.random() * 2,
      duration: Math.random() * 1.5 + 1.5, // 1.5s to 3s
    }));
    setParticles(newParticles);
  }, []);

  return (
    <span className={`relative inline-block ${className}`}>
      {/* Rainbow Glow */}
      <span className="absolute -inset-2 bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-yellow-400 blur-2xl opacity-40 animate-pulse pointer-events-none rounded-full" />
      
      {/* Particles */}
      <span className="absolute inset-0 pointer-events-none z-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute bg-white rounded-full mix-blend-screen shadow-[0_0_6px_rgba(255,255,255,0.9)]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `float-particle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </span>

      {/* Actual Metallic Text */}
      <span className="relative z-10 bg-gradient-to-br from-white via-slate-100 to-slate-300 bg-clip-text text-transparent drop-shadow-sm font-medium">
        {text}
      </span>
    </span>
  );
}
