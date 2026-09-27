"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-9 h-9" />; // Placeholder to avoid layout shift

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm relative overflow-hidden group"
      aria-label="Toggle theme"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/10 via-fuchsia-400/10 to-yellow-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      {theme === "dark" ? <Sun className="w-[18px] h-[18px] relative z-10" /> : <Moon className="w-[18px] h-[18px] relative z-10" />}
    </button>
  );
}
