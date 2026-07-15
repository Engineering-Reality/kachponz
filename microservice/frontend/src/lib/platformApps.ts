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
    href: "/playground",
    step: "Step 05",
    label: "Playground",
    desc: "Stream real-time agent reasoning over a selected transaction.",
    icon: Zap,
    accent: "text-cyan-600",
    bg: "bg-cyan-50",
  },
];
