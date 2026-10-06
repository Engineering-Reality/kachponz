"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Wrench, Wand2, Zap } from "lucide-react";

const FEATURES = [
  {
    id: "agent-creator",
    title: "Agent Architect",
    navLabel: "Agent Architect",
    description: "Describe the agent you need in plain language, then edit the generated config directly — system prompt, tools, and loop recipe.",
    bullets: [
      "Attach any MCP-compatible tool — UiPath, Power Automate, custom APIs",
      "Configure a Loop Mode recipe per agent for multi-step, self-correcting runs",
      "Each agent has its own system prompt — behavior doesn't leak across agents"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Wand2,
    href: "/agent-creator"
  },
  {
    id: "tools",
    title: "Tools Registry",
    navLabel: "Tools Registry",
    description: "Register the tools your agents can call — internal APIs, external services, or legacy RPA robots — connected over MCP (stdio or SSE).",
    bullets: [
      "Register MCP servers over stdio or SSE — from UiPath robots to internal REST APIs",
      "Credentials stored server-side in the tool's DB record, never in process arguments",
      "Restart a tool from the registry after updating its config or credentials"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Wrench,
    href: "/tools"
  },
  {
    id: "playground",
    title: "Agent Flow Playground",
    navLabel: "Agent Flow Playground",
    description: "Chat with an agent live and watch each MCP tool call and transaction state change as it happens.",
    bullets: [
      "Live reasoning streamed via Server-Sent Events (SSE)"
    ],
    video: "https://www.w3schools.com/html/mov_bbb.mp4",
    icon: Zap,
    href: "/playground"
  },
  {
    id: "agents",
    title: "Agent Gallery",
    navLabel: "Agent Gallery",
    description: "Every agent in one place — edit its system prompt, attached tools, and loop recipe, or turn it off.",
    bullets: [
      "Create, edit, or disable an agent without touching code"
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
    <section className="bg-transparent py-16 md:py-24 relative z-10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        
        <div className="text-center md:text-left mb-16 lg:mb-0 lg:absolute lg:top-24 lg:left-12 z-20">
          <p className="ui-label text-cyan-500 mb-2">Capabilities</p>
          <h2 className="section-head text-3xl md:text-4xl text-foreground">Explore the Platform</h2>
        </div>

        <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-24 relative lg:pt-32">
          
          {/* Left Sidebar (Sticky) */}
          <div className="hidden lg:block w-64 flex-shrink-0 sticky top-32 z-10 holo-glass rounded-2xl p-4">
            <nav className="space-y-2 relative">
              {FEATURES.map((feature) => {
                const isActive = activeFeature === feature.id;
                const Icon = feature.icon;
                return (
                  <a 
                    key={feature.id}
                    href={`#${feature.id}`}
                    className={`relative flex items-center gap-4 py-4 px-4 transition-all duration-300 ${isActive ? "text-slate-900 dark:text-white font-semibold bg-slate-200/50 dark:bg-white/5 rounded-r-lg" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 font-medium dark:hover:text-white"}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(feature.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#3df2ff] via-[#ff4fd8] to-[#ffe36e]" />
                    )}
                    <Icon className="w-4 h-4" />
                    {feature.navLabel}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Right Content Area (Scrollable) */}
          <div className="flex-1 space-y-20 md:space-y-32 lg:space-y-48 pb-16 md:pb-32 w-full">
            {FEATURES.map((feature) => (
              <div 
                key={feature.id} 
                id={feature.id} 
                className="feature-section flex flex-col xl:flex-row gap-8 md:gap-10 items-center scroll-mt-48 xl:min-h-[50vh]"
              >
                {/* Text Description */}
                <div className="flex-1 space-y-6 w-full">
                  <div className="flex items-center gap-5">
                    <div className="relative holo-ring rounded-2xl flex-shrink-0">
                      <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 rounded-[14px] flex items-center justify-center">
                        <feature.icon className="w-7 h-7 md:w-8 md:h-8 text-slate-800 dark:text-white" />
                      </div>
                    </div>
                    <h3 className="section-head text-2xl md:text-4xl text-foreground">{feature.title}</h3>
                  </div>
                  <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
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
                    <div className="inline-block">
                      <Link href={feature.href} className="wire-btn">
                        Explore {feature.navLabel} 
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Screenshot/Video with Device Frame */}
                <div className="flex-1 w-full xl:max-w-none">
                  <div className="relative rounded-2xl overflow-hidden holo-glass holo-sheen shadow-[0_0_40px_rgba(255,79,216,0.12)] group transition-shadow duration-500 hover:shadow-[0_0_60px_rgba(61,242,255,0.22)] flex flex-col">
                    {/* Device Chrome */}
                    <div className="h-10 bg-slate-100/70 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.06] flex items-center px-4 gap-2 flex-shrink-0">
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
                      <div className="absolute inset-0 bg-gradient-to-br from-[#ff4fd8]/10 via-transparent to-[#3df2ff]/10 pointer-events-none z-20" />
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
