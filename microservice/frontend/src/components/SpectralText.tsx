"use client";

import React, { useState, useRef, useEffect } from 'react';

export function SpectralText({ text, className = "pastel-rainbow-text" }: { text: string; className?: string }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [time, setTime] = useState(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const animate = () => {
      setTime(prev => prev + 0.05);
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  };

  // Base analog flicker logic
  const flicker = isHovering ? 0.8 + 0.2 * Math.sin(time * 10) : 1;

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center justify-center whitespace-nowrap cursor-default group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
      style={{ opacity: flicker }}
    >
      {/* Base Text (Always visible) */}
      <span className={`relative z-10 transition-opacity duration-300 group-hover:opacity-80 ${className}`}>
        {text}
      </span>

      {/* Spectral Layer 1 - Cyan */}
      <span
        className="absolute top-0 left-0 text-[#00f0ff] mix-blend-screen pointer-events-none transition-transform duration-75 select-none"
        style={{
          opacity: isHovering ? 0.8 : 0,
          transform: isHovering ? `translate(${(mousePos.x - 0.5) * 5 + Math.sin(time) * 1}px, ${(mousePos.y - 0.5) * -3}px)` : 'translate(0, 0)',
          filter: 'blur(1px)'
        }}
        aria-hidden="true"
      >
        {text}
      </span>

      {/* Spectral Layer 2 - Pink */}
      <span
        className="absolute top-0 left-0 text-[#ff00a0] mix-blend-screen pointer-events-none transition-transform duration-100 select-none"
        style={{
          opacity: isHovering ? 0.7 : 0,
          transform: isHovering ? `translate(${(mousePos.x - 0.5) * -3}px, ${(mousePos.y - 0.5) * 5 + Math.cos(time) * 1}px)` : 'translate(0, 0)',
          filter: 'blur(2px)'
        }}
        aria-hidden="true"
      >
        {text}
      </span>

      {/* Spectral Layer 3 - Purple */}
      <span
        className="absolute top-0 left-0 text-[#a000ff] mix-blend-screen pointer-events-none transition-transform duration-150 select-none"
        style={{
          opacity: isHovering ? 0.6 : 0,
          transform: isHovering ? `translate(${(mousePos.y - 0.5) * 5}px, ${(mousePos.x - 0.5) * 4 - Math.sin(time) * 1}px)` : 'translate(0, 0)',
          filter: 'blur(3px)'
        }}
        aria-hidden="true"
      >
        {text}
      </span>

      {/* Spectral Layer 4 - Yellow */}
      <span
        className="absolute top-0 left-0 text-[#fbbf24] mix-blend-screen pointer-events-none transition-transform duration-[120ms] select-none"
        style={{
          opacity: isHovering ? 0.8 : 0,
          transform: isHovering ? `translate(${(mousePos.x - 0.5) * 4 - Math.cos(time) * 1.5}px, ${(mousePos.y - 0.5) * -4}px)` : 'translate(0, 0)',
          filter: 'blur(1.5px)'
        }}
        aria-hidden="true"
      >
        {text}
      </span>

      {/* Scanline Overlay */}
      {isHovering && (
        <span
          className="absolute inset-0 z-20 opacity-20 pointer-events-none mix-blend-overlay"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)',
            backgroundSize: '100% 4px'
          }}
        />
      )}
    </span>
  );
}
