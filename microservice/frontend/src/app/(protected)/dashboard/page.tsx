"use client";

import { Rocket, Bot, Wrench, Database } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-[#0a0a0a] text-slate-900 dark:text-slate-100">
      <div className="text-center max-w-2xl">
        <div className="w-20 h-20 bg-gradient-to-tr from-fuchsia-500 to-cyan-600 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-2xl shadow-cyan-500/20">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Amadeus</h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mb-12 leading-relaxed">
          The Amadeus Meta-Orchestrator platform is ready. The Transaction Ledger (LC) module is currently under development and will be available in a future update.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <Link href="/agents" className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-fuchsia-500/30 transition-colors group">
            <Bot className="w-8 h-8 text-fuchsia-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Agent Gallery</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage and deploy autonomous AI agents for your enterprise tasks.</p>
          </Link>
          <Link href="/agent-creator" className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 transition-colors group">
            <Rocket className="w-8 h-8 text-cyan-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Agent Architect</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Design and construct complex agent loops and MCP toolchains.</p>
          </Link>
          <Link href="/tools" className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/30 transition-colors group">
            <Wrench className="w-8 h-8 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tools Registry</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Browse and configure MCP (Model Context Protocol) tools.</p>
          </Link>
          <Link href="/knowledge-base" className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/30 transition-colors group">
            <Database className="w-8 h-8 text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Knowledge Bases</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage vector databases and document context for your agents.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
