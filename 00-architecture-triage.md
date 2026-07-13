# Prompt #0 — Amadeus: Architecture Triage (Read This First)

You said "arsitekturku berantakan" (my architecture is a mess). Based on what's actually in the zip, here's the honest state and the order to fix it in. This isn't a Claude Code prompt to execute — it's the map for prompts 01–04.

## What's actually going on, structurally

You have **three generations of the same system living in one repo**:

1. **Gen 1 — root-level Python** (`app.py`, `auth_middleware.py`, `requirements.txt` at repo root). Legacy, per your own note.
2. **Gen 2 — `backend/Amadeus/`** — a near-duplicate of the root Python app plus a Vite frontend, PLUS a 42MB `.pt` model file and PNGs sitting in `models/`. This looks like an earlier snapshot of Amadeus that got copy-pasted into a subfolder rather than replaced. It still has its own `app.py`, `auth_middleware.py`, `requirements.txt` — nearly identical filenames to the root.
3. **Gen 3 — `microservice/`** — the real TypeScript rewrite (`transaction_tracker` = the actual orchestrator engine, `frontend` = the Next.js app you're running). This is where all real development is happening per the engine.ts code quality (typed, tested-looking, well-commented).

Additionally: `microservice/mcp_2/` and `microservice/mcp_tools/` are **Python**, actively invoked by the current system (the manager that spawns MCP servers), even though the direction of travel is clearly toward TypeScript. This is the biggest source of "which version is real" confusion, because it's Python that's still load-bearing, not legacy-in-name-only.

## Why this matters for the bugs you're hitting

The three bugs you reported (agent won't loop, auth fetch failures, transport confusion) all trace back to the **seam between Gen 3 TypeScript and the still-load-bearing Python MCP manager**:

- The looping problem (prompt 01) is entirely inside `transaction_tracker` — no Python involved. Safe to fix first, no architecture cleanup required.
- The auth fetch failures (prompt 02) touch both `transaction_tracker`'s `uipathAuth.ts` AND the separate mcp-uipath sibling server's own OAuth — two independent implementations of the same OAuth flow that can drift out of sync. This is architecture debt, not just a bug.
- The transport toggle (prompt 03) is the seam itself: `engine.ts` already supports picking stdio vs SSE, but `mcp_auto_manager.py` overrides that choice and forces SSE always. This is the clearest evidence that Python-Gen-2-in-disguise is actively fighting the TypeScript rewrite's design intent.

## Recommended order

1. **Prompt 01 first** (agent autonomous loop) — pure TypeScript, self-contained, immediately fixes your most painful symptom (the survey automation not actually running end-to-end).
2. **Prompt 02 second** (auth resilience) — fixes the recurring "Auth failed: fetch failed" you're hitting constantly, which will otherwise keep interrupting your testing of prompt 01's fix.
3. **Prompt 04 third** (frontend fetch resilience + workspace root) — quick, mechanical, removes noise so you can actually see real errors instead of console spam.
4. **Prompt 03 last** (MCP transport toggle) — the biggest one, touches the Python/TypeScript seam directly. Do this once 01/02/04 are stable so you're not debugging transport issues on top of looping issues on top of auth issues simultaneously.

## Separately — not a Claude Code prompt, a decision you need to make

Before or alongside prompt 03, decide what happens to:

- **`backend/Amadeus/`** — is this folder still referenced by anything running, or is it a dead snapshot? If dead, delete it (42MB model file + duplicate app.py is pure confusion for anyone else touching this repo, including future-you). If it's still imported somewhere, that's worth knowing explicitly rather than discovering by accident.
- **Root-level `app.py` vs `backend/Amadeus/backend/app.py`** — same question. Are these the same file copy-pasted, or have they diverged? A quick `diff` will tell you in 10 seconds:
  ```bash
  diff app.py backend/Amadeus/backend/app.py
  ```
  Run this yourself before your next Claude Code session — it's a 10-second check that will save a lot of ambiguity in future prompts.
- **`microservice/mcp_2/` and `microservice/mcp_tools/`** — these are the two Python pieces prompt 03 has to touch. Confirm with yourself: is the plan to eventually delete these once the TS spawner (prompt 03, Part C) is proven, or do they need to coexist indefinitely for some tools that can only run in Python? If there's a hard reason some tools must stay Python-hosted, note that now — it changes how aggressively prompt 03 can simplify things.

## One naming suggestion, not urgent

`others/prompts/`, `new.md`, `new2.md`, `sleep.md`, `rpc1.md`, `bugfix1.md`, `authmcp.md`, `mcp_refactor_prompt.md` at the repo root are all working notes from past sessions (matches your stated pattern of getting markdown prompts back from Claude Code). Worth a `docs/history/` folder once things stabilize, purely so root `ls` stops being 15 loose markdown files — but this is cosmetic, do it whenever, not blocking.
