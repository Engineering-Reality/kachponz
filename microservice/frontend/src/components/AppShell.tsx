"use client";

import Link from "next/link";
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

const NAV_SECTIONS = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/tools", label: "Tools", icon: Wrench },
      { href: "/agent-creator", label: "Creator", icon: Wand2 },
      { href: "/agent-invoke", label: "Invoke", icon: Zap },
    ],
  },
  {
    label: "Resources",
    items: [{ href: "/docs", label: "Documentation", icon: BookOpen }],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) return <>{children}</>;

  const current = ALL_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left Rail — enterprise dark console */}
      <aside className="w-60 flex-shrink-0 surface-dark flex flex-col border-r border-white/8">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-white/8">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/amadeus.svg" alt="Amadeus Logo" className="w-8 h-8 object-contain animate-spin-tesseract" />
            <span className="font-bold text-base text-white tracking-tight">Amadeus</span>
            <span className="ui-label text-[8px] text-white/40 border border-white/15 rounded px-1.5 py-0.5">A2A</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="ui-label text-white/30 px-2.5 mb-2">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-white/8 text-white"
                          : "text-white/50 hover:bg-white/5 hover:text-white/90"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full vibrant-rainbow-bg" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-white/40"}`} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: Env card */}
        <div className="p-4 border-t border-white/8">
          <div className="surface-dark-elevated p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="ui-label text-white/50">amadeus.a2a/1</span>
              <span className="inline-flex items-center gap-1 ui-label text-[8px] text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">Air-gapped on-prem · OJK / BI compliant</p>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA]">
        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-semibold text-slate-900 leading-tight">
                {current?.label || "Amadeus"}
              </h1>
              <p className="text-[11px] text-slate-400 font-mono leading-tight">{pathname}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </span>
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
