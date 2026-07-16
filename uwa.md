# Prompt #19b — Fix "Why Amadeus", "Explore the Platform", FAQ/Compliance Sections

This is a REVISION of the marketing site, not an addendum. Read prompt 19's design
system (Aurora Thread, aurora spectrum, avoid-list) first — this prompt applies that
system to three specific sections that were left untouched and still look
AI-generated. Every instruction below is keyed to what's ACTUALLY on screen right now
(per the screenshots), not hypothetical.

## Read the frontend-design skill at /mnt/skills/public/frontend-design/SKILL.md first

Follow its full process: brainstorm a design plan, self-critique against the avoid
list, THEN build. Do not jump straight to code.

---

## Section 1 — "Why Amadeus?" (THE PHILOSOPHY)

### What's wrong right now (be honest with yourself as you read this)

- **Three flat solid-color cards (hot pink `#EC4899`, gold `#EAB308`, sky blue
  `#38BEF8`)** sitting side-by-side with zero connection to the brand's aurora
  palette. These colors don't appear ANYWHERE else on the site — they're candy colors
  dropped into an otherwise indigo/fuchsia/lilac palette, visually jarring, and read
  as "I let the AI pick three random bright colors for three cards."
- **Emoji icons** (🧑‍💻 🧠 🤖) as the card headers — emojis as visual anchors in a
  card layout are the #1 tell of AI-generated marketing pages. Every AI tool does
  this. Replace with custom iconography or remove entirely.
