"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { GithubIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from "@/components/Icons";
import { MARKETING_NAV_LINKS } from "@/lib/marketingNav";

export function MarketingHeader() {
  const pathname = usePathname();

  return (
    <div className="fixed top-6 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
      <header className="h-[68px] w-full max-w-[1400px] rounded-full bg-white/10 backdrop-blur-[32px] ring-1 ring-white/40 ring-inset shadow-2xl shadow-slate-200/50 pointer-events-auto relative flex items-center">
        {/* Animated Rainbow Border */}
        <div
          className="absolute -inset-[1.5px] -z-10 rounded-full pointer-events-none bg-gradient-to-r from-blue-400 via-pink-400 to-yellow-400 opacity-90 bg-[length:200%_auto] animate-border-spin"
          style={{
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '1.5px'
          }}
        />

        <div className="w-full h-full flex items-center justify-between px-6 rounded-full z-10">
          {/* Left: Logo + Links */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/amadeus.svg" alt="Amadeus Logo" className="w-8 h-8 object-contain drop-shadow-sm filter-none" />
              <span className="font-extrabold text-lg tracking-tight text-slate-900 hidden lg:block">Amadeus</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-5">
              {MARKETING_NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`text-[13px] font-semibold transition-colors ${
                      isActive ? "text-pink-600" : "text-slate-700 hover:text-pink-600"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Socials + CTA */}
          <div className="flex items-center gap-6">
            <div className="hidden xl:flex items-center gap-4 text-slate-400">
              <a href="#" className="hover:text-slate-900 transition-colors"><GithubIcon className="w-4 h-4" /></a>
              <a href="#" className="hover:text-slate-900 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
              </a>
              <a href="#" className="hover:text-slate-900 transition-colors"><TwitterIcon className="w-4 h-4" /></a>
              <a href="#" className="hover:text-slate-900 transition-colors"><LinkedinIcon className="w-4 h-4" /></a>
              <a href="#" className="hover:text-slate-900 transition-colors"><YoutubeIcon className="w-4 h-4" /></a>
            </div>
            <div className="w-px h-5 bg-slate-300 hidden xl:block" />
            <div className="flex items-center gap-3">
              <Link href="/#demo" className="text-[13px] font-bold text-slate-700 hover:text-pink-600 transition-colors hidden md:block">
                Book a Demo
              </Link>
              <Link href="/signup" className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-[13px] font-bold py-2 px-5 rounded-full hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 active:scale-[0.98]">
                Try for free <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
