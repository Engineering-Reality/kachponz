"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative group rounded-xl overflow-hidden ${className}`}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Animated Vibrant Rainbow Border */}
      <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-70 group-hover:opacity-100 transition-opacity duration-500 z-0"></div>
      
      {/* Glass Inner Content */}
      <div className="absolute inset-[2px] rounded-[10px] glass-panel z-10 p-6 flex flex-col justify-between">
        {children}
      </div>
      
      {/* Invisible padding to keep the shape since inner content is absolute */}
      <div className="p-[2px] invisible">
        <div className="p-6">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
