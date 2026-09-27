"use client";

import Link from "next/link";
import { ArrowRight, Code2, Briefcase, Users, CheckCircle2 } from "lucide-react";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AuroraDivider } from "@/components/AuroraDivider";
import { PRICING_DATA } from "@/config/pricing";

export default function PartnersPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[var(--background)] text-foreground overflow-x-hidden w-full selection:bg-pink-500/30 selection:text-pink-900 dark:selection:text-pink-100">
      <MarketingHeader />

      <main className="pt-32 pb-24">
        {/* Page Header */}
        <section className="max-w-4xl mx-auto px-6 mb-20 text-center">
          <h1 className="text-4xl md:text-6xl font-light tracking-tight text-slate-900 dark:text-white mb-6">
            Partner with Amadeus
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Whether you're building integrations, deploying orchestration for clients, or connecting us with enterprise leads, there's a place for you in our ecosystem.
          </p>
        </section>

        {/* Partner Tiers */}
        <section className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* 1. Technology Partners */}
            <div className="relative flex flex-col p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 backdrop-blur-sm shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-transform duration-300 group">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-800/50">
                <Code2 className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">Technology Partners</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                For teams building an MCP server for their own product or API who want it to be discoverable and certified within Amadeus's extensive tool ecosystem.
              </p>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Listed in Amadeus's official Tool Directory</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Direct technical support for MCP integration</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Co-marketing opportunities for notable integrations</span>
                </li>
              </ul>

              <Link href="#" className="inline-flex justify-center items-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:shadow-lg hover:shadow-slate-900/20 transition-all">
                Submit your MCP Server <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* 2. Implementation Partners */}
            <div className="relative flex flex-col p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 backdrop-blur-sm shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-transform duration-300 group">
              <div className="absolute top-0 left-0 right-0 h-[2px] vibrant-rainbow-bg rounded-t-3xl opacity-70" />
              <div className="w-12 h-12 bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-2xl flex items-center justify-center mb-6 border border-fuchsia-100 dark:border-fuchsia-800/50">
                <Briefcase className="w-6 h-6 text-fuchsia-500 dark:text-fuchsia-400" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">Implementation Partners</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                For system integrators and consultancies doing RPA portfolio rationalization and deploying Amadeus on behalf of enterprise banking clients.
              </p>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Access to executive briefing and enablement materials</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Generous revenue-share and deployment bounties</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Direct architectural support channel (separate from standard queue)</span>
                </li>
              </ul>

              <Link href="#" className="inline-flex justify-center items-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700">
                Become an Integrator <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* 3. Referral Partners */}
            <div className="relative flex flex-col p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 backdrop-blur-sm shadow-xl shadow-slate-200/50 dark:shadow-none hover:-translate-y-1 transition-transform duration-300 group">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 dark:border-emerald-800/50">
                <Users className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">Referral Partners</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                For independent professionals, analysts, or anyone who can point a qualified enterprise lead to our sales team.
              </p>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Lightweight referral process</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Stated commission structure of <strong>{PRICING_DATA.partners.referral.commission}</strong></span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Prompt payouts upon closed enterprise contracts</span>
                </li>
              </ul>

              <Link href="#" className="inline-flex justify-center items-center gap-2 w-full py-3 px-4 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700">
                Submit a Lead <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

          </div>
        </section>

        <AuroraDivider className="opacity-50" />

      </main>

      <MarketingFooter />
    </div>
  );
}
