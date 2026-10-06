import Link from "next/link";
import { GithubIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from "@/components/Icons";
import { MARKETING_NAV_LINKS } from "@/lib/marketingNav";
import { AuroraThread } from "@/components/AuroraThread";
import { ArrowRight } from "lucide-react";

export function MarketingFooter() {
  return (
    <>
      {/* Closing CTA — bookends the hero's tesseract with the same foil */}
      <section className="relative holo-void py-20 md:py-28 overflow-hidden">
        <AuroraThread variant="mesh" size="sm" />
        <div className="relative z-10 max-w-3xl mx-auto px-5 text-center flex flex-col items-center">
          <span className="holo-nucleus relative isolate inline-flex mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/amadeus.svg" alt="" className="w-16 h-16 object-contain rounded-2xl bg-[#1e1b4b] dark:bg-transparent p-1.5 dark:p-0 float-soft" />
          </span>
          <h2 className="section-head text-[clamp(1.6rem,4.5vw,2.75rem)] wire-text mb-4">
            Bring your bots into the loop
          </h2>
          <p className="text-[15px] md:text-[17px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mb-9">
            Connect UiPath, Power Automate, or Automation Anywhere, and let agents handle the exceptions your robots can&apos;t.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-[320px] sm:max-w-none justify-center">
            <Link href="/playground" className="holo-ring holo-cta">
              Open the playground <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/docs" className="wire-btn">Read the docs</Link>
          </div>
        </div>
        <AuroraThread variant="divider" position="absolute" className="bottom-0 left-0" />
      </section>
      <footer className="bg-white dark:bg-[#04030f] pt-16 pb-8 border-t border-slate-200 dark:border-white/[0.06]" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12">
            <div className="col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/amadeus.svg" alt="Amadeus Logo" className="w-7 h-7 object-contain rounded-md bg-[#1e1b4b] dark:bg-transparent p-0.5 dark:p-0" />
                <span className="font-display font-medium text-sm tracking-[0.12em] text-slate-900 dark:text-white">AMADEUS</span>
              </Link>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                Enterprise agentic orchestration for Trade Finance settlement — coordinating human analysts, AI agents, and RPA robots.
              </p>
              <div className="flex items-center gap-4 text-slate-400 pt-1">
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><GithubIcon className="w-4 h-4" /></a>
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><TwitterIcon className="w-4 h-4" /></a>
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><LinkedinIcon className="w-4 h-4" /></a>
                <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors"><YoutubeIcon className="w-4 h-4" /></a>
              </div>
            </div>

            <div>
              <p className="ui-label text-slate-400 mb-4">Platform</p>
              <ul className="space-y-2.5">
                {MARKETING_NAV_LINKS.filter((l) => ["/product", "/solutions", "/docs"].includes(l.href)).map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
                <li><Link href="/playground" className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Agent Flow Playground</Link></li>
              </ul>
            </div>

            <div>
              <p className="ui-label text-slate-400 mb-4">Company</p>
              <ul className="space-y-2.5">
                {MARKETING_NAV_LINKS.filter((l) => ["/company", "/blog"].includes(l.href)).map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="ui-label text-slate-400 mb-4">Resources</p>
              <ul className="space-y-2.5">
                {MARKETING_NAV_LINKS.filter((l) => ["/resources", "/pricing"].includes(l.href)).map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between text-xs font-mono gap-4 pt-8 border-t border-slate-100 dark:border-white/[0.06]">
            <span className="text-slate-500 text-center md:text-left">Amadeus Orchestrator — Bank Mandiri Trade Finance Ops</span>
            <Link href="/docs" className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Docs</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
