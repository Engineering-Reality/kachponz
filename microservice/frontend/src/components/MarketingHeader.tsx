"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { GithubIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from "@/components/Icons";
import { MARKETING_NAV_LINKS } from "@/lib/marketingNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MarketingHeader() {
  const pathname = usePathname();
  // The sheet remembers which route it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenOn(value ? pathname : null);
  };

  // Close on Escape; lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="fixed top-3 md:top-6 left-0 right-0 z-50 px-3 md:px-4 flex flex-col items-center pointer-events-none" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <header className="h-[60px] md:h-[68px] w-full max-w-[1400px] rounded-full holo-glass shadow-[0_10px_40px_-12px_rgba(30,27,75,0.25)] dark:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] pointer-events-auto relative flex items-center">
        {/* Foil hairline — shifts with pointer / tilt */}
        <div
          className="absolute -inset-px rounded-full pointer-events-none opacity-70"
          style={{
            background: "var(--holo-foil)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "1px",
          }}
        />

        <div className="w-full h-full flex items-center justify-between pl-4 pr-2 md:px-6 rounded-full z-10">
          {/* Left: Logo + Links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 md:gap-3">
              <span className="holo-nucleus relative isolate inline-flex">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/amadeus.svg" alt="" className="w-8 h-8 object-contain rounded-lg bg-[#1e1b4b] dark:bg-transparent p-0.5 dark:p-0" />
              </span>
              <span className="font-display font-medium text-[15px] md:text-base tracking-[0.12em] text-foreground">AMADEUS</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-5" aria-label="Main">
              {MARKETING_NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`text-[13px] font-medium transition-colors ${
                      isActive ? "holo-text" : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Socials + CTA */}
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden xl:flex items-center gap-4 text-slate-600 dark:text-slate-500">
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><GithubIcon className="w-4 h-4" /></a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
              </a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><TwitterIcon className="w-4 h-4" /></a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><LinkedinIcon className="w-4 h-4" /></a>
              <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><YoutubeIcon className="w-4 h-4" /></a>
            </div>
            <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 hidden xl:block" />
            <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggle />
              <Link href="/login" className="hidden sm:inline-flex items-center gap-1.5 bg-[#1E1B4B] dark:bg-white text-white dark:text-[#1E1B4B] text-[13px] font-medium py-2 px-5 rounded-full hover:bg-[#2D286B] dark:hover:bg-slate-100 transition-colors active:scale-[0.98]">
                Sign in <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? "Close menu" : "Open menu"}
                className="lg:hidden w-11 h-11 rounded-full flex items-center justify-center text-slate-800 dark:text-slate-100 hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors"
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-sm pointer-events-auto lg:hidden"
          />
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="sheet-in lg:hidden pointer-events-auto mt-2 w-full max-w-[1400px] rounded-[28px] holo-glass holo-sheen p-3 shadow-2xl overflow-hidden"
          >
            <ul className="relative z-10 grid grid-cols-2 gap-1">
              {MARKETING_NAV_LINKS.map(({ href, label }, i) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href} className="item-in" style={{ animationDelay: `${40 + i * 35}ms` }}>
                    <Link
                      href={href}
                      className={`flex items-center min-h-[48px] px-4 rounded-2xl text-[15px] font-medium transition-colors ${
                        isActive ? "holo-text" : "text-slate-800 dark:text-slate-100 hover:bg-slate-900/5 dark:hover:bg-white/5"
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="holo-rule my-3 relative z-10" />
            <div className="relative z-10 flex items-center justify-between gap-3 px-1 pb-1">
              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <a href="#" aria-label="GitHub" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-900/5 dark:hover:bg-white/10"><GithubIcon className="w-4 h-4" /></a>
                <a href="#" aria-label="X" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-900/5 dark:hover:bg-white/10"><TwitterIcon className="w-4 h-4" /></a>
                <a href="#" aria-label="LinkedIn" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-900/5 dark:hover:bg-white/10"><LinkedinIcon className="w-4 h-4" /></a>
                <a href="#" aria-label="YouTube" className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-900/5 dark:hover:bg-white/10"><YoutubeIcon className="w-4 h-4" /></a>
              </div>
              <Link href="/login" className="holo-ring holo-cta !py-3 !px-6 !text-[14px]">
                Sign in <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
