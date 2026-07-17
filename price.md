# Prompt #20 — Amadeus: Pricing & Partnership Pages

Two new pages, both using the Aurora Thread design system from Prompt 19/19b — same
palette, same signature element, same "no AI-slop" discipline (no emoji as icons, no
flat candy-color cards, no generic copy). Read those prompts first if the design
tokens aren't already in the codebase.

## The core positioning problem this solves

Amadeus currently reads as one thing: enterprise RPA orchestration for banks. The
ask is to ALSO serve students/indie builders (boilerplate, SaaS scaffolding, AI
agent builds) and mid-market teams (self-serve agent-to-MCP integration) — without
diluting the enterprise story. The fix is segmentation, not a single price list:
**three self-serve tiers + one enterprise tier**, presented as distinct tracks a
visitor sorts themselves into, not a flat comparison grid.

---

## Page 1 — Pricing

### Structure: a track selector, not a single table

At the top of the page, before any pricing is shown, an explicit fork:

```
"What are you building?"
[ Individual project ]   [ Team / product ]   [ Enterprise / regulated ]
```

Selecting one filters/highlights the relevant tier(s) below (or scrolls to them) —
this does the segmentation work visually instead of making every visitor parse a
5-column table where 80% of it doesn't apply to them.

### Tier structure

**1. Builder** — *students, indie devs, solo projects*
- Positioning line: "Ship a working AI agent or SaaS boilerplate this weekend."
- What's included: Agent Creator (cloud-hosted), up to a small number of MCP tool
  connections, community support (Discord/forum, not a ticket queue), usage-capped
  model calls per month.
- Price: **[NEEDS REAL INPUT]** — do not invent a number. Structure it as either
  free-with-caps or a low flat monthly fee; the actual figure is a business decision
  (margin on model API costs, support cost) that needs real input, not a guess.
  Placeholder the UI with an editable price token so it's trivial to fill in once
  decided, rather than hardcoding a fabricated number into markup.

**2. Team** — *startups, small product teams shipping agents into their own product*
- Positioning line: "Connect your product to any MCP tool. Ship agents your users
  actually rely on."
