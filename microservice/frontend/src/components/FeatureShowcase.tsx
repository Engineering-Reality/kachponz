"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Wrench, Wand2, Zap } from "lucide-react";

const FEATURES = [
  {
    id: "agent-creator",
    title: "1. Agent Creator",
    navLabel: "Agent Creator",
    description: "Visually construct powerful AI agents with our intuitive natural language builder. Assemble tools, assign personas, and test in real-time.",
    bullets: [
      "Attach any MCP-compatible tool — UiPath, Power Automate, custom APIs",
      "Configure Loop Mode recipes per agent — deterministic multi-step execution",
      "System prompt per agent — each agent gets its own behavior spec"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Wand2,
    href: "/agent-creator"
  },
  {
    id: "tools",
    title: "2. Tools Registry",
    navLabel: "Tools",
    description: "A centralized hub to register capabilities. Connect internal APIs, external services, or legacy RPA bots securely via the Model Context Protocol (MCP).",
    bullets: [
      "Unified MCP tool integration across disparate platforms",
      "Secure API key management and role-based access",
      "Dynamically discoverable endpoints for AI agents"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Wrench,
    href: "/tools"
  },
  {
    id: "playground",
    title: "3. Agent Playground",
    navLabel: "Playground",
    description: "Stream real-time agent reasoning over selected transactions. Watch MCP tool calls, state transitions, and telemetry flow through a secure control panel.",
    bullets: [
      "Live reasoning streaming via Server-Sent Events (SSE)",
      "Interactive tool execution with human-in-the-loop pauses",
      "Full cryptographic audit logging of every decision step"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Zap,
    href: "/playground"
  },
  {
    id: "agents",
    title: "4. Agents Roster",
    navLabel: "Agents",
    description: "Manage your workforce of intelligent agents. Monitor their performance, assign tasks, and track their interaction with legacy RPA systems.",
    bullets: [
      "Centralized agent lifecycle and version management",
      "Performance, telemetry, and error rate tracking",
      "Seamless exception routing to human analysts"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Bot,
    href: "/agents"
  }
];

export function FeatureShowcase() {
  const [activeFeature, setActiveFeature] = useState(FEATURES[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
            setActiveFeature(entry.target.id);
          }
        });
      },
      {
        root: null,
        rootMargin: "-20% 0px -50% 0px", // Trigger when element is near center
        threshold: 0.4,
      }
    );

    const sections = document.querySelectorAll(".feature-section");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="bg-transparent py-24 relative z-10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        
        <div className="text-center md:text-left mb-16 lg:mb-0 lg:absolute lg:top-24 lg:left-12 z-20">
          <p className="ui-label text-cyan-500 mb-2">Capabilities</p>
          <h2 className="section-head text-3xl md:text-4xl text-foreground">Explore the Platform</h2>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-24 relative lg:pt-32">
          
          {/* Left Sidebar (Sticky) */}
          <div className="hidden lg:block w-64 flex-shrink-0 sticky top-32 z-10 bg-slate-50 dark:bg-[rgba(30,27,75,0.03)] rounded-2xl p-4 border border-slate-100 dark:border-transparent">
            <nav className="space-y-2 relative">
              {FEATURES.map((feature) => {
                const isActive = activeFeature === feature.id;
                const Icon = feature.icon;
                return (
                  <a 
                    key={feature.id}
                    href={`#${feature.id}`}
                    className={`relative flex items-center gap-4 py-4 px-4 transition-all duration-300 ${isActive ? "text-slate-900 dark:text-white font-semibold bg-slate-200/50 dark:bg-white/5 rounded-r-lg" : "text-slate-500 hover:text-slate-900 dark:text-[#8b5cf6]/60 font-medium dark:hover:text-white"}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(feature.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-cyan-400 via-fuchsia-500 to-yellow-400" />
                    )}
                    <Icon className="w-4 h-4" />
                    {feature.navLabel}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right Content Area (Scrollable) */}
          <div className="flex-1 space-y-32 lg:space-y-48 pb-32 w-full">
            {FEATURES.map((feature) => (
              <div 
                key={feature.id} 
                id={feature.id} 
                className="feature-section flex flex-col xl:flex-row gap-10 items-center scroll-mt-48 min-h-[50vh]"
              >
                {/* Text Description */}
                <div className="flex-1 space-y-6 w-full">
                  <h3 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{feature.title}</h3>
                  <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                    {feature.description}
                  </p>
                  <ul className="space-y-3 mt-4">
                    {feature.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-6">
                    <Link href={feature.href} className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold transition-transform hover:-translate-y-1 bg-fuchsia-600/10 text-fuchsia-400 border border-fuchsia-600/20 hover:bg-fuchsia-600/20 shadow-[0_0_20px_rgba(217,70,239,0.15)]`}>
                      Explore {feature.navLabel} 
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Screenshot/Video with Device Frame */}
                <div className="flex-1 w-full xl:max-w-none">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0A1F] shadow-[0_0_40px_rgba(217,70,239,0.15)] group transition-transform duration-500 hover:shadow-[0_0_50px_rgba(34,211,238,0.2)] flex flex-col">
                    {/* Device Chrome */}
                    <div className="h-10 bg-slate-100 dark:bg-[#1E1B4B] border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2 flex-shrink-0">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700/50" />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="h-5 w-48 bg-white dark:bg-slate-800/50 rounded-full border border-slate-200 dark:border-transparent" />
                      </div>
                    </div>
                    {/* Content */}
                    <div className="relative w-full aspect-video bg-black">
                      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10 pointer-events-none z-20" />
                      <video 
                        src={feature.video} 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-full object-cover relative z-10" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </section>
  );
}
