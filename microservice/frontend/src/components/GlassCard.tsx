"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative group rounded-3xl overflow-hidden glass-panel border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] ${className}`}
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Soft ambient glow instead of hard spinning rainbow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
      
      {/* Glass Inner Content */}
      <div className="relative z-10 p-6 flex flex-col justify-between h-full">
        {children}
      </div>
    </motion.div>
  );
}