- **"wallahi we're doomed"** in the Humans card — this is funny in conversation but
  clashes hard with the "enterprise banking platform" positioning. It would make a
  compliance officer pause. Either commit to the irreverent tone across the WHOLE
  site (which it doesn't — the rest is formal) or remove it here. Inconsistent tone
  is worse than either choice.
- **Centered-everything layout** — headline centered, subtext centered, three cards
  centered, all the same width, all the same height. No visual hierarchy, no
  asymmetry, no breathing room.

### What to build instead

**Layout**: asymmetric two-row composition, NOT three equal cards.

Row 1 (the thesis): a single wide statement block spanning ~65% width, left-aligned,
with the "AI doesn't fix a disorganized company" quote as a large pull-quote
(`font-size: clamp(1.5rem, 3vw, 2.2rem)`) with a thin Aurora Thread line accent on
its left edge (vertical, 2px, aurora gradient). The remaining ~35% is a subtle
illustration zone — NOT an AI-generated image, but an abstract SVG composition using
the aurora spectrum (overlapping translucent circles or a simplified version of the
Aurora Thread mesh from the hero, at lower opacity). This replaces the need for any
"visual" while staying on-brand.

Row 2 (the three actors): Humans / Agents / Robots as three elements, but NOT
equal-sized colored cards. Instead:

```
┌─────────────────────────────────────────────────────────────┐
│  [icon]  Humans                                             │
│  Want automation. Demand compliance.                        │
│  ─────────────────────────────────────────────              │
│  [icon]  AI Agents                                          │
│  Connect via MCP. High automation — compliance trade-off.   │
│  ─────────────────────────────────────────────              │
│  [icon]  Robots (RPA)                                       │
│  Operate via UI. High compliance — flexibility trade-off.   │
└─────────────────────────────────────────────────────────────┘
```

A single card/panel (dark indigo `#1E1B4B` background, matching the site's dark
surfaces), three ROWS inside it separated by subtle `1px` dividers (aurora gradient
dividers, not gray lines), each row showing: a small custom SVG icon (feather-icon
style, monochrome in the aurora-fuchsia color — NOT emoji), the actor name as a
bold label, and a one-line description. This is compact, scannable, and looks like
a real product comparison — not a kindergarten color-sorting exercise.

**Icons**: use `react-icons/fi` (Feather) — `FiUser` for Humans, `FiCpu` for
Agents, `FiTool` for Robots — rendered in `--aurora-fuchsia` on dark, or
`--aurora-violet` on light. Do NOT use emoji anywhere in this section.

**The "RPA + Agents = APA" formula** below the cards: keep, but restyle — it should
be a badge/pill component (like the kicker pills already used elsewhere on the site,
per prompt 19's `kicker` pattern), not a plain text line. Background
`--aurora-fuchsia` at 15% opacity, text in `--aurora-fuchsia`, rounded-full, centered.

---

## Section 2 — "Explore the Platform" (CAPABILITIES)

### What's wrong right now

- **An AI-generated glowing pink brain image** is the hero visual for "Agent Creator."
  This is the single most damaging element on the entire site — it screams
  "AI-generated" louder than anything else. It has zero connection to what Agent
  Creator actually looks like. A visitor who clicks "Explore Agent Creator →" and
  lands on a normal form-based UI will feel deceived.
- **Generic bullet points** with green checkmarks ("Natural language agent
  generation", "Assign personas and instructions easily") — these read like they
  were generated by asking an LLM "list three features of an agent creator tool."
  They're not wrong, but they're not specific to THIS product either.
- **Light/white background abruptly** after the dark "Why Amadeus" section above —
  the transition is harsh, no visual continuity.

### What to build instead

**Kill the AI image.** Replace it with one of these, in order of preference:

1. **An actual screenshot or screen recording of the Agent Creator page** (the real
   `/agent-creator` UI that exists in the product right now) — embedded as a video
   that autoplays muted on scroll-into-view, inside a device-frame mockup (a
   browser-chrome SVG wrapper, rounded corners, subtle shadow). This is the
   highest-trust option because it shows the REAL product.
2. If a polished screenshot isn't available yet, **a clean SVG illustration** showing
   the Agent Creator's actual UI structure abstractly — a form with labeled fields
   (agent name, system prompt, tool attachment), drawn as simple rectangles with
   rounded corners and aurora-gradient accent lines, NOT a photorealistic render or
   AI art. Think wireframe-as-art, not "glowing brain."
3. **Nothing.** An empty right column with just the Aurora Thread mesh glow (from the
   hero, at low opacity) is genuinely better than an AI-generated brain image. White
   space > fake visual.

**Vertical tab navigation (left sidebar)**: the current Agent Creator / Agents /
Tools / Playground tab list is fine structurally — keep it. But style it to match the
site's dark design language instead of the current light/gray treatment:
- Active tab: aurora-fuchsia left border accent (2px), white text.
- Inactive tabs: muted text (the existing `--aurora-violet` at 60% opacity), no
  border.
- Background: transparent or very subtle `rgba(30, 27, 75, 0.03)` tint — NOT the
  current flat white/gray panel.

**Feature bullets**: rewrite to be specific to Amadeus's actual capabilities, not
generic. Instead of "Natural language agent generation", try:
- "Attach any MCP-compatible tool — UiPath, Power Automate, custom APIs"
- "Configure Loop Mode recipes per agent — deterministic multi-step execution"
- "System prompt per agent — each agent gets its own behavior spec"
These are things that are TRUE about this specific product, not things any agent
builder could claim.

**Section transition**: use the Aurora Thread line-divider (from prompt 19's
signature element) between "Why Amadeus" and "Explore the Platform" — the thin
glowing line drawn on scroll, connecting the two sections visually instead of a hard
background-color cut.

---

## Section 3 — FAQ + Compliance & Security

### What's wrong right now

- **FAQ accordion** is a generic dark glassmorphic panel with no brand personality —
  it works but it's forgettable. The expand/collapse chevron is default.
- **Compliance numbered list (01-05)** — this is the one place where numbered markers
  ARE justified (these are real, distinct compliance certifications in a meaningful
  order). The issue isn't the numbering, it's that the numbers are styled in a
  washed-out muted gray that looks like placeholder text, not confident branding.
- **The two halves (FAQ left, Compliance right) feel disconnected** — they're
  side-by-side but have no visual relationship, like two separate components pasted
  next to each other.

### What to build instead

**Unify with a shared visual container**: wrap both FAQ and Compliance in a single
large panel with the dark indigo background (`#0B0A1F` — the deep dark-mode bg from
prompt 19), a very subtle Aurora Thread mesh glow in the top-right corner (low
opacity, large blur, just enough to connect this section to the site's signature
element), and a single `border: 1px solid rgba(139, 92, 246, 0.15)` (aurora-violet
at low opacity) around the whole panel.

**FAQ accordion styling**:
- Closed state: text only, no visible card/panel per item — just the question text
  with a `+` or a custom chevron icon in `--aurora-fuchsia`.
- Open state: question text gets brighter (white instead of muted), answer fades in
  below with a left border accent (2px, aurora gradient, same as the Why Amadeus
  row dividers) — this creates visual continuity with the Aurora Thread system.
- Transition: smooth height animation (`max-height` + `opacity`), 200ms, ease-out.

**Compliance list styling**:
- Numbers `01`–`05`: render in `--aurora-fuchsia` instead of muted gray — these are
  confidence markers (certifications!), they should look proud, not apologetic.
- Each item's icon: keep, but render in `--aurora-violet` instead of the current
  muted tone.
- Add a very subtle horizontal aurora-gradient line (`height: 1px`, `opacity: 0.2`)
  between items instead of the current full-width gray divider — consistent with
  the divider system used in Section 1.

---

## General rules (apply to ALL three sections, not just one)

1. **Zero AI-generated images anywhere.** If a section needs a visual and no real
   product screenshot is available, use an abstract SVG composition from the aurora
   spectrum, or use nothing. An empty space with a subtle gradient glow is more
   professional than a fake glowing brain.
2. **Zero emoji as visual anchors.** Small inline emoji in body text (sparingly) is
   fine; emoji as card headers or section icons is not. Use `react-icons/fi`
   (Feather) or custom SVG icons in brand colors instead.
3. **No flat solid-color card backgrounds** (no hot pink, no gold, no sky blue, no
   any-random-color cards). Card backgrounds are either: transparent (content
   floats on the section background), or the site's own surface colors (`#1E1B4B`
   for dark cards, `#F3E8FF` for light cards, `white` for light-mode cards).
   Accent color appears as thin borders, left-edge accents, or icon tint — NOT as
   the entire card fill.
4. **Copy must be specific to Amadeus, not interchangeable.** Before writing any
   feature bullet or description, ask: "could I paste this text on ANY competitor's
   site and it would still be true?" If yes, rewrite it until the answer is no.
   "Natural language agent generation" → generic. "Attach MCP tools and configure
   Loop Mode recipes per agent" → specific to this product.
5. **Every section must use at least one element from the Aurora Thread system**
   (the gradient line divider, the mesh glow, or the spectrum-colored icon tint) —
   this is what creates visual continuity across the page instead of each section
   looking like a different template was used.

## Build process

1. Kill the AI brain image FIRST — that's the single highest-impact change, takes
   30 seconds, immediately raises the credibility floor of the whole page.
2. Rebuild "Why Amadeus" as the asymmetric two-row layout described above.
3. Rebuild "Explore the Platform" with a real screenshot (or SVG wireframe, or
   nothing) in place of the AI image, and rewrite the bullets to be product-specific.
4. Restyle FAQ + Compliance with the unified panel and aurora accents.
5. Screenshot each at desktop AND 375px width — verify no overflow, no clipping,
   no element that looks different in quality from the rest of the page.

## Acceptance criteria

- [ ] Zero AI-generated images on the page — grep for any `<img>` whose `src`
      points at an AI art asset and confirm all are replaced or removed.
- [ ] Zero emoji used as card headers or section icons — `react-icons/fi` or custom
      SVG only for visual anchors.
- [ ] No flat solid-color card backgrounds (pink/yellow/blue/etc.) — all card fills
      use the site's own surface palette.
- [ ] "Explore the Platform" shows either a real product screenshot, an abstract SVG,
      or intentional white space — not a stock/AI illustration.
- [ ] Aurora Thread system (gradient line, mesh glow, or spectrum icon tint) present
      in all three rebuilt sections.
- [ ] Copy in "Explore the Platform" bullets is specific to Amadeus's actual
      features, not generic agent-builder claims.
- [ ] Responsive at 375px — all three sections tested, no overflow.
