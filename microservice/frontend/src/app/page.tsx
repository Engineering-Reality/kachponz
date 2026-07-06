"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  Clock,
  Coins,
  FileSignature,
  Layers,
} from "lucide-react";

const NAV_APPS = [
  {
    href: "/dashboard",
    label: "Transaction Tracker",
    desc: "Monitor live state machine transitions for LC settlement.",
    icon: Activity,
    accent: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/agents",
    label: "Agent Matrix",
    desc: "Manage and configure your AI agent registry.",
    icon: Bot,
    accent: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    href: "/tools",
    label: "MCP Tool Registry",
    desc: "Register and monitor connected MCP tool servers.",
    icon: Wrench,
    accent: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    href: "/agent-creator",
    label: "Agent Creator",
    desc: "Design new agents from natural language descriptions.",
    icon: Wand2,
    accent: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    href: "/agent-invoke",
    label: "Agent Invoke",
    desc: "Stream real-time agent reasoning over a selected transaction.",
    icon: Zap,
    accent: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  {
    href: "/docs",
    label: "Documentation",
    desc: "Architecture guides, cURL references, and A2A protocol specs.",
    icon: BookOpen,
    accent: "text-emerald-600",
    bg: "bg-emerald-50",
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<keyof typeof BENCHMARKS>("handoff");

  const currentBenchmark = BENCHMARKS[activeTab];
  const maxVal = Math.max(...currentBenchmark.data.map(d => d.value));

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

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* 3D A2A CTO Layers Animation Styles */}
      <style jsx global>{`
        @keyframes float-stack {
          0% { transform: rotateX(55deg) rotateZ(-35deg) translateY(0px); }
          50% { transform: rotateX(55deg) rotateZ(-35deg) translateY(-12px); }
          100% { transform: rotateX(55deg) rotateZ(-35deg) translateY(0px); }
        }
        @keyframes packet-flow-down {
          0% { transform: translateZ(90px) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateZ(-90px) scale(0.8); opacity: 0; }
        }
        @keyframes packet-flow-up {
          0% { transform: translateZ(-90px) scale(0.8); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateZ(90px) scale(1); opacity: 0; }
        }
        .stack-container {
          perspective: 1200px;
          transform-style: preserve-3d;
        }
        .stack-wrapper {
          transform-style: preserve-3d;
          animation: float-stack 8s ease-in-out infinite;
          width: 320px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .stack-layer {
          position: absolute;
          width: 320px;
          height: 85px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1.5px solid rgba(226, 232, 240, 0.8);
          border-radius: 16px;
          box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.6);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          transform-style: preserve-3d;
          display: flex;
          align-items: center;
          padding: 16px;
          cursor: pointer;
        }
        .stack-layer-1 {
          transform: translateZ(90px);
          border-color: rgba(168, 85, 247, 0.3); /* Purple */
          box-shadow: 0 10px 30px -10px rgba(168, 85, 247, 0.1), inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .stack-layer-2 {
          transform: translateZ(0px);
          border-color: rgba(59, 130, 246, 0.3); /* Blue */
          box-shadow: 0 10px 30px -10px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .stack-layer-3 {
          transform: translateZ(-90px);
          border-color: rgba(236, 72, 153, 0.3); /* Pink */
          box-shadow: 0 10px 30px -10px rgba(236, 72, 153, 0.1), inset 0 1px 0 rgba(255,255,255,0.6);
        }
        .stack-layer:hover {
          background: rgba(255, 255, 255, 0.85);
          box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.12);
        }
        .stack-layer-1:hover {
          transform: translateZ(105px) scale(1.02);
        }
        .stack-layer-2:hover {
          transform: translateZ(0px) scale(1.04);
        }
        .stack-layer-3:hover {
          transform: translateZ(-105px) scale(1.02);
        }
        /* Flow line in center */
        .flow-line {
          position: absolute;
          width: 2px;
          height: 220px;
          background: linear-gradient(to bottom, rgba(168, 85, 247, 0.4), rgba(59, 130, 246, 0.4), rgba(236, 72, 153, 0.4));
          transform: translateZ(-100px);
          z-index: 1;
        }
        /* Flow packets */
        .flow-packet-down {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 12px #3b82f6, 0 0 4px #3b82f6;
          animation: packet-flow-down 3s infinite linear;
          z-index: 2;
        }
        .flow-packet-up {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a855f7;
          box-shadow: 0 0 10px #a855f7;
          animation: packet-flow-up 4s infinite linear;
          animation-delay: 2s;
          z-index: 2;
        }
        /* Scroll-Reveal transition utilities */
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

      {/* Top Banner */}
      <div className="w-full bg-[#fafafa] border-b border-slate-100 py-2 text-center text-[11px] font-mono font-medium text-slate-500 flex items-center justify-center gap-2">
        <span className="status-dot online animate-pulse" />
        amadeus.a2a/1 — Enterprise Trade Finance Node Live
      </div>

      {/* Header */}
      <header className="h-16 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
              <div className="absolute inset-[2px] bg-white rounded-md flex items-center justify-center">
                <img src="/amadeus.svg" alt="A" className="w-4.5 h-4.5 object-contain" />
              </div>
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">Amadeus</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Dashboard</Link>
            <Link href="/agents" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Agents</Link>
            <Link href="/tools" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Tools</Link>
            <Link href="/docs" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">Docs</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn-primary text-xs py-2 px-4 shadow-sm">
              Open Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-b from-white to-[#fafafa]">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-mono font-bold text-slate-500 tracking-wider uppercase shadow-sm">
              <Cpu className="w-3.5 h-3.5 text-blue-500" /> agent-to-agent protocol
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.05]">
              Agentic Transaction Orchestration for{" "}
              <span className="vibrant-rainbow-text">Trade Finance</span>
            </h1>

            <p className="text-base text-slate-500 leading-relaxed max-w-lg">
              Coordinate autonomous agents and RPA robots through secure, immutable state transitions for Import LC and SKBDN settlements. Enforce strict step-flow compliance with automated ledger logging and zero database exposure.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link href="/dashboard" className="btn-primary px-6 py-3 text-sm shadow-sm">
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/docs" className="btn-secondary px-6 py-3 text-sm bg-white">
                Read Blueprint
              </Link>
            </div>
          </div>

          {/* Right Column: 3D Layers Stack & Flow */}
          <div className="lg:col-span-6 flex justify-center relative min-h-[400px] items-center">
            {/* Column Background Graphic */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 select-none pointer-events-none">
              <div className="grid grid-cols-7 gap-2 items-end transform rotate-12 scale-110">
                <div className="w-6 h-12 bg-amber-400 rounded-sm"></div>
                <div className="w-6 h-20 bg-orange-400 rounded-sm"></div>
                <div className="w-6 h-32 bg-pink-400 rounded-sm"></div>
                <div className="w-6 h-40 bg-violet-400 rounded-sm"></div>
                <div className="w-6 h-32 bg-blue-400 rounded-sm"></div>
                <div className="w-6 h-20 bg-cyan-400 rounded-sm"></div>
                <div className="w-6 h-12 bg-emerald-400 rounded-sm"></div>
              </div>
            </div>

            {/* 3D CTO Layer Stack Container */}
            <div className="stack-container relative w-96 h-96 flex items-center justify-center">
              
              <div className="stack-wrapper">
                
                {/* Center Flow Elements */}
                <div className="flow-line"></div>
                <div className="flow-packet-down"></div>
                <div className="flow-packet-up"></div>

                {/* Top Layer: Interaction */}
                <div className="stack-layer stack-layer-1">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 border border-purple-100 flex-shrink-0 mr-4">
                    <Bot className="w-5.5 h-5.5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">Interaction Layer</p>
                      <span className="badge badge-blue text-[7px] px-1 py-0">VLM & Agent UI</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Qwen-14B / User Decision Gate</p>
                  </div>
                </div>

                {/* Middle Layer: Orchestration */}
                <div className="stack-layer stack-layer-2">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100 flex-shrink-0 mr-4">
                    <Cpu className="w-5.5 h-5.5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">Orchestration Layer</p>
                      <span className="badge badge-green text-[7px] px-1 py-0">Amadeus Core</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Immutable State Machine / PostgreSQL</p>
                  </div>
                </div>

                {/* Bottom Layer: Execution */}
                <div className="stack-layer stack-layer-3">
                  <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center text-pink-600 border border-pink-100 flex-shrink-0 mr-4">
                    <Wrench className="w-5.5 h-5.5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">Execution Layer</p>
                      <span className="badge badge-orange text-[7px] px-1 py-0">RPA Robot Handoff</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">UiPath Trigger / SendGrid Mailer</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client Logos / Trust Badges */}
      <section className="py-8 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-between items-center gap-8">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Compliance & Security Standards</span>
            <div className="flex flex-wrap items-center gap-8">
              {[
                { icon: ShieldCheck, text: "ISO 27001 Ready" },
                { icon: Lock, text: "HMAC-SHA512" },
                { icon: Server, text: "Air-Gapped Node" },
                { icon: FileCheck, text: "OJK / BI Compliant" },
                { icon: Database, text: "Immutable Audit" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                  <Icon className="w-4 h-4 text-slate-300" />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="py-16 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tight text-blue-600 bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">50k+</p>
            <p className="text-sm font-semibold text-slate-900">Transactions Orchestrated</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">LC and SKBDN state machine transitions validated and locked.</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tight text-violet-600 bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">99.9%</p>
            <p className="text-sm font-semibold text-slate-900">SLA Compliance (Zero Drift)</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">Deterministic execution paths prevent state machine deviations.</p>
          </div>
          <div className="space-y-2">
            <p className="text-5xl font-black tracking-tight text-orange-600 bg-gradient-to-r from-orange-600 to-yellow-500 bg-clip-text text-transparent">15s</p>
            <p className="text-sm font-semibold text-slate-900">End-to-End Latency</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">From unstructured document receipt to verified RPA robot handoff.</p>
          </div>
        </div>
      </section>

      {/* Agentic Settlement Showcase */}
      <section className="py-24 bg-white scroll-reveal">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-left space-y-2">
            <span className="badge badge-blue">Feature Showcase</span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Agentic Settlement & Verification</h2>
            <p className="text-slate-500 text-sm max-w-xl">
              Turn complex layouts and documents into structured database state transitions without exposing mainframes.
            </p>
          </div>

          {/* Big Featured Card */}
          <div className="relative group rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md p-8 md:p-12 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm hover:shadow-md transition-all duration-500">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500 rounded-2xl blur opacity-0 group-hover:opacity-10 transition duration-500 pointer-events-none"></div>
            <div className="relative z-10 max-w-md space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Immutable State Verification</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                By tracking step transitions in an append-only transaction ledger, Amadeus ensures that VLM agents and RPA executables move through Import LC and SKBDN settlements deterministically and with auditable cryptographic proof.
              </p>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                Learn more in Docs <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
            {/* Flat vector graphic representation */}
            <div className="relative z-10 w-72 h-44 rounded-xl border border-slate-200 bg-white shadow-lg p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Transaction State Machine</span>
                <span className="status-dot online" />
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-slate-100 rounded w-3/4"></div>
                <div className="h-2 bg-slate-100 rounded w-1/2"></div>
                <div className="h-2 bg-slate-100 rounded w-5/6"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="badge badge-slate text-[9px]">A2A Payload</span>
                <span className="text-[10px] font-mono font-bold text-slate-800">{"{ step: 'verifying', status: 'authorized' }"}</span>
              </div>
            </div>
          </div>

          {/* Three columns layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative group rounded-xl border border-slate-200/60 p-6 space-y-3 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-500">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500 rounded-xl blur opacity-0 group-hover:opacity-10 transition duration-500 pointer-events-none"></div>
              <div className="relative z-10 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                  <Cpu className="w-4.5 h-4.5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Agent Orchestrator</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Let autonomous LLMs reason about document data, extract structured attributes, and recommend transitions.
                </p>
              </div>
            </div>
            <div className="relative group rounded-xl border border-slate-200/60 p-6 space-y-3 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-500">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500 rounded-xl blur opacity-0 group-hover:opacity-10 transition duration-500 pointer-events-none"></div>
              <div className="relative z-10 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-500">
                  <Bot className="w-4.5 h-4.5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">RPA Handoff Gate</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Dispatch execution payloads directly to UiPath robot queues once compliance criteria are cryptographically met.
                </p>
              </div>
            </div>
            <div className="relative group rounded-xl border border-slate-200/60 p-6 space-y-3 bg-white/70 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-500">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500 rounded-xl blur opacity-0 group-hover:opacity-10 transition duration-500 pointer-events-none"></div>
              <div className="relative z-10 space-y-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">CISO Compliance Gate</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enforce service account checks, API request signing, and optimistic locking to guarantee total state protection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Performance Benchmarks */}
      <section className="py-24 bg-[#fafafa] border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Selector Tab Column */}
          <div className="lg:col-span-4 space-y-6">
            <div className="space-y-2">
              <span className="badge badge-slate">Benchmarks</span>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Unrivaled efficiency & compliance</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                We benchmarked Amadeus against legacy and pythonic orchestration solutions. Select a metric to visualize the delta.
              </p>
            </div>
            
            <div className="flex flex-col gap-1.5">
              {(Object.keys(BENCHMARKS) as Array<keyof typeof BENCHMARKS>).map(key => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
                    activeTab === key
                      ? "bg-white border border-slate-200 text-slate-900 shadow-sm"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {BENCHMARKS[key].title}
                </button>
              ))}
            </div>
          </div>

          {/* Right Bar Charts Column */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-8 space-y-6 shadow-sm">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{currentBenchmark.title}</h4>
              <p className="text-slate-500 text-xs mt-1">{currentBenchmark.desc}</p>
            </div>

            <div className="space-y-5">
              {currentBenchmark.data.map(d => (
                <div key={d.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{d.label}</span>
                    <span className="font-mono">
                      {d.value} {currentBenchmark.unit}
                    </span>
                  </div>
                  <div className="w-full h-7 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 p-0.5">
                    <div
                      className={`h-full rounded-md transition-all duration-500 flex items-center justify-end px-2 ${d.color}`}
                      style={{ width: `${(d.value / maxVal) * 100}%` }}
                    >
                      {d.active && (
                        <span className="text-[9px] font-bold text-white uppercase tracking-wider animate-pulse">
                          Active Stack
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Surface apps navigation grid */}
      <section className="py-24 bg-white scroll-reveal">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Everything you need to orchestrate at scale</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Six integrated surfaces, one unified system.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {NAV_APPS.map(({ href, label, desc, icon: Icon, accent, bg }) => (
              <Link
                key={href}
                href={href}
                className="relative group flex flex-col bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-pink-500 to-amber-500 rounded-xl blur opacity-0 group-hover:opacity-10 transition duration-500 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col h-full">
                  <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className={`w-5 h-5 ${accent}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{label}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed flex-1">{desc}</p>
                  <div className={`mt-4 flex items-center gap-1 text-xs font-semibold ${accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-4">
          <span>Amadeus Orchestrator © 2026 — Bank Mandiri Internal</span>
          <span>a2a/1 · OJK / BI Compliant · Air-Gapped Node</span>
        </div>
      </footer>
    </div>
  );
}
