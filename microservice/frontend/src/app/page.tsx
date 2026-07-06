"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TransactionGraph } from "@/components/TransactionGraph";
import {
  ShieldCheck,
  Lock,
  Server,
  FileCheck,
  Database,
  ArrowRight,
  Bot,
  Activity,
  Wrench,
  Wand2,
  Zap,
  BookOpen,
  Cpu,
  Layers,
  Send,
} from "lucide-react";

const NAV_APPS = [
  {
    href: "/dashboard",
    step: "Step 01",
    label: "Transaction Tracker",
    desc: "Monitor live state machine transitions and audit trails for LC settlement.",
    icon: Activity,
    accent: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/tools",
    step: "Step 02",
    label: "MCP Tool Registry",
    desc: "Register and connect external tools (UiPath, APIs) for agents to use.",
    icon: Wrench,
    accent: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    href: "/agent-creator",
    step: "Step 03",
    label: "Agent Creator",
    desc: "Design new AI agents easily using natural language descriptions.",
    icon: Wand2,
    accent: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    href: "/agents",
    step: "Step 04",
    label: "Agent Matrix",
    desc: "Manage your agent registry, assign personas, and attach MCP tools.",
    icon: Bot,
    accent: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    href: "/docs",
    step: "Reference",
    label: "Documentation",
    desc: "Full system architecture, MCP servers, A2A protocol, and known gaps.",
    icon: BookOpen,
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/agent-invoke",
    step: "Step 05",
    label: "Agent Invoke",
    desc: "Stream real-time agent reasoning over a selected transaction.",
    icon: Zap,
    accent: "text-cyan-600",
    bg: "bg-cyan-50",
  },
];

const BENCHMARKS = {
  handoff: {
    title: "Handoff Latency",
    desc: "Time taken to parse document, transition state machine, and trigger RPA dispatch.",
    unit: "seconds",
    data: [
      { label: "Manual Processing", value: 920, color: "bg-slate-300" },
      { label: "Standard Python Agent", value: 320, color: "bg-slate-400" },
      { label: "Legacy RPA Flows", value: 180, color: "bg-indigo-400" },
      { label: "Amadeus Orchestrator", value: 15, color: "vibrant-rainbow-bg", active: true },
    ],
  },
  cost: {
    title: "Processing Cost per LC",
    desc: "Transactional overhead including API calls, tokens, and compute resources.",
    unit: "USD",
    data: [
      { label: "Manual Processing", value: 45.0, color: "bg-slate-300" },
      { label: "Standard Python Agent", value: 12.5, color: "bg-slate-400" },
      { label: "Legacy RPA Flows", value: 8.2, color: "bg-indigo-400" },
      { label: "Amadeus Orchestrator", value: 0.9, color: "vibrant-rainbow-bg", active: true },
    ],
  },
  compliance: {
    title: "Audit trail integrity",
    desc: "Cryptographic validation coverage of state mutations across systems.",
    unit: "% coverage",
    data: [
      { label: "Manual Processing", value: 15, color: "bg-slate-300" },
      { label: "Standard Python Agent", value: 40, color: "bg-slate-400" },
      { label: "Legacy RPA Flows", value: 75, color: "bg-indigo-400" },
      { label: "Amadeus Orchestrator", value: 100, color: "vibrant-rainbow-bg", active: true },
    ],
  },
};

// Import LC state machine — drives the live ticker
const LC_STEPS = [
  "submitted",
  "distributed_to_analyst",
  "doc_examined",
  "ee_ntf_created",
  "ee_ntf_approved",
  "mt_converted",
  "swift_released",
  "settled",
  "advised",
];

