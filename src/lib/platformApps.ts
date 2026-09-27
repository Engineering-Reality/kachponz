import { Activity, Wrench, Wand2, Bot, BookOpen, Zap, type LucideIcon } from "lucide-react";

export interface PlatformApp {
  href: string;
  step: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
  bg: string;
}

// Canonical feature -> accent color mapping, shared by the homepage app grid
// and the /product capability grid so the two never drift apart.
export const PLATFORM_APPS: PlatformApp[] = [
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
    label: "Tools Registry",
    desc: "Register MCP servers your agents can call — internal APIs, external services, or UiPath/PAD robots — over stdio or SSE.",
    icon: Wrench,
    accent: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    href: "/agent-creator",
    step: "Step 03",
    label: "Agent Architect",
    desc: "Describe the agent you need in plain language, then edit the generated system prompt, tools, and loop recipe before saving.",
    icon: Wand2,
    accent: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    href: "/agents",
    step: "Step 04",
    label: "Agent Gallery",
    desc: "Every agent in one list — edit its system prompt, attached tools, and loop recipe, or turn it off.",
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
    href: "/playground",
    step: "Step 05",
    label: "Agent Flow Playground",
    desc: "Chat with an agent live and watch each MCP tool call and transaction state change as it happens, streamed over SSE.",
    icon: Zap,
    accent: "text-cyan-600",
    bg: "bg-cyan-50",
  },
];
