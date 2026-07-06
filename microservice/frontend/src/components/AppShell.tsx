"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Wrench,
  Wand2,
  Zap,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/agent-creator", label: "Creator", icon: Wand2 },
  { href: "/agent-invoke", label: "Invoke", icon: Zap },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) return <>{children}</>;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
              <div className="absolute inset-[2px] bg-white rounded-md flex items-center justify-center">
                <img src="/amadeus.svg" alt="A" className="w-4 h-4 object-contain" />
              </div>
            </div>
            <span className="font-bold text-sm text-slate-900 tracking-tight">Amadeus</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 mt-1">
            Platform
          </p>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-slate-900" : "text-slate-400"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Version / Env */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">amadeus.a2a/1</span>
              <span className="badge badge-green">Live</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">Air-gapped on-prem. OJK / BI compliant.</p>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA]">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-slate-900 capitalize">
              {NAV_ITEMS.find(n => pathname.startsWith(n.href))?.label || "Amadeus"}
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">{pathname}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="http://localhost:8080/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs py-1.5 px-3"
            >
              API Docs <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
