export interface DocNavItem {
  slug: string;
  title: string;
}

export interface DocNavGroup {
  title: string;
  items: DocNavItem[];
}

export const DOCS_NAV: DocNavGroup[] = [
  {
    title: "Get Started",
    items: [{ slug: "architecture-overview", title: "Architecture Overview" }],
  },
  {
    title: "LC Settlement Stack",
    items: [
      { slug: "lc-settlement-stack", title: "The Settlement Stack" },
      { slug: "cost-aware-routing", title: "Cost-Aware Executor Routing" },
      { slug: "a2a-protocol", title: "A2A Protocol & Signatures" },
    ],
  },
  {
    title: "Agent Platform (Legacy)",
    items: [
      { slug: "agent-platform-legacy", title: "Platform Overview" },
      { slug: "mcp-servers-reference", title: "MCP Servers Reference" },
    ],
  },
  {
    title: "Frontend",
    items: [{ slug: "frontend-surfaces", title: "Frontend Surfaces" }],
  },
  {
    title: "Reference",
    items: [{ slug: "known-gaps", title: "Known Gaps & Caveats" }],
  },
  {
    title: "API Flow References",
    items: [
      { slug: "main-app-flow", title: "Main App Flow" },
      { slug: "server-flow", title: "Website Tester Server Flow" },
      { slug: "agents-flow", title: "Agents Flow" },
      { slug: "agent-logs-flow", title: "Agent Logs Flow" },
      { slug: "agent-creator-flow", title: "Agent Creator Flow" },
      { slug: "agent-invoke-flow", title: "Agent Invoke Flow" },
      { slug: "agent-invoke-stream-flow", title: "Agent Invoke Stream Flow" },
      { slug: "companies-flow", title: "Companies Flow" },
      { slug: "roles-flow", title: "Roles Flow" },
      { slug: "tools-flow", title: "Tools Flow" },
      { slug: "user-info-flow", title: "User Info Flow" },
      { slug: "feature-sharing-flow", title: "Feature Sharing Flow" },
    ],
  },
];

export function findDocTitle(slug: string): string {
  for (const group of DOCS_NAV) {
    const hit = group.items.find((i) => i.slug === slug);
    if (hit) return hit.title;
  }
  return slug.replace(/-/g, " ");
}
