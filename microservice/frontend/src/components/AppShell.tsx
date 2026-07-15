"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Wrench,
  Wand2,
  Zap,
  BookOpen,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/Icons";
import { MARKETING_CHROMELESS_ROUTES } from "@/lib/marketingNav";

const NAV_SECTIONS = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/tools", label: "Tools", icon: Wrench },
      { href: "/agent-creator", label: "Creator", icon: Wand2 },
      { href: "/playground", label: "Playground", icon: Zap },
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
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isChromeless =
    pathname === "/" ||
    pathname === "/login" ||
    MARKETING_CHROMELESS_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));

  if (isChromeless) return <>{children}</>;

  const current = ALL_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));

  return (
    <div className="flex h-[100dvh] bg-[#f8f9fa] overflow-hidden">
      {/* Left Rail — enterprise dark console (Desktop) */}
      <aside className="hidden md:flex w-64 flex-shrink-0 surface-dark flex-col border-r border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/" className="flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/amadeus.svg" alt="Amadeus Logo" className="w-8 h-8 object-contain drop-shadow-md" />
            <span className="font-semibold text-lg text-white tracking-wide">Amadeus</span>
            <span className="text-[9px] font-medium text-white/50 border border-white/20 bg-white/5 rounded-md px-1.5 py-0.5">A2A</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="text-xs font-semibold text-white/40 px-3 mb-3">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${ isActive ? "bg-white/10 text-white shadow-sm backdrop-blur-md border border-white/5" : "text-white/60 hover:bg-white/5 hover:text-white" }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[4px] rounded-r-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-blue-400" : "text-white/40"}`} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: Env card */}
        <div className="p-4 border-t border-white/5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/60">amadeus.a2a/1</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">Air-gapped on-prem · OJK / BI compliant</p>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] relative">
        {/* Top Bar */}
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-semibold text-slate-800 leading-tight">
                {current?.label || "Amadeus"}
              </h1>
              <p className="text-[11px] text-slate-400 font-medium leading-tight hidden md:block">{pathname}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 mr-2">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-slate-800 transition-colors bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-sm">
                <GithubIcon className="w-4 h-4" />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-[#0A66C2] transition-colors bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-sm">
                <LinkedinIcon className="w-4 h-4" />
              </a>
            </div>
            <span className="hidden md:inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              Operational
            </span>
            <a
              href="http://localhost:8080/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium py-1.5 px-3 rounded-full hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            >
              API Docs <ArrowUpRight className="w-3 h-3" />
            </a>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 bg-slate-900 border border-slate-900 text-white text-xs font-medium py-1.5 px-3 rounded-full hover:bg-slate-800 transition-colors shadow-sm ml-1"
                title="Account Menu"
              >
                <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white">
                  A
                </div>
                <span className="hidden md:inline">Account</span>
              </button>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50">
                  <div className="py-2">
                    <div className="px-4 py-2 mb-1">
                      <p className="text-xs font-semibold text-slate-800">Admin User</p>
                      <p className="text-[10px] text-slate-500">amadeus.a2a/1</p>
                    </div>
                    <div className="h-px bg-slate-100 mb-1"></div>
                    <Link 
                      href="/login" 
                      onClick={() => setDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-pink-600 transition-colors"
                    >
                      Sign in
                    </Link>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>
        
        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 flex items-center justify-around px-2 py-2 pb-safe z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.04)]">
          {ALL_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center w-16 h-12 gap-1 rounded-xl transition-all ${ isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600" }`}
              >
                <div className={`relative p-1.5 rounded-full ${isActive ? 'bg-blue-50' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : ""}`} />
                </div>
                <span className="text-[9px] font-medium tracking-wide">{label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
