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
    title: "Frontend",
    items: [{ slug: "frontend-surfaces", title: "Frontend Surfaces" }],
  },
  {
    title: "Reference",
    items: [{ slug: "known-gaps", title: "Known Gaps & Caveats" }],
  },
];

export function findDocTitle(slug: string): string {
  for (const group of DOCS_NAV) {
    const hit = group.items.find((i) => i.slug === slug);
    if (hit) return hit.title;
  }
  return slug.replace(/-/g, " ");
}
