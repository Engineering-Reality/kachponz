"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Info, ArrowRight, ShieldCheck, Lock, Server, FileCheck, HelpCircle } from "lucide-react";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { AuroraDivider } from "@/components/AuroraDivider";
import { PRICING_DATA } from "@/config/pricing";

export default function PricingPage() {
  const [activeTrack, setActiveTrack] = useState<"individual" | "team" | "enterprise" | "all">("all");

  const isRelevant = (tierId: string) => {
    if (activeTrack === "all") return true;
    if (activeTrack === "individual" && (tierId === "builder" || tierId === "boilerplate")) return true;
    if (activeTrack === "team" && (tierId === "team" || tierId === "business")) return true;
    if (activeTrack === "enterprise" && tierId === "enterprise") return true;
    return false;
  };

  const getTrackOpacity = (tierId: string) => {
    return isRelevant(tierId) ? "opacity-100 scale-100 grayscale-0 z-10" : "opacity-30 scale-[0.98] grayscale pointer-events-none z-0";
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[var(--background)] text-foreground overflow-x-hidden w-full selection:bg-pink-500/30 selection:text-pink-900 dark:selection:text-pink-100">
      <MarketingHeader />

      <main className="pt-32 pb-24">
        {/* Track Selector Header */}
        <section className="max-w-6xl mx-auto px-6 mb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-slate-900 dark:text-white mb-6">
            Simple, predictable pricing for autonomous operations.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12">
            Whether you're building a weekend side-project or automating a regulated bank, we have a clear path for you.
          </p>

          <div className="inline-flex flex-col items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              What are you building?
            </span>
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-full backdrop-blur">
              {["all", "individual", "team", "enterprise"].map((track) => (
                <button
                  key={track}
                  onClick={() => setActiveTrack(track as any)}
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                    activeTrack === track
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {track.charAt(0).toUpperCase() + track.slice(1).replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Global Note */}
        <div className="max-w-4xl mx-auto px-6 mb-12">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
              <strong>Creator's Promise:</strong> {PRICING_DATA.globalNote}
            </p>
          </div>
        </div>

        {/* Self-Serve Tiers Row */}
        <section className="max-w-7xl mx-auto px-6 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.values(PRICING_DATA.tiers).filter(t => t.id !== "enterprise").map((tier) => (
              <div
                key={tier.id}
                className={`relative flex flex-col p-8 rounded-3xl transition-all duration-500 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 backdrop-blur-sm ${getTrackOpacity(tier.id)} ${tier.id === "team" ? "ring-1 ring-cyan-500/50 shadow-2xl shadow-cyan-500/10" : "shadow-xl shadow-slate-200/50 dark:shadow-none"}`}
              >
                {tier.id === "team" && (
                  <>
                    <div className="absolute top-0 left-0 right-0 h-1 vibrant-rainbow-bg rounded-t-3xl opacity-70" />
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-cyan-200 dark:border-cyan-800/50">
                      Recommended
                    </div>
                  </>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{tier.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[40px] leading-relaxed">
                    {tier.tagline}
                  </p>
                </div>

                <div className="mb-8">
                  {(tier.price as any).type === "usage" ? (
                    <div>
                      <span className="text-2xl font-light text-slate-900 dark:text-white">{(tier.price as any).usd}</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{(tier.price as any).description}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1">
                        <span className="text-slate-400">$</span>
                        <span className="text-4xl font-light text-slate-900 dark:text-white tracking-tight">{(tier.price as any).usd}</span>
                        <span className="text-slate-500 text-sm">{(tier.price as any).unit}</span>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Rp {(tier.price as any).idr}
                      </div>
                    </div>
                  )}
                </div>

                <ul className="space-y-4 mb-8 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                  tier.id === "team"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:shadow-lg hover:shadow-slate-900/20 dark:hover:shadow-white/20 hover:-translate-y-0.5"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}>
                  {tier.id === "business" ? "Talk to us" : "Get Started"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <AuroraDivider className="opacity-50" />

        {/* Enterprise Band */}
        <section className={`w-full bg-[#0B0F19] py-24 relative overflow-hidden transition-all duration-700 ${getTrackOpacity("enterprise")}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/5 pointer-events-none" />
          
          <div className="max-w-6xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="lg:w-1/2">
              <h2 className="text-3xl md:text-4xl font-light text-white mb-4">Enterprise</h2>
              <p className="text-slate-400 leading-relaxed mb-8 text-lg">
                {PRICING_DATA.tiers.enterprise.tagline}
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="flex flex-col gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <span className="text-sm font-semibold text-white">ISO 27001 Ready</span>
                  <span className="text-xs text-slate-500">Bank-grade security</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Lock className="w-6 h-6 text-fuchsia-400" />
                  <span className="text-sm font-semibold text-white">HMAC-SHA512</span>
                  <span className="text-xs text-slate-500">Tamper-proof logs</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Server className="w-6 h-6 text-cyan-400" />
                  <span className="text-sm font-semibold text-white">Air-Gapped Node</span>
                  <span className="text-xs text-slate-500">Self-hosted runtime</span>
                </div>
                <div className="flex flex-col gap-2">
                  <FileCheck className="w-6 h-6 text-amber-400" />
                  <span className="text-sm font-semibold text-white">OJK / BI Compliant</span>
                  <span className="text-xs text-slate-500">Regulatory ready</span>
                </div>
              </div>

              <button className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-3.5 rounded-xl text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                {(PRICING_DATA.tiers.enterprise.price as any).label}
              </button>
            </div>

            <div className="lg:w-1/3 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur">
              <h3 className="text-white font-semibold mb-6 border-b border-slate-800 pb-4">Enterprise Inclusions</h3>
              <ul className="space-y-4">
                {PRICING_DATA.tiers.enterprise.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Feature Comparison (Collapsed by default) */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <details className="group cursor-pointer">
            <summary className="flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium transition-colors list-none">
              <span>View full feature comparison</span>
              <ArrowRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
            </summary>
            
            <div className="mt-12 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <th className="py-4 px-6 font-semibold">Features</th>
                    <th className="py-4 px-6 font-semibold">Builder</th>
                    <th className="py-4 px-6 font-semibold">SaaS Boilerplate</th>
                    <th className="py-4 px-6 font-semibold">Team</th>
                    <th className="py-4 px-6 font-semibold">Business</th>
                    <th className="py-4 px-6 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-400">
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="py-4 px-6">Model Tokens</td>
                    <td className="py-4 px-6">10M / mo</td>
                    <td className="py-4 px-6">25M / mo</td>
                    <td className="py-4 px-6">100M / mo</td>
                    <td className="py-4 px-6">Unlimited (Pay-as-you-go)</td>
                    <td className="py-4 px-6">Custom Limits</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="py-4 px-6">MCP Connections</td>
                    <td className="py-4 px-6">3</td>
                    <td className="py-4 px-6">5</td>
                    <td className="py-4 px-6">Unlimited</td>
                    <td className="py-4 px-6">Unlimited + Custom connectors</td>
                    <td className="py-4 px-6">Custom integration</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="py-4 px-6">Support SLA</td>
                    <td className="py-4 px-6">Community</td>
                    <td className="py-4 px-6">Direct Creator Support</td>
                    <td className="py-4 px-6">1 Business Day</td>
                    <td className="py-4 px-6">24/7 Priority Service</td>
                    <td className="py-4 px-6">Dedicated Account Team</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="py-4 px-6">Deployment</td>
                    <td className="py-4 px-6">Cloud Hosted</td>
                    <td className="py-4 px-6">Cloud Hosted</td>
                    <td className="py-4 px-6">Cloud Hosted</td>
                    <td className="py-4 px-6">Cloud Hosted</td>
                    <td className="py-4 px-6">Air-Gapped On-Premise</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </section>

        {/* Pricing FAQ */}
        <section className="max-w-3xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-light text-slate-900 dark:text-white mb-8 text-center flex items-center justify-center gap-2">
            <HelpCircle className="w-5 h-5 text-fuchsia-500" /> Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">I'm a student/solo builder — is Amadeus overkill for me?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Not at all. While the core engine powers banks, the Builder tier gives you access to the exact same agent orchestrator. It's the fastest way to wire up LLMs to your side-project APIs using MCP, without getting bogged down in boilerplate orchestration code.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">We're a regulated business — can we start on a self-serve tier?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Probably not. If you have strict data residency, audit, or air-gapping requirements from day one, you need the Enterprise tier. The self-serve tiers are multi-tenant cloud-hosted and do not provide custom BAA or OJK compliance artifacts. Contact Sales to evaluate the on-premise Netra Runtime.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">What does "24/7 maintenance & service" mean?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                As part of my commitment to all paid users, I provide direct, hands-on assistance. Whether you need help structuring your agent prompts, debugging an MCP connection, or building a fully customized agent from scratch, I'm here to ensure your deployment succeeds.
              </p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
