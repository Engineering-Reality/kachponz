"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export function BenchmarkSection() {
  return (
    <section className="bg-transparent py-24 relative z-10 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="text-center space-y-4 mb-16">
          <p className="ui-label text-cyan-500">Benchmark</p>
          <h3 className="section-head text-3xl md:text-4xl text-foreground">The New Standard</h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-[15px]">
            Traditional RPA is rigid and breaks when UI changes. LLM Agents are unpredictable and struggle with strict compliance. Amadeus combines the best of both.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl relative">
          
          {/* Legacy RPA Side - Rigid, Boxed-in, Monospaced */}
          <div className="w-full lg:w-[40%] bg-slate-50 dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-10 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMzMzQxNTUiLz48L3N2Zz4=')] opacity-[0.05] dark:opacity-20 pointer-events-none" />
            <h4 className="font-mono text-xl text-slate-600 dark:text-slate-500 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">Legacy RPA</h4>
            <ul className="space-y-6 flex-1 relative z-10">
              {[
                "Brittle DOM Selectors",
                "Fails on UI updates",
                "Deterministic only",
                "Requires dev intervention",
                "No reasoning capabilities"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 dark:text-red-900 mt-0.5 flex-shrink-0" />
                  <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Amadeus Side - Expansive, Dynamic, Gradient */}
          <div className="w-full lg:w-[60%] bg-white dark:bg-slate-950 p-10 lg:p-14 flex flex-col relative overflow-hidden group">
            {/* Dynamic moving gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-fuchsia-500/5 to-yellow-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/20 blur-[100px] rounded-full pointer-events-none" />
            
            <h4 className="text-2xl font-bold text-foreground mb-8 pb-4">Amadeus Agentic Flow</h4>
            <ul className="space-y-6 flex-1 relative z-10">
              {[
                { title: "Computer Vision Self-Healing", desc: "Agents dynamically remap coordinates when selectors fail." },
                { title: "Human-in-the-Loop Orchestration", desc: "Seamlessly route exceptions to humans, then resume automation." },
                { title: "MCP Tool Access", desc: "Direct backend API execution bypasses brittle UI interactions entirely." },
                { title: "Compliance Enforced", desc: "Cryptographic logging of all deterministic and non-deterministic steps." },
                { title: "Autonomous Reasoning", desc: "Agents can interpret unstructured documents and make bounded decisions." }
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">{item.title}</span>
                    <span className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}
