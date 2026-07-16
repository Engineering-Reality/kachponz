import Link from "next/link";
import { GithubIcon, TwitterIcon, LinkedinIcon, YoutubeIcon } from "@/components/Icons";
import { MARKETING_NAV_LINKS } from "@/lib/marketingNav";
import { AuroraThread } from "@/components/AuroraThread";

export function MarketingFooter() {
  return (
    <>
      {/* CTA close — Aurora Thread bookends the hero's opening motif */}
      <div className="relative bg-slate-950 py-16 overflow-hidden">
        <AuroraThread variant="mesh" size="sm" />
        <AuroraThread variant="divider" className="max-w-6xl mx-auto" />
      </div>
      <footer className="bg-white pt-16 pb-8 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12">
            <div className="col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/amadeus.svg" alt="Amadeus Logo" className="w-7 h-7 object-contain" />
                <span className="font-semibold text-base tracking-tight text-slate-900">Amadeus</span>
              </Link>
              <p className="text-[13px] text-slate-500 leading-relaxed max-w-xs">
                Enterprise agentic orchestration for Trade Finance settlement — coordinating human analysts, AI agents, and RPA robots.
              </p>
              <div className="flex items-center gap-4 text-slate-400 pt-1">
                <a href="#" className="hover:text-slate-900 transition-colors"><GithubIcon className="w-4 h-4" /></a>
                <a href="#" className="hover:text-slate-900 transition-colors"><TwitterIcon className="w-4 h-4" /></a>
                <a href="#" className="hover:text-slate-900 transition-colors"><LinkedinIcon className="w-4 h-4" /></a>
                <a href="#" className="hover:text-slate-900 transition-colors"><YoutubeIcon className="w-4 h-4" /></a>
              </div>
            </div>

            <div>
              <p className="ui-label text-slate-400 mb-4">Platform</p>
              <ul className="space-y-2.5">
                {MARKETING_NAV_LINKS.filter((l) => ["/product", "/solutions", "/docs"].includes(l.href)).map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[13px] text-slate-600 hover:text-slate-900 transition-colors">{label}</Link>
                  </li>
                ))}
                <li><Link href="/playground" className="text-[13px] text-slate-600 hover:text-slate-900 transition-colors">Playground</Link></li>
              </ul>
            </div>

            <div>
              <p className="ui-label text-slate-400 mb-4">Company</p>
              <ul className="space-y-2.5">
                {MARKETING_NAV_LINKS.filter((l) => ["/company", "/blog"].includes(l.href)).map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[13px] text-slate-600 hover:text-slate-900 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="ui-label text-slate-400 mb-4">Resources</p>
              <ul className="space-y-2.5">
                {MARKETING_NAV_LINKS.filter((l) => ["/resources", "/pricing"].includes(l.href)).map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="text-[13px] text-slate-600 hover:text-slate-900 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between text-xs font-mono gap-4 pt-8 border-t border-slate-100">
            <span className="text-slate-500">Amadeus Orchestrator — Bank Mandiri Trade Finance Ops</span>
            <Link href="/docs" className="text-slate-500 hover:text-slate-900 transition-colors">Docs →</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