- What's included: everything in Builder, plus: Loop Mode / Recipe Executor for
  deterministic multi-step flows, higher usage caps, multiple team members/seats,
  email support with a real response-time commitment (state one, e.g. "1 business
  day" — don't leave it vague).
- Price: **[NEEDS REAL INPUT]** — same caveat as above; likely a per-seat or
  usage-tiered monthly price.

**3. Business** — *mid-market teams wanting hands-on agent↔MCP integration help,
   not just self-serve tooling*
- Positioning line: "We help you connect Amadeus to your actual systems — not just
  hand you a dashboard."
- What's included: everything in Team, plus: dedicated onboarding call, custom MCP
  connector support (if a tool doesn't have an MCP server yet, help building one),
  priority support, usage-based overage instead of a hard cap.
- Price: **[NEEDS REAL INPUT]** or "Talk to us" if this tier is meant to be
  higher-touch/sales-assisted rather than self-serve checkout.

**4. Enterprise** — *regulated industries, on-premise/air-gapped deployment*
- Positioning line: pull directly from the existing Compliance & Security section
  copy already on the site (ISO 27001 Ready, HMAC-SHA512, Air-Gapped Node, OJK/BI
  Compliant, Immutable Audit) — this tier's whole pitch IS that compliance list,
  reuse it here rather than writing new copy that might drift from what Compliance
  page states.
- What's included: on-premise deployment (Netra Runtime self-hosted), custom SLA,
  dedicated account team, compliance documentation support, custom contract terms.
- Price: **"Contact Sales"** always — never show a number here, this is correctly
  handled as custom/negotiated per the nature of enterprise banking deals already
  described elsewhere in this project (license negotiation, right-sized volumes,
  multi-year price locks — Amadeus's own enterprise pricing should follow the same
  negotiated-not-listed pattern Jandy has used when negotiating WITH vendors).

### Visual treatment

- Three self-serve tiers (Builder/Team/Business) as cards in a row, Aurora Thread
  divider lines between them (not full card borders — consistent with the "avoid
  flat solid-color cards" rule from Prompt 19b).
- The middle tier (Team) gets the subtle "recommended" treatment — a thin aurora-
  gradient top border and a small pill badge — this is a legitimate, common pricing-
  page pattern precisely because it's genuinely informative (steers toward the tier
  the business wants most people to land on), not decoration.
- Enterprise tier: visually distinct, NOT in the same row — a separate full-width
  band below the three cards, dark background (matching the site's dark sections),
  reusing the Compliance & Security section's iconography (ISO/HMAC/Air-Gapped/OJK
  icons) as a compact strip within this band, single "Contact Sales" CTA.
- A comparison table BELOW the cards (not instead of them) for visitors who want the
  full feature-by-feature breakdown — collapsed/expandable by default so it doesn't
  compete with the cards for attention.

### FAQ addition specific to pricing

Add 2-3 FAQ entries addressing the segmentation directly, since a visitor bouncing
between "boilerplate for my side project" and "bank-grade compliance" framing on the
same page will have a natural "wait, is this the same product?" moment:
- "I'm a student/solo builder — is Amadeus overkill for me?" → No, answer honestly
  about what the Builder tier actually gives a small project.
- "We're a regulated business — can we start on a self-serve tier?" → Be honest:
  probably not, point to Enterprise/Contact Sales for anything with real compliance
  requirements from day one.

---

## Page 2 — Partnership

Three partner categories, matching how the platform actually creates value for
outside parties (don't invent categories that don't map to anything real):

**1. Technology Partners** — *MCP tool builders*
- For teams building an MCP server for their own product/API and wanting it
  discoverable/certified within Amadeus's tool ecosystem.
- What this gets them: listing in Amadeus's tools directory, technical support for
  MCP integration, co-marketing if the integration is genuinely notable.
- CTA: "Submit your MCP server" — link to a real submission form/process, not a
  vague "get in touch."

**2. Implementation Partners** — *system integrators, consultancies deploying
   Amadeus for their own enterprise clients*
- For firms doing the kind of work described elsewhere in this project (RPA
  portfolio rationalization, license negotiation support, executive briefing
  materials) — i.e., consultancies who'd deploy and configure Amadeus on behalf of
  a bank or large org, not build the product itself.
- What this gets them: partner enablement materials, a revenue-share or referral
  structure (needs real business input — placeholder, don't invent percentages),
  direct technical support channel separate from standard customer support.

**3. Referral Partners** — *anyone who can point a qualified enterprise lead our way*
- Lightweight — a referral form and a stated (real, not placeholder) commission
  structure once decided.

### Visual treatment

Three columns, same card discipline as Pricing (no flat color fills, Aurora Thread
dividers). Each column ends in a distinct CTA appropriate to that partner type — not
all three funneling into the same generic "Contact Us" form, since a tool builder,
a consultancy, and a referrer are three different conversations with three
different qualifying questions.

---

## Acceptance criteria

- [ ] Pricing page has an explicit track selector at the top, not a flat 4-column
      table as the first thing visitors see.
- [ ] No fabricated dollar figures anywhere — self-serve tier prices are either
      clearly marked as placeholders needing input, or omitted with a "Get started"
      CTA that leads to a real signup flow where pricing is presented at checkout.
- [ ] Enterprise tier always shows "Contact Sales," never a number.
- [ ] Enterprise tier's compliance messaging is pulled from/consistent with the
      existing Compliance & Security section — not independently rewritten copy that
      could drift out of sync.
- [ ] Partnership page's three categories map to real value exchanges (tool
      ecosystem, deployment consulting, lead referral) — not generic "partner with
      us" copy.
- [ ] Both pages follow Prompt 19/19b's design rules: Aurora Thread system present,
      no emoji icons, no flat solid-color cards, responsive at 375px with no
      overflow, dark-mode treatment matches the rest of the site.

## Non-goals

- Do NOT invent final pricing numbers for the self-serve tiers — flag every price
  point as needing real business input and make it trivial to fill in later (a
  single config/constants file for pricing figures, not numbers scattered inline
  across components).
- Do NOT invent partner revenue-share percentages — same treatment as pricing
  numbers.
- Do NOT build a payment/checkout flow in this prompt — that's a separate,
  substantial feature (billing integration, invoicing for enterprise) outside this
  prompt's scope. This prompt is the marketing/positioning pages only.