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
  ChevronDown
} from "lucide-react";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingFooter } from "@/components/MarketingFooter";
import { PLATFORM_APPS as NAV_APPS } from "@/lib/platformApps";

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

    return () => {
      observer.disconnect();
    };
  }, []);

  const gridApps = NAV_APPS.filter((a) => a.href !== "/playground");

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <MarketingHeader />

      {/* Hero Section — Light theme */}
      <section className="bg-gradient-to-b from-[#fafafa] to-white relative pt-40 pb-20 md:pt-48 md:pb-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Text Column */}
          <div className="lg:col-span-6 text-left z-20">
            <div className="inline-flex items-center gap-2.5 bg-pink-50 border border-pink-100 px-4 py-1.5 rounded-full mb-6 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              <p className="font-mono text-[11px] font-bold text-pink-700 tracking-widest uppercase m-0">The 1st Agentic Platform for RPA</p>
            </div>

            <h1 className="display-hero text-5xl md:text-6xl lg:text-7xl text-slate-900 relative z-20 leading-tight mb-6">
              Human Whoops,<br />
              <SpectralText text="Agent Loops," /><br />
              Robot Shoots.
            </h1>

            <p className="text-[16px] text-slate-600 leading-relaxed max-w-lg mb-10">
              The only startup enterprise-grade orchestration platform built specifically to target the Robotic Process Automation market. Seamlessly coordinate human analysts, intelligent AI agents, and legacy RPA bots to fully automate your complex operations.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link href="/playground" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 via-pink-500 to-yellow-500 text-white px-7 py-3.5 text-[15px] font-bold rounded-full hover:scale-105 transition-transform shadow-lg shadow-pink-500/20">
                Experience Agent Playground <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="#demo" className="inline-flex items-center gap-2 border-2 border-slate-200 text-slate-700 px-7 py-3 text-[15px] font-bold rounded-full hover:text-slate-900 hover:border-slate-300 transition-colors bg-white shadow-sm">
                Watch Demo
              </Link>
            </div>
          </div>

          {/* Right Column: Agent Flow & Loop Feature Mockup */}
          <div className="lg:col-span-6 flex justify-center relative min-h-[480px] items-center">
            <div className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-r from-blue-500 via-pink-500 to-yellow-500 opacity-[0.15] blur-[90px] pointer-events-none" />

            <div className="float-soft relative w-[520px] max-w-full z-10">
              {/* Floating orchestration badge */}
              <div className="hidden lg:flex absolute -top-4 -right-4 z-20 items-center gap-2 bg-white border border-slate-200 rounded-[1rem] px-4 py-2.5 shadow-xl shadow-slate-200/50">
                <span className="relative flex w-2.5 h-2.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-pink-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-pink-500" />
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-700">LOOP MODE: CX-100</span>
              </div>

              {/* Main Container */}
              <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200/80 flex flex-col">
                
                {/* 1. VISUAL AGENT FLOW (NODE GRAPH) */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 relative">
                  <p className="font-mono text-[10px] text-slate-400 mb-5 tracking-widest text-center">AUTONOMOUS EXECUTION GRAPH</p>
                  
                  <div className="relative flex items-center justify-between px-2 h-[120px]">
                    {/* Background SVG Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                      {/* Line from Brain to RPA */}
                      <path d="M 60,60 L 220,60" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                      <path d="M 60,60 L 220,60" stroke="#ec4899" strokeWidth="2" strokeDasharray="4 4" fill="none" className="animate-pulse" />
                      
                      {/* Error loop line from RPA back to Brain (curved) */}
                      <path d="M 220,50 Q 140,-10 60,50" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                      <circle cx="140" cy="20" r="4" fill="#ef4444" className="animate-ping" />

                      {/* Line from Brain to Vision Agent (Loop fallback) */}
                      <path d="M 60,70 Q 140,130 220,130" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                      <circle cx="140" cy="100" r="4" fill="#3b82f6" className="animate-ping" style={{ animationDelay: '0.5s' }} />

                      {/* Line from Vision back to RPA */}
                      <path d="M 260,130 Q 300,95 260,60" stroke="#3b82f6" strokeWidth="2" fill="none" />
                      <polygon points="255,60 265,65 265,55" fill="#3b82f6" />
                    </svg>

                    {/* Nodes (z-10 relative) */}
                    {/* Node 1: Orchestrator */}
                    <div className="relative z-10 flex flex-col items-center group">
                      <div className="w-14 h-14 rounded-[1rem] bg-white border border-pink-200 flex items-center justify-center text-xl shadow-sm">
                        🧠
                      </div>
                      <span className="font-mono text-[9px] text-pink-600 mt-2 font-bold">Orchestrator</span>
                    </div>

                    {/* Node 2: RPA Bot (Legacy) */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-14 h-14 rounded-[1rem] bg-red-50 border border-red-200 flex items-center justify-center text-xl shadow-sm relative">
                        🤖
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white">!</span>
                      </div>
                      <span className="font-mono text-[9px] text-red-600 mt-2">UiPath Bot 01</span>
                    </div>

                    {/* Node 3: Vision Agent (Fallback) */}
                    <div className="relative z-10 flex flex-col items-center translate-y-[35px]">
                      <div className="w-14 h-14 rounded-[1rem] bg-white border border-blue-200 flex items-center justify-center text-xl shadow-sm">
                        👁️
                      </div>
                      <span className="font-mono text-[9px] text-blue-600 mt-2 font-bold">Vision Agent</span>
                    </div>

                  </div>
                </div>

                {/* 2. CHAT / EXECUTION LOGS */}
                <div className="p-5 space-y-4 bg-white">
                  {/* RPA Error */}
                  <div className="flex items-start gap-3 chat-msg" style={{ animationDelay: "0.2s" }}>
                    <span className="w-7 h-7 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-xs flex-shrink-0">
                      🤖
                    </span>
                    <div className="max-w-[85%]">
                      <div className="bg-red-50 border border-red-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                        <p className="text-[12px] text-red-600 font-mono">
                          [ERROR] SelectorNotFound: 'Submit_Btn' on CX-100 legacy form.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Orchestrator Triggering Loop */}
                  <div className="flex items-start gap-3 chat-msg" style={{ animationDelay: "0.6s" }}>
                    <span className="w-7 h-7 rounded-full bg-white border border-pink-200 flex items-center justify-center text-xs flex-shrink-0 shadow-sm">
                      🧠
                    </span>
                    <div className="max-w-[85%]">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                        <p className="text-[12.5px] text-slate-700 leading-relaxed">
                          Failure detected. <span className="text-pink-600 font-medium">Initiating Agent Loop (1/3)</span>. Engaging Vision Agent to dynamically locate button via DOM snapshot.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Vision Agent Working */}
                  <div className="flex items-start gap-3 chat-msg" style={{ animationDelay: "1s" }}>
                    <span className="w-7 h-7 rounded-full bg-white border border-blue-200 flex items-center justify-center text-xs flex-shrink-0">
                      👁️
                    </span>
                    <div>
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 inline-flex items-center gap-2">
                        <span className="text-[12.5px] text-blue-700">Analyzing DOM...</span>
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0s" }} />
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0.15s" }} />
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0.3s" }} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50">
                  <div className="flex-1 bg-white border border-slate-200 rounded-full px-5 py-2.5 text-[13px] text-slate-500 font-medium shadow-inner shadow-slate-100/50">
                    Inject override command...
                  </div>
                  <button className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-pink-500 hover:scale-105 transition-transform shadow-md shadow-pink-500/20">
                    <Send className="w-3.5 h-3.5 text-white ml-0.5" />
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
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Your Enterprise-Grade Agent Laboratory.</h2>
              <p className="text-slate-500 text-sm max-w-xl leading-relaxed">
                Real-world business workflows require more than just a single tool. Seamlessly orchestrate AI agents, legacy RPA bots, document parsers, and human oversight into one unified pipeline.
              </p>
            </div>

            <div className="bg-white border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] rounded-2xl px-5 py-3 flex flex-col sm:flex-row items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 text-center sm:text-left">We Support<br />A2A Communication</span>
              <div className="hidden sm:block w-px h-8 bg-slate-100" />
              <div className="flex items-center gap-6">
                <img src="/1uipath.png" alt="UiPath" className="h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="UiPath" />
                <img src="/2powerautomate.png" alt="Power Automate" className="h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="Microsoft Power Automate" />
                <img src="/3automationanyywhere.png" alt="Automation Anywhere" className="h-7 w-auto object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-80 hover:opacity-100 cursor-pointer" title="Automation Anywhere" />
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

      {/* Section 3: App Grid */}
      <section className="py-24 bg-[#fafafa]">
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
              <div key={href} className="scroll-reveal" style={{ transitionDelay: `${index * 120}ms` }}>
                <Link
                  href={href}
                  className="relative group rounded-[2rem] p-[2px] overflow-hidden transition-all duration-500 hover:-translate-y-1.5 block h-full shadow-sm hover:shadow-2xl"
                >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 group-hover:from-blue-400 group-hover:via-pink-500 group-hover:to-yellow-400 transition-colors duration-500 opacity-60 group-hover:opacity-100" />
                <div className="relative z-10 flex flex-col h-full bg-white rounded-[30px] p-8 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-3xl ${bg} flex items-center justify-center shadow-inner`}>
                      <Icon className={`w-7 h-7 ${accent}`} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                      {step}
                    </span>
                  </div>

                  <h3 className="section-head text-[21px] text-slate-900 mb-2">{label}</h3>
                  <p className="text-[15px] text-slate-500 leading-relaxed flex-1">{desc}</p>

                  <div className={`mt-6 flex items-center gap-2 text-sm font-bold ${accent} opacity-70 group-hover:opacity-100 transition-opacity`}>
                    Explore <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
                </Link>
              </div>
            ))}
          </div>

          {/* Playground — featured full-width light */}
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 relative shadow-2xl shadow-slate-200/50">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-pink-500 to-yellow-500"></div>
            <div className="flex flex-col lg:flex-row items-stretch">
              <div className="flex-1 p-10 md:p-14 space-y-6">
                <div className="inline-flex items-center gap-2 bg-pink-50 border border-pink-100 px-3 py-1 rounded-full mb-2">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                  <p className="ui-label text-pink-700 m-0">Sneak Peek • Demo Feature</p>
                </div>
                <h3 className="section-head text-3xl md:text-4xl text-slate-900">Agent Playground</h3>
                <p className="text-[16px] text-slate-600 leading-relaxed max-w-md">
                  Stream real-time agent reasoning over a selected transaction. Watch
                  MCP tool calls, state transitions, and telemetry flow through a
                  control panel built for enterprise ops — completely observable.
                </p>
                <Link href="/playground" className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-pink-500 text-white px-7 py-3.5 text-[15px] font-bold rounded-full hover:scale-105 transition-transform shadow-lg shadow-pink-500/20">
                  Launch Agent Console <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Mini terminal preview */}
              <div className="flex-1 p-8 md:p-12 flex items-center">
                <div className="terminal-card w-full overflow-hidden shadow-xl shadow-slate-200/60 rounded-[1.5rem] border border-slate-200 bg-slate-50">
                  <div className="terminal-card-header bg-white px-5 py-3 border-b border-slate-200">
                    <span className="terminal-dot bg-red-400 w-3 h-3" />
                    <span className="terminal-dot bg-yellow-400 w-3 h-3" />
                    <span className="terminal-dot bg-emerald-400 w-3 h-3" />
                    <span className="ui-label text-slate-400 ml-3 text-xs tracking-wider">Playground Console</span>
                  </div>
                  <div className="p-0 flex flex-col h-[360px] bg-slate-50">
                    <div className="flex-1 overflow-y-auto p-5 space-y-6 flex flex-col justify-end">
                      {/* User */}
                      <div className="flex justify-end stream-in" style={{ animationDelay: '0.1s' }}>
                        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-tr-sm px-4 py-2.5">
                          <p className="text-[13px] text-slate-700 font-medium">Execute settlement for LC #8F3A</p>
                        </div>
                      </div>

                      {/* Agent */}
                      <div className="flex items-start gap-3 stream-in" style={{ animationDelay: '0.3s' }}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                          <span className="text-white text-xs font-bold">AM</span>
                        </div>
                        <div className="space-y-3 w-full max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="ui-label text-slate-400">Amadeus Orchestrator</span>
                            <span className="text-[9px] font-mono text-emerald-600 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 rounded-sm">system</span>
                          </div>
                          <div className="text-[13px] text-slate-700 leading-relaxed font-sans">
                            I will now trigger the UiPath robot via MCP to execute the MT202 conversion.
                          </div>

                          {/* Tool Call Block */}
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-amber-500 text-xs">⚙</span>
                                <span className="text-slate-600 text-xs font-mono font-medium">execute_mcp_tool</span>
                              </div>
                              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Running...
                              </span>
                            </div>
                            <div className="p-3 bg-slate-100 font-mono text-[11.5px] text-slate-500 leading-loose overflow-x-auto">
                              <span className="text-indigo-500">"server_name"</span>: <span className="text-amber-600">"UiPath MCP"</span>,<br />
                              <span className="text-indigo-500">"tool_name"</span>: <span className="text-amber-600">"trigger_job"</span>,<br />
                              <span className="text-indigo-500">"arguments"</span>: {"{"}<br />
                              &nbsp;&nbsp;<span className="text-indigo-500">"processName"</span>: <span className="text-amber-600">"MT202_Converter"</span>,<br />
                              &nbsp;&nbsp;<span className="text-indigo-500">"txId"</span>: <span className="text-amber-600">"8F3A"</span><br />
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

      {/* Section 4: FAQ — light */}
      <section className="bg-slate-50 py-24 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <p className="ui-label text-blue-600">You got questions? We got answers</p>
            <h3 className="section-head text-3xl md:text-4xl text-slate-900">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-4">
            {FAQ_DATA.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index} 
                  className={`border border-slate-200 rounded-[2rem] overflow-hidden transition-all duration-300 ${isOpen ? 'bg-white shadow-md' : 'bg-white shadow-sm hover:shadow-md'}`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                  >
                    <span className="text-lg font-medium text-slate-800 pr-8">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div 
                    className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="text-[15px] text-slate-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LC Settlement Stack */}
            <div className="rounded-[2.5rem] border border-[#e5e7eb] bg-white p-10 shadow-sm hover:shadow-xl transition-shadow">
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
                  <li><span className="text-blue-600 font-bold">amadeus-core</span> — Fastify + Postgres, :8080</li>
                  <li><span className="text-blue-600 font-bold">MCP tools</span> — registered via the Tools page; Amadeus discovers &amp; spawns them dynamically (npx)</li>
                  <li><span className="text-blue-600 font-bold">amadeus-orchestrator-mcp / amadeus-uipath-mcp</span> — self-contained npm packages, ports auto-allocated</li>
                  <li><span className="text-blue-600 font-bold">this console</span> — Next.js, :3000</li>
                </ul>
                <Link href="/docs/lc-settlement-stack" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-1">
                  Read the settlement stack docs <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Legacy Agent Platform */}
            <div className="rounded-[2.5rem] border border-[#e5e7eb] bg-white p-10 shadow-sm hover:shadow-xl transition-shadow">
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

          <div className="flex justify-start pt-4">
            <Link href="/docs/architecture-overview" className="btn-secondary px-7 py-3.5 text-sm bg-white rounded-full font-bold shadow-sm hover:shadow-md transition-shadow">
              <BookOpen className="w-4 h-4" /> Full architecture documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Section 6: Footer */}
      <MarketingFooter />
    </div>
  );
}
