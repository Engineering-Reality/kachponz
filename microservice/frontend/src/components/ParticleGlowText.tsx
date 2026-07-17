"use client";

import { useEffect, useState } from "react";

export function ParticleGlowText({ text, className = "" }: { text: string; className?: string }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    // Generate continuous particles emitting from the center
    const newParticles = Array.from({ length: 15 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 50 + 20; // 20px to 70px outward
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      return {
        id: i,
        tx,
        ty,
        size: Math.random() * 3 + 1.5, // 1.5px to 4.5px
        delay: Math.random() * 2,
        duration: Math.random() * 1.5 + 1.5, // 1.5s to 3s
      };
    });
    setParticles(newParticles);
  }, []);

  return (
    <span className={`relative inline-block ${className}`}>
      <style>{`
        @keyframes emit-particle {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.5); opacity: 0; }
        }
      `}</style>
      
      {/* Rainbow Glow */}
      <span className="absolute -inset-2 bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-yellow-400 blur-2xl opacity-40 animate-pulse pointer-events-none rounded-full" />
      
      {/* Particles */}
      <span className="absolute inset-0 pointer-events-none z-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute bg-white rounded-full mix-blend-screen shadow-[0_0_6px_rgba(255,255,255,0.9)]"
            style={{
              left: '50%',
              top: '50%',
              width: `${p.size}px`,
              height: `${p.size}px`,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              animation: `emit-particle ${p.duration}s ease-out infinite`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties}
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
