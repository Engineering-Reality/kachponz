"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TransactionGraph } from "@/components/TransactionGraph";
import { ParticleBackground } from "@/components/ParticleBackground";
import { SpectralText } from "@/components/SpectralText";
import {
  ShieldCheck,
  Lock,
  Server,
  FileCheck,
  Database,
  ArrowRight,
  BookOpen,
  Cpu,
  Layers,
  Send,
  ChevronDown,
  Bot,
  Monitor,
  Plug
} from "lucide-react";
import { FiUser, FiCpu, FiTool } from "react-icons/fi";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ParticleGlowText } from "@/components/ParticleGlowText";
import { FeatureShowcase } from "@/components/FeatureShowcase";
import { BenchmarkSection } from "@/components/BenchmarkSection";
import { AuroraBackground } from "@/components/AuroraBackground";
import { AuroraDivider } from "@/components/AuroraDivider";
import { AuroraThread } from "@/components/AuroraThread";

const EMPTY_EVENTS: any[] = [];

const FAQ_DATA = [
  {
    question: "What does Amadeus do?",
    answer: "Amadeus is an enterprise orchestration platform that seamlessly combines Humans, AI Agents, and Robotic Process Automation (RPA). It acts as the brain that directs work across your existing legacy systems and modern APIs, allowing you to orchestrate end-to-end banking operations autonomously."
  },
  {
    question: "Who is Amadeus for?",
    answer: "Amadeus is built for operations teams, financial analysts, and enterprises running production workflows. If your company relies on RPA tools like Power Automate, UiPath, Automation Anywhere, or PAD, Amadeus allows you to supercharge those bots with intelligent, agentic decision-making."
  },
  {
    question: "Why integrate AI Agents with RPA?",
    answer: "Many legacy banking applications do not expose modern APIs and cannot be accessed via simple API keys. By integrating AI agents with RPA, Amadeus can read screens, click buttons, and operate legacy software autonomously, bridging the gap between intelligent reasoning and legacy financial systems."
  },
  {
    question: "How does Amadeus handle regulatory compliance?",
    answer: "We prioritize precise state execution over conversational fluff. Every step transition in our orchestrator is append-only, cryptographically logged, and HMAC-signed, ensuring full OJK and BI compliance for strict financial processes like Trade Finance settlement."
  },
  {
    question: "Can Amadeus reduce processing costs and latency?",
    answer: "Yes. By offloading repetitive manual tasks (like document extraction and legacy data entry) to a coordinated team of AI and RPA agents, you significantly lower transaction latency and operational costs, while allowing human analysts to focus entirely on complex exception handling."
  }
];

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

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [tickerActive, setTickerActive] = useState(0);

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

    setTimeout(() => {
      const h1 = document.querySelector("h1");
      const p = document.querySelector("h1 + p");
      document.title = `bw=${document.body.scrollWidth} iw=${window.innerWidth} h1w=${h1?.scrollWidth} pw=${p?.scrollWidth} h1cw=${h1?.clientWidth}`;
    }, 500);

    return () => {
      observer.disconnect();
    };
  }, []);



  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden w-full max-w-[100vw]">
      <MarketingHeader />

      {/* Hero Section — Redesigned Centered */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden flex flex-col items-center justify-center text-center">
        {/* Aurora Thread — hero mesh variant */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[900px] h-[700px] md:h-[900px] z-0">
          <AuroraThread variant="mesh" />
        </div>

        <div className="max-w-5xl mx-auto px-6 relative z-10 flex flex-col items-center">
          <h1 className="display-hero text-[2.5rem] md:text-5xl lg:text-6xl xl:text-7xl tracking-tight leading-[1.1] mb-8 font-light flex flex-col md:flex-row flex-wrap justify-center items-center gap-y-2 md:gap-y-0 gap-x-2 md:gap-x-5 w-full">
            <span className="w-full md:w-auto text-center bg-gradient-to-br from-slate-900 via-slate-700 to-black dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent pb-1 drop-shadow-md">Human <ParticleGlowText text="Whoops," className="italic ml-1 md:ml-2" /></span>
            <span className="w-full md:w-auto text-center bg-gradient-to-br from-slate-800 via-slate-600 to-slate-900 dark:from-slate-100 dark:via-slate-300 dark:to-slate-500 bg-clip-text text-transparent pb-1 drop-shadow-md">Agent <ParticleGlowText text="Loops," className="italic ml-1 md:ml-2" /></span>
            <span className="w-full md:w-auto text-center bg-gradient-to-br from-slate-700 via-slate-500 to-slate-800 dark:from-slate-200 dark:via-slate-400 dark:to-slate-600 bg-clip-text text-transparent pb-1 drop-shadow-md">Robot <ParticleGlowText text="Shoots." className="italic ml-1 md:ml-2" /></span>
          </h1>

          <p className="text-[17px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mb-8">
            The only enterprise-grade orchestration platform built specifically to target the Robotic Process Automation market. Seamlessly coordinate human analysts, intelligent AI agents, and legacy RPA bots to fully automate your complex operations.
          </p>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-4 mb-12 w-full max-w-[280px] md:max-w-none">
            <Link href="/playground" className="inline-flex justify-center items-center gap-2 bg-fuchsia-600/90 text-white px-8 py-4 text-[15px] font-medium rounded-full hover:bg-fuchsia-500 transition-colors shadow-[0_0_24px_rgba(217,70,239,0.3)] w-full md:w-auto ring-1 ring-fuchsia-500/50">
              Experience Agent Playground <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#demo" className="inline-flex justify-center items-center gap-2 border border-slate-700/50 text-slate-200 px-8 py-4 text-[15px] font-medium rounded-full hover:bg-slate-800/50 transition-colors bg-slate-900/40 backdrop-blur shadow-sm w-full md:w-auto">
              Watch Demo
            </Link>
          </div>

          {/* Playground / Danantara Mockup */}
          <div className="w-full max-w-6xl relative group mx-auto mt-4">
            {/* Glossy overlay reflection */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-[1.5rem] pointer-events-none z-20" />
            
            <div className="bg-[#FAFAFA] border border-slate-200 rounded-[1.5rem] overflow-hidden shadow-2xl shadow-slate-900/10 flex flex-col md:flex-row relative z-10 transition-transform duration-500 group-hover:-translate-y-2 min-h-[500px] md:min-h-0 md:h-[600px] text-left">
              
              {/* Left Column: Chat Console */}
              <div className="flex-1 flex flex-col border-r border-slate-200 bg-white relative">
                
                {/* Console Header */}
                <div className="border-b border-slate-200 bg-white flex flex-col w-full shrink-0 min-w-0">
                  <div className="h-10 flex items-center justify-between px-4 md:px-6 border-b border-slate-100 bg-slate-50/80">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5 mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                      <span className="ui-label text-slate-500 font-semibold tracking-widest text-[10px]">Amadeus Console</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="ui-label text-slate-500 text-[10px]">UPLINK: STABLE</span>
                    </div>
                  </div>
                  
                  {/* Controls Row */}
                  <div className="px-4 md:px-6 py-2.5 flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-hide w-full max-w-full">
                    <div className="flex items-center gap-3 shrink-0">
                      <label className="ui-label text-slate-400 text-[9px]">Active Node</label>
                      <div className="text-[11px] font-medium text-slate-700 bg-slate-100 px-3 py-1 rounded">TradeFinance_Bot</div>
                    </div>
                    <div className="w-px h-4 bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-3 shrink-0">
                      <label className="ui-label text-slate-400 text-[9px]">Target</label>
                      <div className="text-[11px] font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded">Danantara CX 100</div>
                    </div>
                    <div className="w-px h-4 bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="ui-label text-slate-400 text-[9px]">Loop Mode</label>
                      <div className="relative w-8 h-4 rounded-full bg-indigo-600">
                        <span className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow translate-x-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Log */}
                <div className="flex-1 overflow-y-auto md:overflow-y-hidden overflow-x-hidden p-4 md:p-6 space-y-6 w-full">
                  {/* User Message */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
                      <span className="text-white text-xs">US</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13px] text-slate-900 mb-1">User</p>
                      <p className="text-[13px] text-slate-700 break-words whitespace-pre-wrap">Please process LC Settlement #4012 on Danantara CX 100. Fallback to vision extraction if DOM selectors fail.</p>
                    </div>
                  </div>

                  {/* System Log */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 text-[10px]">⚙️</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13px] text-slate-900 mb-1">System</p>
                      <p className="text-[13px] text-slate-500 font-mono break-words whitespace-pre-wrap">[Agent Call] Using tool execute_cx100_bot( {"{"} "target": "LC_Settlement", "loop_mode": true {"}"} )</p>
                    </div>
                  </div>

                  {/* Assistant Message */}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-pink-500 flex items-center justify-center shrink-0 shadow-md">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13px] text-slate-900 mb-1">Amadeus</p>
                      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 md:p-4 space-y-3 w-full">
                        <p className="text-[13px] text-slate-700 break-words whitespace-pre-wrap">Connecting to Danantara CX 100... Established HMAC-SHA512 session.</p>
                        <div className="space-y-1">
                          <p className="text-[12px] text-slate-500 font-mono break-words whitespace-pre-wrap">Iteration 1: Searching for DOM Selector 'Submit_Btn'...</p>
                          <p className="text-[12px] text-red-500 font-mono break-words whitespace-pre-wrap">SelectorNotFound. Loop mode triggered.</p>
                          <p className="text-[12px] text-slate-500 font-mono break-words whitespace-pre-wrap">Iteration 2: Engaging Vision Agent for spatial coordinate mapping...</p>
                          <p className="text-[12px] text-green-600 font-mono font-medium break-words whitespace-pre-wrap">Coordinate mapped at (X: 1042, Y: 430). Click simulated.</p>
                        </div>
                        <p className="text-[13px] text-slate-700 font-medium break-words whitespace-pre-wrap">LC Settlement processed successfully using Agent Loop.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Input */}
                <div className="p-4 bg-white border-t border-slate-100">
                  <div className="relative flex items-center">
                    <input type="text" disabled placeholder="Type a command..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] focus:outline-none" />
                    <button className="absolute right-2 p-1.5 bg-slate-900 rounded-lg shadow-sm">
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Context Panel */}
              <div className="w-[40%] hidden lg:flex flex-col bg-slate-50 relative">
                <div className="h-10 flex items-center px-6 border-b border-slate-200 bg-slate-100/50">
                  <span className="ui-label text-slate-500 text-[10px]">Agent Context / Live Graph</span>
                </div>
                
                <div className="flex-1 p-6 flex flex-col gap-6">
                  {/* Visual Node Graph */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="ui-label text-slate-400 mb-4 text-[9px] text-center">AUTONOMOUS EXECUTION GRAPH</p>
                    <div className="relative flex items-center justify-between px-2 h-[100px]">
                      {/* Lines */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                        <path d="M 40,50 L 140,50" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" className="animate-pulse" />
                        <path d="M 140,40 Q 90,0 40,40" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                        <path d="M 40,60 Q 90,100 140,100" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                        <path d="M 170,100 Q 200,75 170,50" stroke="#3b82f6" strokeWidth="2" fill="none" />
                        <polygon points="167,50 173,55 173,45" fill="#3b82f6" />
                      </svg>
                      {/* Nodes */}
                      <div className="relative z-10 flex flex-col items-center group">
                        <div className="w-12 h-12 rounded-[0.8rem] bg-white border border-pink-200 flex items-center justify-center text-lg shadow-sm">🧠</div>
                        <span className="font-mono text-[8px] text-pink-600 mt-2">Orchestrator</span>
                      </div>
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-[0.8rem] bg-red-50 border border-red-200 flex items-center justify-center text-lg shadow-sm">🤖</div>
                        <span className="font-mono text-[8px] text-red-600 mt-2">UiPath Bot</span>
                      </div>
                      <div className="relative z-10 flex flex-col items-center translate-y-[25px]">
                        <div className="w-12 h-12 rounded-[0.8rem] bg-white border border-blue-200 flex items-center justify-center text-lg shadow-sm">👁️</div>
                        <span className="font-mono text-[8px] text-blue-600 mt-2">Vision Agent</span>
                      </div>
                    </div>
                  </div>

                  {/* Robot Logs / Metrics */}
                  <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 p-5 font-mono text-[11px] text-slate-300 shadow-inner overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                      <span className="text-slate-400">ROBOT EXECUTION TRAIL</span>
                      <span className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE</span>
                    </div>
                    <div className="space-y-2 opacity-90">
                      <div className="flex gap-2"><span className="text-pink-500">10:42:01</span><span className="text-blue-400">[CX-100]</span> <span>Ping received.</span></div>
                      <div className="flex gap-2"><span className="text-pink-500">10:42:02</span><span className="text-blue-400">[CX-100]</span> <span className="text-slate-500">Extracting DOM structure...</span></div>
                      <div className="flex gap-2"><span className="text-pink-500">10:42:03</span><span className="text-yellow-400">[WARN]</span> <span className="text-red-400">Selector mismatch.</span></div>
                      <div className="flex gap-2"><span className="text-pink-500">10:42:03</span><span className="text-blue-400">[ORCH]</span> <span>Triggering Vision Agent mapping.</span></div>
                      <div className="flex gap-2"><span className="text-pink-500">10:42:05</span><span className="text-blue-400">[VISN]</span> <span className="text-emerald-400">Map success (X:1042, Y:430)</span></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom Fade to blend into next section */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />
      </section>

      <AuroraThread variant="divider" />

      {/* Section 1.5: The Philosophy */}
      <section className="bg-transparent py-24 scroll-reveal relative z-10">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 space-y-16">
          
          {/* Row 1: The Thesis (Asymmetric 65/35) */}
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
            <div className="w-full lg:w-[65%]">
              <p className="ui-label text-cyan-500 mb-6">The Philosophy</p>
              <div className="relative pl-8 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-gradient-to-b before:from-cyan-400 before:via-fuchsia-500 before:to-yellow-400">
                <h3 className="text-[clamp(1.5rem,3vw,2.2rem)] font-semibold text-foreground leading-snug tracking-tight">
                  AI doesn't fix a disorganized company—it turns your disorganization into a system. We built Amadeus to bridge the critical gap between humans, intelligent agents, and rigid robots.
                </h3>
              </div>
            </div>
            
            {/* Abstract SVG Composition (35%) */}
            <div className="w-full lg:w-[35%] flex justify-center relative">
              <div className="relative w-64 h-64">
                <div className="absolute inset-0 border border-fuchsia-500/20 rounded-full animate-spin-slow opacity-50" style={{ animationDuration: '20s' }} />
                <div className="absolute inset-4 border border-cyan-400/30 rounded-full animate-reverse-spin opacity-50" style={{ animationDuration: '25s' }} />
                <div className="absolute inset-8 border border-yellow-400/20 rounded-full animate-spin-slow opacity-50" style={{ animationDuration: '15s' }} />
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 via-fuchsia-500/10 to-yellow-500/5 rounded-full blur-2xl" />
              </div>
            </div>
          </div>

          {/* Row 2: The Three Actors */}
          <div className="w-full bg-white dark:bg-[#1E1B4B] rounded-3xl border border-slate-200 dark:border-slate-800/50 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col">
              {[
                {
                  icon: FiUser,
                  title: "Humans",
                  desc: "Want automation. Demand compliance.",
                },
                {
                  icon: FiCpu,
                  title: "AI Agents",
                  desc: "Connect via MCP. High automation — compliance trade-off.",
                },
                {
                  icon: FiTool,
                  title: "Robots (RPA)",
                  desc: "Operate via UI. High compliance — flexibility trade-off.",
                }
              ].map((item, idx) => (
                <div key={item.title} className={`p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6 relative group ${idx !== 2 ? 'border-b border-b-slate-100 dark:border-b-[rgba(217,70,239,0.15)]' : ''}`}>
                  {/* Subtle hover gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/0 via-fuchsia-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  
                  <div className="flex items-center gap-6 md:w-1/3 flex-shrink-0 relative z-10">
                    <item.icon className="w-6 h-6 text-[#d946ef]" />
                    <h4 className="text-xl font-bold text-foreground tracking-tight">{item.title}</h4>
                  </div>
                  <div className="md:w-2/3 relative z-10">
                    <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-3 bg-fuchsia-500/15 border border-fuchsia-500/30 px-6 py-2.5 rounded-full shadow-lg">
              <span className="text-fuchsia-400 font-mono text-[14px] font-medium tracking-wide">
                RPA + Agents = Agentic Process Automation (APA)
              </span>
            </div>
          </div>
        </div>
      </section>

      <AuroraThread variant="divider" />

      {/* Section 2: Live Flow Ticker */}
      <section className="bg-transparent py-14 relative z-10">
        <div className="max-w-6xl mx-auto px-6">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-foreground tracking-tight mb-2">Your Enterprise-Grade Agent Laboratory.</h2>
              <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
                Real-world business workflows require more than just a single tool. Seamlessly orchestrate AI agents, legacy RPA bots, document parsers, and human oversight into one unified pipeline.
              </p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl px-5 py-3 flex flex-col sm:flex-row items-center gap-4">
              <span className="text-[10px] font-medium text-slate-400 text-center sm:text-left">We Support<br />A2A Communication</span>
              <div className="hidden sm:block w-px h-8 bg-slate-800" />
              <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
                <img src="/1uipath.png" alt="UiPath" className="h-6 md:h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="UiPath" />
                <img src="/2powerautomate.png" alt="Power Automate" className="h-6 md:h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="Microsoft Power Automate" />
                <img src="/3automationanyywhere.png" alt="Automation Anywhere" className="h-6 md:h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="Automation Anywhere" />
              </div>
            </div>
          </div>

          <div className="w-full h-[500px] bg-white border border-slate-200 rounded-[2.5rem] p-4 shadow-sm overflow-hidden relative">
            <TransactionGraph
              tx={{
                current_step: LC_STEPS[tickerActive],
                status: tickerActive === LC_STEPS.length - 1 ? 'completed' : 'pending'
              }}
              events={EMPTY_EVENTS}
            />
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Step transitions are append-only and cryptographically logged. Nodes are processed asynchronously by different MCP agents.
          </p>
        </div>
      </section>

      <AuroraThread variant="divider" className="max-w-6xl mx-auto" />

      {/* Section 3: Feature Showcase */}
      <FeatureShowcase />

      <AuroraThread variant="divider" className="max-w-6xl mx-auto" />

      {/* Section 3.5: Benchmark Section */}
      <BenchmarkSection />

      {/* Section 4 & 5: FAQ and Security */}
      <section className="bg-transparent py-24 relative overflow-hidden z-10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative">
          
          {/* Unified Container */}
          <div className="relative bg-white dark:bg-[#0B0A1F] border border-slate-200 dark:border-[rgba(139,92,246,0.15)] rounded-[2.5rem] p-10 lg:p-16 shadow-2xl overflow-hidden">
            {/* Top-Right subtle Aurora mesh glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-fuchsia-500/10 via-cyan-500/5 to-transparent rounded-full blur-3xl -mt-48 -mr-48 pointer-events-none" />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 xl:gap-24 relative z-10">
              
              {/* Left Column: FAQ */}
              <div className="space-y-10">
                <div className="space-y-4">
                  <p className="ui-label text-cyan-500">Questions? We got answers</p>
                  <h3 className="section-head text-3xl md:text-4xl text-foreground">FAQ</h3>
                </div>
                
                <div className="space-y-2">
                  {FAQ_DATA.map((faq, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div key={index} className="flex flex-col group relative">
                        <button
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          className="w-full flex items-center justify-between py-6 text-left focus:outline-none"
                        >
                          <span className={`text-[17px] font-semibold pr-8 transition-colors duration-300 ${isOpen ? 'text-slate-900 dark:text-white' : 'text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200'}`}>
                            {faq.question}
                          </span>
                          <ChevronDown className={`w-5 h-5 text-fuchsia-500 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <div 
                          className={`overflow-hidden transition-all duration-300 ease-in-out relative ${isOpen ? 'max-h-96 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400 via-fuchsia-500 to-yellow-400" />
                          <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Security */}
              <div className="space-y-10">
                <div className="space-y-4">
                  <p className="ui-label text-emerald-400">Enterprise Ready</p>
                  <h3 className="section-head text-3xl md:text-4xl text-foreground">Compliance &amp; Security</h3>
                </div>

                <div className="relative">
                  {[
                    { icon: ShieldCheck, name: "ISO 27001 Ready", note: "Information security management aligned to certification controls." },
                    { icon: Lock, name: "HMAC-SHA512", note: "Financial step transitions are request-signed and tamper-evident." },
                    { icon: Server, name: "Air-Gapped Node", note: "On-premise deployment with zero outbound database exposure." },
                    { icon: FileCheck, name: "OJK / BI Compliant", note: "Meets Indonesian regulatory requirements for trade finance." },
                    { icon: Database, name: "Immutable Audit", note: "Append-only ledger with cryptographic proof of every mutation." },
                  ].map(({ icon: Icon, name, note }, i) => (
                    <div key={name} className="relative">
                      {i !== 0 && (
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-cyan-500/0 via-fuchsia-500/20 to-yellow-500/0" />
                      )}
                      <div
                        className="grid grid-cols-12 gap-4 items-center py-6 group hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors -mx-4 px-4 rounded-xl"
                      >
                        <div className="col-span-2 md:col-span-1">
                          <span className="font-mono font-medium text-fuchsia-500 text-lg transition-colors">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <div className="col-span-10 md:col-span-11 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                          <div className="flex items-center gap-2.5 sm:w-2/5 flex-shrink-0">
                            <Icon className="w-[18px] h-[18px] text-[#8b5cf6] transition-colors flex-shrink-0" />
                            <span className="font-semibold text-[15px] text-slate-800 dark:text-slate-200">{name}</span>
                          </div>
                          <div className="text-[14px] text-slate-600 dark:text-slate-400 leading-relaxed sm:w-3/5">
                            {note}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AuroraThread variant="divider" />

      {/* System Architecture at a Glance */}
      <section className="py-24 bg-transparent relative z-10 scroll-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 space-y-16">
          <div className="text-left space-y-4 max-w-2xl">
            <p className="ui-label text-cyan-500">System Map</p>
            <h2 className="section-head text-3xl md:text-4xl text-foreground">Architecture at a glance</h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Amadeus is strictly divided into four specialized layers to ensure scalability and separation of concerns. From the interactive canvas to the persistent storage, every layer is built for enterprise orchestration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Presentation Layer */}
            <div className="group relative bg-white dark:bg-[#0B0A1F] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:border-cyan-500/50 transition-colors overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mt-16 -mr-16 pointer-events-none group-hover:bg-cyan-500/20 transition-colors" />
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                  <Monitor className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">1. Canvas</h3>
                <p className="text-[14px] text-cyan-600 dark:text-cyan-500 font-mono tracking-wide">Presentation Layer</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
                  The interactive interface where users configure agents and test them. Features the Agent Creator UI and Interactive Playground.
                </p>
                <div className="pt-4 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">React / Next.js</span>
                </div>
              </div>
            </div>

            {/* Orchestration Core */}
            <div className="group relative bg-white dark:bg-[#0B0A1F] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:border-fuchsia-500/50 transition-colors overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl -mt-16 -mr-16 pointer-events-none group-hover:bg-fuchsia-500/20 transition-colors" />
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center border border-fuchsia-500/20">
                  <Cpu className="w-6 h-6 text-fuchsia-500 dark:text-fuchsia-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">2. Brain</h3>
                <p className="text-[14px] text-fuchsia-600 dark:text-fuchsia-500 font-mono tracking-wide">Orchestration Core</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
                  The reasoning engine that manages agent states and tool selection. Handles LLM Routing and Session Memory.
                </p>
                <div className="pt-4 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">Node.js / LangGraph</span>
                </div>
              </div>
            </div>

            {/* Integration Layer */}
            <div className="group relative bg-white dark:bg-[#0B0A1F] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:border-yellow-400/50 transition-colors overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl -mt-16 -mr-16 pointer-events-none group-hover:bg-yellow-400/20 transition-colors" />
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
                  <Plug className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">3. Hands</h3>
                <p className="text-[14px] text-yellow-600 dark:text-yellow-400 font-mono tracking-wide">Integration Layer</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
                  The standardized protocol layer for tool execution. Bridges external APIs and enables dynamic tool discovery.
                </p>
                <div className="pt-4 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">MCP Adapters</span>
                </div>
              </div>
            </div>

            {/* Data Layer */}
            <div className="group relative bg-white dark:bg-[#0B0A1F] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 hover:border-emerald-400/50 transition-colors overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl -mt-16 -mr-16 pointer-events-none group-hover:bg-emerald-400/20 transition-colors" />
              <div className="relative z-10 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 flex items-center justify-center border border-emerald-400/20">
                  <Database className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">4. Storage</h3>
                <p className="text-[14px] text-emerald-600 dark:text-emerald-400 font-mono tracking-wide">Data Layer</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
                  The persistent memory and configuration storage. Stores Agent configurations, Tool schemas, and Chat history.
                </p>
                <div className="pt-4 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50">PostgreSQL</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Section 6: Footer */}
      <MarketingFooter />
    </div>
  );
}
