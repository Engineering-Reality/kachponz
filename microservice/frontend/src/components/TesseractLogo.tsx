"use client";

import React from 'react';

export function TesseractLogo() {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center perspective-1000">
      {/* Container that spins the entire tesseract system */}
      <div className="relative w-32 h-32 preserve-3d animate-tesseract-spin">
        
        {/* Outer Cube (Wireframe edges) */}
        <div className="absolute inset-0 preserve-3d">
          {/* Front */}
          <div className="absolute inset-0 border-[1.5px] border-slate-700 dark:border-white/70" style={{ transform: 'translateZ(64px)' }} />
          {/* Back */}
          <div className="absolute inset-0 border-[1.5px] border-slate-700 dark:border-white/70" style={{ transform: 'translateZ(-64px)' }} />
          {/* Left */}
          <div className="absolute inset-0 border-[1.5px] border-slate-700 dark:border-white/70" style={{ transform: 'rotateY(-90deg) translateZ(64px)' }} />
          {/* Right */}
          <div className="absolute inset-0 border-[1.5px] border-slate-700 dark:border-white/70" style={{ transform: 'rotateY(90deg) translateZ(64px)' }} />
          {/* Top */}
          <div className="absolute inset-0 border-[1.5px] border-slate-700 dark:border-white/70" style={{ transform: 'rotateX(90deg) translateZ(64px)' }} />
          {/* Bottom */}
          <div className="absolute inset-0 border-[1.5px] border-slate-700 dark:border-white/70" style={{ transform: 'rotateX(-90deg) translateZ(64px)' }} />
        </div>

        {/* Inner Cube (Nucleus - Solid/Gradient) */}
        <div className="absolute top-[25%] left-[25%] w-16 h-16 preserve-3d animate-nucleus-spin">
          {/* Front (Cyan) */}
          <div className="absolute inset-0 bg-cyan-400/80 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.5)] border border-cyan-200/50" style={{ transform: 'translateZ(32px)' }} />
          {/* Back (Yellow) */}
          <div className="absolute inset-0 bg-yellow-400/80 backdrop-blur-md shadow-[0_0_20px_rgba(250,204,21,0.5)] border border-yellow-200/50" style={{ transform: 'translateZ(-32px)' }} />
          {/* Left (Fuchsia) */}
          <div className="absolute inset-0 bg-fuchsia-500/80 backdrop-blur-md shadow-[0_0_20px_rgba(217,70,239,0.5)] border border-fuchsia-300/50" style={{ transform: 'rotateY(-90deg) translateZ(32px)' }} />
          {/* Right (Cyan) */}
          <div className="absolute inset-0 bg-cyan-500/80 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.5)] border border-cyan-300/50" style={{ transform: 'rotateY(90deg) translateZ(32px)' }} />
          {/* Top (Yellow) */}
          <div className="absolute inset-0 bg-yellow-400/80 backdrop-blur-md shadow-[0_0_20px_rgba(250,204,21,0.5)] border border-yellow-200/50" style={{ transform: 'rotateX(90deg) translateZ(32px)' }} />
          {/* Bottom (Fuchsia) */}
          <div className="absolute inset-0 bg-fuchsia-500/80 backdrop-blur-md shadow-[0_0_20px_rgba(217,70,239,0.5)] border border-fuchsia-300/50" style={{ transform: 'rotateX(-90deg) translateZ(32px)' }} />
        </div>

      </div>
    </div>
  );
}
