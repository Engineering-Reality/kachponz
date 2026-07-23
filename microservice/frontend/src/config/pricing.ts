export const PRICING_DATA = {
  currency: {
    idr: "Rp",
    usd: "$"
  },
  globalNote: "Semua paket sudah termasuk maintenance dan service 24/7 dari kami, termasuk bantuan pembuatan agent hingga kustomisasi penuh.",
  tiers: {
    builder: {
      id: "builder",
      name: "Builder",
      target: "students, indie devs, solo projects",
      tagline: "Ship a working AI agent or SaaS boilerplate this weekend.",
      price: {
        idr: "990.000",
        usd: "59",
        unit: "/project"
      },
      features: [
        "Agent Creator (Cloud-hosted)",
        "Up to 3 MCP tool connections",
        "Community & Direct Discord Support",
        "Usage-capped model calls per month"
      ]
    },
    boilerplate: {
      id: "boilerplate",
      name: "SaaS Boilerplate",
      target: "solo founders, early stage",
      tagline: "Launch your SaaS faster with pre-built agentic scaffolds.",
      price: {
        idr: "1.990.000",
        usd: "119",
        unit: "/license"
      },
      features: [
        "Full Source Code Access",
        "Pre-built Authentication & DB",
        "Agent Flow UI Components",
        "Direct Support & Customization"
      ]
    },
    team: {
      id: "team",
      name: "Team",
      target: "startups, small product teams",
      tagline: "Connect your product to any MCP tool. Ship agents your users actually rely on.",
      price: {
        idr: "3.490.000",
        usd: "219",
        unit: "/mo"
      },
      features: [
        "Everything in Builder",
        "Loop Mode / Recipe Executor",
        "Multiple team members/seats",
        "Higher usage limits",
        "1 business day email support"
      ]
    },
    business: {
      id: "business",
      name: "Business",
      target: "mid-market teams",
      tagline: "We help you connect Amadeus to your actual systems — not just hand you a dashboard.",
      price: {
        type: "usage",
        description: "Netra Token Usage + 30% Amadeus Markup",
        idr: "Custom",
        usd: "Custom"
      },
      features: [
        "Everything in Team",
        "Dedicated onboarding call",
        "Custom MCP connector support",
        "Usage-based overage (no hard cap)",
        "Priority 24/7 Service"
      ]
    },
    enterprise: {
      id: "enterprise",
      name: "Enterprise",
      target: "regulated industries",
      tagline: "ISO 27001 Ready, HMAC-SHA512, Air-Gapped Node, OJK/BI Compliant.",
      price: {
        type: "contact",
        label: "Contact Sales"
      },
      features: [
        "On-premise deployment (Netra Runtime)",
        "Custom SLAs",
        "Dedicated account team",
        "Compliance documentation support",
        "Custom contract terms"
      ]
    }
  },
  partners: {
    referral: {
      commission: "15%" // Placeholder percentage
    }
  }
};