// Small count-up that animates once `start` is true and re-runs when value changes
function CountUp({ value, start, decimals = 0 }: { value: number; start: boolean; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const duration = 750;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, start]);

  return <>{display.toFixed(decimals)}</>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<keyof typeof BENCHMARKS>("handoff");
  const [tickerActive, setTickerActive] = useState(0);
  const [benchVisible, setBenchVisible] = useState(false);
  const benchRef = useRef<HTMLDivElement | null>(null);

  const currentBenchmark = BENCHMARKS[activeTab];
  const maxVal = Math.max(...currentBenchmark.data.map((d) => d.value));

  // Ticker: advance active step every 1.5s
  useEffect(() => {
    const id = setInterval(() => {
      setTickerActive((prev) => (prev + 1) % LC_STEPS.length);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Scroll reveal + benchmark viewport trigger for count-up
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-active");
          }
        });
      },
      { threshold: 0.1 }
    );
    const elements = document.querySelectorAll(".scroll-reveal");
    elements.forEach((el) => observer.observe(el));

    let benchObserver: IntersectionObserver | null = null;
    if (benchRef.current) {
      benchObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setBenchVisible(true);
          });
        },
        { threshold: 0.3 }
      );
      benchObserver.observe(benchRef.current);
    }

    return () => {
      observer.disconnect();
      benchObserver?.disconnect();
    };
  }, []);

  const gridApps = NAV_APPS.filter((a) => a.href !== "/agent-invoke");

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* Conversation Hero Asset — animation styles */}
      <style jsx global>{`
        @keyframes float-soft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        .float-soft { animation: float-soft 7s ease-in-out infinite; }
        .chat-msg { animation: msg-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .typing-dot { animation: typing-bounce 1.2s ease-in-out infinite; }

        .scroll-reveal {
          opacity: 0;
          transform: translateY(30px) scale(0.98);
          transition: all 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-active {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      `}</style>

      {/* Header */}
      <header className="h-16 border-b border-white/10 surface-dark sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
              <div className="absolute inset-[2px] bg-[#0a0a0a] rounded-md flex items-center justify-center">
                <img src="/amadeus.svg" alt="A" className="w-4.5 h-4.5 object-contain invert" />
              </div>
            </div>
            <span className="font-extrabold text-base tracking-tight text-white">Amadeus</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/dashboard" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/agents" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Agents</Link>
            <Link href="/tools" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Tools</Link>
            <Link href="/docs" className="text-sm font-medium text-white/60 hover:text-white transition-colors">Docs</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 bg-white text-black text-xs font-semibold py-2 px-4 rounded-lg hover:bg-white/90 transition-colors">
              Open Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section — full-bleed dark */}
      <section className="surface-dark relative py-20 md:py-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <p className="ui-label text-white/40">AMADEUS / CONVERSATIONAL ORCHESTRATION</p>

            <h1 className="display-hero text-5xl md:text-6xl lg:text-7xl text-white">
              Talk to Your Banking{" "}
              <span className="rainbow-underline">Agents</span>!
            </h1>

            <p className="text-[15px] text-slate-300 leading-relaxed max-w-lg">
              More than just a chatbot, Amadeus is a conversational orchestration platform for your banking operations. We prioritize Human Context Protocol (HCP), over Model Context Protocol (MCP).
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link href="/agent-invoke" className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors">
                Talk to an Agent <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-2 border border-white/20 text-white/70 px-6 py-3 text-sm font-medium rounded-lg hover:text-white hover:border-white/40 transition-colors">
                Read Blueprint
              </Link>
            </div>
          </div>

          {/* Right Column: Conversation with Banking Agents */}
          <div className="lg:col-span-6 flex justify-center relative min-h-[440px] items-center">
            {/* Ambient rainbow glow */}
            <div className="absolute w-80 h-80 rounded-full vibrant-rainbow-border opacity-[0.16] blur-[90px] pointer-events-none" />

            <div className="float-soft relative w-[380px] max-w-full">
              {/* Floating orchestration badge */}
              <div className="hidden lg:flex absolute -top-3 -right-3 z-20 items-center gap-2 surface-dark-elevated px-3 py-2 shadow-xl">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                </span>
                <span className="ui-label text-white/70">Orchestrating · 4 agents</span>
              </div>

              {/* Chat window */}
              <div className="surface-dark-elevated overflow-hidden shadow-2xl">
                {/* Header: agent roster */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {["🧾", "💳", "📡", "🛡️"].map((e, i) => (
                        <span
                          key={i}
                          className="w-8 h-8 rounded-full bg-[#1f1f1f] border border-white/10 flex items-center justify-center text-sm"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">Banking Agents</p>
                      <p className="ui-label text-emerald-400/80 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> 4 online
                      </p>
                    </div>
                  </div>
                  <span className="ui-label text-white/30">A2A</span>
                </div>

                {/* Messages */}
                <div className="p-5 space-y-4 bg-[#0d0d0d]">
                  {/* User */}
                  <div className="flex justify-end chat-msg" style={{ animationDelay: "0.15s" }}>
                    <div className="relative rounded-2xl rounded-tr-sm p-[1.5px] overflow-hidden max-w-[82%]">
                      <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
                      <div className="relative z-10 bg-[#0f0f0f] rounded-[13px] px-3.5 py-2.5">
                        <p className="text-[13px] text-white leading-relaxed">
                          Hi! Can you settle import LC #8F3A for me?
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agent: Doc Analyst */}
                  <div className="flex items-start gap-2.5 chat-msg" style={{ animationDelay: "0.6s" }}>
                    <span className="w-7 h-7 rounded-full bg-[#1f1f1f] border border-white/10 flex items-center justify-center text-sm flex-shrink-0">
                      🧾
                    </span>
                    <div className="max-w-[80%]">
                      <p className="ui-label text-white/40 mb-1">Doc Analyst</p>
                      <div className="bg-[#171717] border border-white/8 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                        <p className="text-[13px] text-slate-200 leading-relaxed">
                          Documents examined — everything checks out. ✓
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agent: Settlement Clerk */}
                  <div className="flex items-start gap-2.5 chat-msg" style={{ animationDelay: "1.0s" }}>
                    <span className="w-7 h-7 rounded-full bg-[#1f1f1f] border border-white/10 flex items-center justify-center text-sm flex-shrink-0">
                      💳
                    </span>
                    <div className="max-w-[80%]">
                      <p className="ui-label text-white/40 mb-1">Settlement Clerk</p>
                      <div className="bg-[#171717] border border-white/8 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                        <p className="text-[13px] text-slate-200 leading-relaxed">
                          MT202 drafted and{" "}
                          <span className="font-mono text-emerald-300">HMAC-signed</span>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agent: SWIFT Agent — typing */}
                  <div className="flex items-start gap-2.5 chat-msg" style={{ animationDelay: "1.4s" }}>
                    <span className="w-7 h-7 rounded-full bg-[#1f1f1f] border border-white/10 flex items-center justify-center text-sm flex-shrink-0">
                      📡
                    </span>
                    <div>
                      <p className="ui-label text-white/40 mb-1">SWIFT Agent</p>
                      <div className="bg-[#171717] border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center gap-1.5">
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0s" }} />
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.15s" }} />
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-400" style={{ animationDelay: "0.3s" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Faux input */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-white/6 bg-[#0d0d0d]">
                  <div className="flex-1 bg-[#1a1a1a] border border-white/8 rounded-full px-4 py-2 text-[13px] text-slate-500">
                    Message your agents…
                  </div>
                  <button className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                    <div className="absolute inset-0 vibrant-rainbow-bg" />
                    <Send className="relative z-10 w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Live Flow Ticker */}
      <section className="bg-[#fafafa] border-b border-slate-100 py-14">
        <div className="max-w-6xl mx-auto px-6">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <p className="ui-label text-slate-400 mb-2">Import LC State Machine</p>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Enterprise-Grade Agent Laboratory.</h2>
            </div>

            <div className="bg-white border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-3 flex flex-col sm:flex-row items-center gap-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center sm:text-left">We Support<br />A2A Communication</span>
              <div className="hidden sm:block w-px h-8 bg-slate-100" />
              <div className="flex items-center gap-5">
                {/* Power Automate Logo */}
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="Microsoft Power Automate">
                  <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 2L2 11L11 20L20 11L11 2Z" fill="#0078D4" />
                    <path d="M21 12L12 21L21 30L30 21L21 12Z" fill="#005A9E" />
                  </svg>
                  <span className="font-bold text-[14px] text-slate-800 tracking-tight">Power Automate</span>
                </div>
                {/* UiPath Logo */}
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="UiPath">
                  <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 13V24C5 26.2091 6.79086 28 9 28H19V19H12C10.3431 19 9 17.6569 9 16V13H5Z" fill="#141414" />
                    <rect x="19" y="4" width="8" height="8" rx="2" fill="#FA4616" />
                    <path d="M19 14H27V28H19V14Z" fill="#141414" />
                  </svg>
                  <span className="font-bold text-[14px] text-slate-800 tracking-tight">UiPath</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full h-[500px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
            <TransactionGraph
              tx={{
                current_step: LC_STEPS[tickerActive],
                status: tickerActive === LC_STEPS.length - 1 ? 'completed' : 'pending'
              }}
              events={[]}
            />
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Step transitions are append-only and cryptographically logged. Nodes are processed asynchronously by different MCP agents.
          </p>
        </div>
      </section>

      {/* Section 3: App Grid */}
      <section className="py-24 bg-[#fafafa] scroll-reveal">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="text-left space-y-2 max-w-xl">
            <p className="ui-label text-slate-400">Our Features</p>
            <h2 className="section-head text-3xl text-slate-900">
              Where Robots, Agents, and Humans collaborates.
            </h2>
            <p className="text-[15px] text-slate-500 leading-relaxed">
              Everything you need to orchestrate at scale
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-0">
            {gridApps.map(({ href, step, label, desc, icon: Icon, accent, bg }, index) => (
              <Link
                key={href}
                href={href}
                className="relative group rounded-2xl p-[1.5px] overflow-hidden transition-all duration-500 hover:-translate-y-1.5"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 group-hover:from-indigo-500 group-hover:via-purple-500 group-hover:to-pink-500 transition-colors duration-500 opacity-60 group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col h-full bg-white rounded-[14px] p-6 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shadow-inner`}>
                      <Icon className={`w-6 h-6 ${accent}`} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                      {step}
                    </span>
                  </div>

                  <h3 className="section-head text-[19px] text-slate-900 mb-2">{label}</h3>
                  <p className="text-[14px] text-slate-500 leading-relaxed flex-1">{desc}</p>

                  <div className={`mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${accent} opacity-70 group-hover:opacity-100 transition-opacity`}>
                    Explore <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Agent Invoke — featured full-width dark */}
          <div className="surface-dark rounded-2xl overflow-hidden border border-white/10">
            <div className="flex flex-col lg:flex-row items-stretch">
              <div className="flex-1 p-8 md:p-12 space-y-5">
                <p className="ui-label text-white/40">Featured Surface</p>
                <h3 className="section-head text-3xl text-white">Agent Invoke</h3>
                <p className="text-[15px] text-slate-300 leading-relaxed max-w-md">
                  Stream real-time agent reasoning over a selected transaction. Watch
                  MCP tool calls, state transitions, and telemetry flow through a
                  control panel built for ops — not a chat toy.
                </p>
                <Link href="/agent-invoke" className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors">
                  Launch Agent Console <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Mini terminal preview */}
              <div className="flex-1 p-8 md:p-12 flex items-center">
                <div className="terminal-card w-full overflow-hidden shadow-2xl">
                  <div className="terminal-card-header bg-[#111]">
                    <span className="terminal-dot bg-red-500" />
                    <span className="terminal-dot bg-yellow-500" />
                    <span className="terminal-dot bg-green-500" />
                    <span className="ui-label text-white/30 ml-2">Agent Invoke Console</span>
                  </div>
                  <div className="p-0 flex flex-col h-[320px] bg-[#0a0a0a]">
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 flex flex-col justify-end">
                      {/* User */}
                      <div className="flex justify-end stream-in" style={{ animationDelay: '0.1s' }}>
                        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl rounded-tr-sm px-4 py-2.5">
                          <p className="text-[13px] text-white">Execute settlement for LC #8F3A</p>
                        </div>
                      </div>

                      {/* Agent */}
                      <div className="flex items-start gap-3 stream-in" style={{ animationDelay: '0.3s' }}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                          <span className="text-white text-xs font-bold">AM</span>
                        </div>
                        <div className="space-y-3 w-full max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="ui-label text-white/40">Amadeus Orchestrator</span>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm">system</span>
                          </div>
                          <div className="text-[13px] text-slate-300 leading-relaxed font-sans">
                            I will now trigger the UiPath robot via MCP to execute the MT202 conversion.
                          </div>

                          {/* Tool Call Block */}
                          <div className="bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-lg">
                            <div className="px-3 py-2 border-b border-white/5 bg-[#171717] flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400 text-xs">⚙</span>
                                <span className="text-white/70 text-xs font-mono font-medium">execute_mcp_tool</span>
                              </div>
                              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Running...
                              </span>
                            </div>
                            <div className="p-3 bg-[#0d0d0d] font-mono text-[11.5px] text-white/50 leading-loose overflow-x-auto">
                              <span className="text-indigo-400">"server_name"</span>: <span className="text-amber-300">"mcp-uipath"</span>,<br />
                              <span className="text-indigo-400">"tool_name"</span>: <span className="text-amber-300">"trigger_job"</span>,<br />
                              <span className="text-indigo-400">"arguments"</span>: {"{"}<br />
                              &nbsp;&nbsp;<span className="text-indigo-400">"processName"</span>: <span className="text-amber-300">"MT202_Converter"</span>,<br />
                              &nbsp;&nbsp;<span className="text-indigo-400">"txId"</span>: <span className="text-amber-300">"8F3A"</span><br />
                              {"}"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Benchmarks — dark */}
      <section ref={benchRef} className="surface-dark py-24 border-y border-white/10">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-6">
            <div className="space-y-2">
              <p className="ui-label text-white/40">Benchmarks</p>
              <h3 className="section-head text-2xl text-white">Unrivaled efficiency &amp; compliance</h3>
              <p className="text-slate-400 text-[15px] leading-relaxed">
                We benchmarked Amadeus against legacy and pythonic orchestration
                solutions. Select a metric to visualize the delta.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              {(Object.keys(BENCHMARKS) as Array<keyof typeof BENCHMARKS>).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full text-left px-4 py-3 rounded-lg ui-label transition-all duration-150 ${activeTab === key
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                    }`}
                >
                  {activeTab === key && <span className="nav-active-indicator" />}
                  {BENCHMARKS[key].title}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 surface-dark-elevated p-8 space-y-6">
            <div>
              <h4 className="section-head text-white text-base">{currentBenchmark.title}</h4>
              <p className="text-slate-400 text-[13px] mt-1">{currentBenchmark.desc}</p>
            </div>

            <div className="space-y-5">
              {currentBenchmark.data.map((d) => (
                <div key={d.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className={d.active ? "text-white font-semibold" : "text-slate-400"}>{d.label}</span>
                    <span className="metric-value text-white">
                      <CountUp
                        value={d.value}
                        start={benchVisible}
                        decimals={currentBenchmark.unit === "USD" ? 1 : 0}
                      />{" "}
                      <span className="text-white/40 text-[11px]">{currentBenchmark.unit}</span>
                    </span>
                  </div>
                  <div className="w-full h-7 rounded-lg overflow-hidden bg-[#0a0a0a] border border-white/10 p-0.5">
                    <div
                      className={`h-full rounded-md transition-all duration-700 flex items-center justify-end px-2 ${d.active ? "vibrant-rainbow-bg" : "bg-[#2a2a2a] border border-white/10"
                        }`}
                      style={{ width: `${(d.value / maxVal) * 100}%` }}
                    >
                      {d.active && (
                        <span className="ui-label text-[8px] text-black/70">Active Stack</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Security / Compliance Strip — editorial spec sheet */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="ui-label text-slate-400 mb-8">Compliance &amp; Security Controls</p>
          <div className="border-t border-slate-200">
            {[
              { icon: ShieldCheck, name: "ISO 27001 Ready", note: "Information security management aligned to certification controls." },
              { icon: Lock, name: "HMAC-SHA512", note: "Financial step transitions are request-signed and tamper-evident." },
              { icon: Server, name: "Air-Gapped Node", note: "On-premise deployment with zero outbound database exposure." },
              { icon: FileCheck, name: "OJK / BI Compliant", note: "Meets Indonesian regulatory requirements for trade finance." },
              { icon: Database, name: "Immutable Audit", note: "Append-only ledger with cryptographic proof of every mutation." },
            ].map(({ icon: Icon, name, note }, i) => (
              <div
                key={name}
                className="grid grid-cols-12 gap-4 items-center py-5 border-b border-slate-200"
              >
                <div className="col-span-2 md:col-span-1">
                  <span className="metric-value text-slate-300 text-lg">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="col-span-10 md:col-span-4 flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="section-head text-[15px] text-slate-900">{name}</span>
                </div>
                <div className="col-span-12 md:col-span-7 text-[14px] text-slate-500 leading-relaxed">
                  {note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* System Architecture at a Glance */}
      <section className="py-24 bg-[#fafafa] border-y border-slate-100 scroll-reveal">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          <div className="text-left space-y-2 max-w-xl">
            <p className="ui-label text-slate-400">System Map</p>
            <h2 className="section-head text-3xl text-slate-900">Architecture at a glance</h2>
            <p className="text-slate-500 text-[15px] leading-relaxed">
              Two systems live in this codebase: the actively-developed LC settlement
              stack, and a separate Supabase-backed agent platform it grew alongside.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LC Settlement Stack */}
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <h3 className="section-head text-lg text-slate-900">LC Settlement Orchestrator Stack</h3>
                </div>
                <p className="text-[15px] text-slate-500 leading-relaxed">
                  A 9-step state machine for Import LC/SKBDN/SBLC settlement, with a
                  cost-aware router that picks the cheapest of an LLM, PAD, or UiPath
                  executor per step — and HMAC-signed financial steps.
                </p>
                <ul className="space-y-1.5 text-xs font-mono text-slate-600">
                  <li><span className="text-blue-600 font-bold">transaction_tracker</span> — Fastify + Postgres, :8080</li>
                  <li><span className="text-blue-600 font-bold">amadeus-mcp</span> — 8 MCP tools, SSE :10002</li>
                  <li><span className="text-blue-600 font-bold">mcp-uipath</span> — real UiPath Cloud OAuth2, SSE :10001</li>
                  <li><span className="text-blue-600 font-bold">this console</span> — Next.js, :3000</li>
                </ul>
                <Link href="/docs/lc-settlement-stack" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-1">
                  Read the settlement stack docs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Legacy Agent Platform */}
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-violet-600" />
                  <h3 className="section-head text-lg text-slate-900">Agent Platform (Legacy)</h3>
                </div>
                <p className="text-[15px] text-slate-500 leading-relaxed">
                  A general-purpose &quot;describe an agent in plain text, wire up MCP
                  tools, run it&quot; platform that predates the settlement stack, backed by
                  one shared Supabase project.
                </p>
                <ul className="space-y-1.5 text-xs font-mono text-slate-600">
                  <li><span className="text-violet-600 font-bold">app.py</span> — Combined FastAPI API, :8080</li>
                  <li><span className="text-violet-600 font-bold">agent_backend / agent_creator</span> — agent CRUD + NL builder</li>
                  <li><span className="text-violet-600 font-bold">agent_boilerplate</span> — LangGraph runtime, MultiServerMCPClient</li>
                  <li><span className="text-violet-600 font-bold">mcp_tools / mcp_2</span> — MCP process managers</li>
                </ul>
                <Link href="/docs/agent-platform-legacy" className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 pt-1">
                  Read the agent platform docs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          <div className="flex justify-start">
            <Link href="/docs/architecture-overview" className="btn-secondary px-5 py-2.5 text-sm bg-white">
              <BookOpen className="w-4 h-4" /> Full architecture documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Section 6: Footer */}
      <div className="rainbow-bar" />
      <footer className="surface-dark py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs font-mono gap-4">
          <span className="text-white/50">Amadeus Orchestrator — Bank Mandiri Trade Finance Ops</span>
          <Link href="/docs" className="text-white/50 hover:text-white transition-colors">Docs →</Link>
        </div>
      </footer>
    </div>
  );
}
