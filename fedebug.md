# Prompt #6 — Amadeus: Diagnose the localhost:3000 Hang (Strict Protocol, No Exploration)

## Read this before doing anything

The previous session on this exact bug spent a huge number of tool calls on process
forensics (`strace`, `perf`, thread-name inspection, inotify fd counting, orphaned
background `npm run dev` processes piling up across retries) and never converged.
Two structural problems caused that:

1. **`strace -p <pid>` fails in this sandbox** — `ptrace(PTRACE_SEIZE, ...)`: Operation
   not permitted. This was already proven in the last session. **Do not attempt
   `strace`, `perf record`, `perf top`, `ltrace`, or any other ptrace-based tool again.**
   It cannot work here, full stop — don't spend a single tool call re-verifying this.
2. **No clean teardown between test runs.** Backgrounded `npm run dev` calls were
   started repeatedly without killing the previous one first, so later tests were
   sampling stale/orphaned processes (note in the transcript: "elapsed time doesn't
   match — this process may be an orphan"). Every test below starts with a mandatory
   teardown step. Do not skip it, even if you think the previous process already died.

**This prompt is a fixed decision tree, not a starting point for exploration.** Follow
the steps in order. Each step has an explicit pass/fail condition telling you exactly
which step to go to next. Do not deviate, do not add extra diagnostic commands beyond
what's listed, and do not go back to process-level forensics (thread CPU sampling,
inotify fd counts, etc.) — those were already tried and were not decisive. If you reach
the end of this protocol without a confirmed cause, STOP and report the raw output of
every step to Jandy instead of continuing to improvise new diagnostics.

## Step 0 — Mandatory clean teardown (run before EVERY step below that starts a server)

```bash
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 2
ss -tlnp 2>&1 | grep 3000 || echo "port 3000 is free"
```

Do not proceed to any step that starts `npm run dev` until this prints "port 3000 is
free". If it's still bound, find the PID with `ss -tlnp | grep 3000` and `kill -9` it
specifically, then re-check.

## Step 1 — Decisive triage: is this project-specific, or environment-wide?

This single test separates "something about this codebase" from "something about this
machine/network" in one shot, without touching this project's code at all.

```bash
cd /tmp
rm -rf scratch-nextjs-test
npx --yes create-next-app@latest scratch-nextjs-test --yes --ts --tailwind --no-eslint --app --src-dir --import-alias "@/*" 2>&1 | tail -30
cd scratch-nextjs-test
timeout 30 npm run dev > /tmp/scratch-dev.log 2>&1 &
SCRATCH_PID=$!
sleep 6
curl -sv --max-time 15 http://localhost:3000/ -o /tmp/scratch-home.html 2>&1 | tail -20
echo "curl exit code: $?"
wc -c /tmp/scratch-home.html
kill -9 $SCRATCH_PID 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
```

- **If the scratch app loads fine** (curl returns quickly, `scratch-home.html` has
  real HTML content, not empty) → the bug is specific to the `microservice/frontend`
  project. Go to Step 2.
- **If the scratch app ALSO hangs the same way** → this is environment/network-wide,
  not a bug in this codebase at all. Go to Step 1b.

### Step 1b — only if the scratch app also hung

`create-next-app`'s default template also uses `next/font/google` (the Geist font).
Confirm network reachability directly:

```bash
curl -sv --max-time 5 https://fonts.googleapis.com/css2?family=Inter -o /dev/null 2>&1 | tail -15
curl -sv --max-time 5 https://fonts.gstatic.com -o /dev/null 2>&1 | tail -15
curl -sv --max-time 5 https://registry.npmjs.org -o /dev/null 2>&1 | tail -10
```

If the Google Fonts domains time out or fail to connect while `registry.npmjs.org`
succeeds, that confirms: this machine can reach npm but not Google's font CDN — the
network-level cause of the hang, applying to ANY Next.js project using
`next/font/google`, not just Amadeus. Report this to Jandy as an infra/network finding
(possibly a corporate proxy or firewall rule blocking `fonts.googleapis.com` /
`fonts.gstatic.com` specifically) — this is outside what code changes can fix. Skip
straight to Step 4 (the self-hosted font fix) since you already know the cause.

## Step 2 — only if the scratch app worked: bisect fonts in the real project

```bash
# Step 0 teardown first — always
pkill -9 -f "next dev" 2>/dev/null; pkill -9 -f "next-server" 2>/dev/null; sleep 2

cd /path/to/microservice/frontend
cp src/app/layout.tsx /tmp/layout.tsx.orig
```

Edit `src/app/layout.tsx` temporarily: replace the three `next/font/google` calls with
inert placeholders that produce no network call at all:

```ts
// Temporarily replace:
// const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
// const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });
// const poppins = Poppins({ variable: "--font-ui", subsets: ["latin"], weight: [...] });
// with:
const inter = { variable: "" };
const jetbrainsMono = { variable: "" };
const poppins = { variable: "" };
```

Comment out the `import { Inter, JetBrains_Mono, Poppins } from "next/font/google";`
line too (unused-import errors will otherwise block compilation).

```bash
rm -rf .next
timeout 30 npm run dev > /tmp/nextdev-nofont.log 2>&1 &
DEV_PID=$!
sleep 6
curl -sv --max-time 15 http://localhost:3000/ -o /tmp/home-nofont.html 2>&1 | tail -20
echo "curl exit code: $?"
wc -c /tmp/home-nofont.html
kill -9 $DEV_PID 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
cp /tmp/layout.tsx.orig src/app/layout.tsx  # restore before continuing regardless of result
```

- **If this loads instantly with real content** → fonts confirmed as the cause. Go to
  Step 4.
- **If it still hangs** → fonts are not the cause in this project. Go to Step 3.

## Step 3 — only if fonts were ruled out: check the file-watcher scope

The dev server process's threads include `tokio-runtime-w` and `notify-rs inoti` (both
from Turbopack's Rust-based file watcher, the `notify` crate). If Turbopack ends up
watching a much larger directory tree than intended — e.g. because `turbopack.root`
resolves somewhere unexpected, or a huge binary/data file sits inside the watched
tree — initial watch setup or a watch storm can stall the first request. This project
has some genuinely large files elsewhere in the repo (a 41MB `.pt` model file, a 34MB
SQL dump) — worth ruling out whether any of that is inside what Turbopack actually
watches, even though it shouldn't be given `turbopack.root` is set to the frontend
folder itself.

```bash
cd /path/to/microservice/frontend
cat next.config.ts   # confirm turbopack.root value
node -e "console.log(require('path').resolve('.'))"   # confirm what __dirname resolves to when Next.js runs

# Confirm the file count Turbopack would actually need to watch, from the resolved root:
find . -path ./node_modules -prune -o -path ./.next -prune -o -type f -print 2>&1 | wc -l

# inotify limits — a low limit combined with a large watched tree is a known failure mode:
cat /proc/sys/fs/inotify/max_user_watches
cat /proc/sys/fs/inotify/max_user_instances
```

If `turbopack.root` resolves to anything OTHER than `microservice/frontend` itself
(e.g. it resolved to the monorepo root, accidentally pulling in `database/`,
`backend/Amadeus/models/`, etc.), that's the bug — fix `next.config.ts` so
`path.join(__dirname)` genuinely points at the frontend package, not a parent
directory. `__dirname` in a `next.config.ts` at `microservice/frontend/next.config.ts`
should already resolve correctly; if it doesn't, something unusual is happening with
how the config is loaded — report the actual resolved value to Jandy rather than
guessing further.

If the file count under the resolved root is reasonable (a few thousand, typical for
a Next.js app + `node_modules`) and inotify limits are comfortably above that, this
hypothesis is ruled out too — STOP here and report all raw output from steps 1–3 to
Jandy rather than inventing new diagnostics. Do not proceed to thread/CPU-level
forensics; that path was already exhausted in the previous session with no result.

## Step 4 — Apply the fix (only after a cause is confirmed by one of the steps above)

If fonts were the confirmed or strongly suspected cause (Step 1b or Step 2), apply the
self-hosted font fix:

1. Get the three font families as local `.woff2` files. If `registry.npmjs.org` is
   reachable (confirmed in Step 1b), the fastest path is:
   ```bash
   cd /path/to/microservice/frontend
   npm install @fontsource-variable/inter @fontsource-variable/jetbrains-mono @fontsource/poppins
   ```
2. Replace the `next/font/google` usage in `layout.tsx` with direct CSS imports from
   the installed packages instead of `next/font/local` (simpler than sourcing raw
   `.woff2` files manually, and these packages already ship correctly-licensed,
   self-hosted font files with zero network dependency at request time):
   ```ts
   import "@fontsource-variable/inter";
   import "@fontsource-variable/jetbrains-mono";
   import "@fontsource/poppins/400.css";
   import "@fontsource/poppins/500.css";
   import "@fontsource/poppins/600.css";
   import "@fontsource/poppins/700.css";
   ```
   Then set the CSS variables (`--font-sans`, `--font-mono`, `--font-ui`) directly in
   `globals.css` to the font-family names these packages register (`"Inter Variable"`,
   `"JetBrains Mono Variable"`, `"Poppins"`), instead of via `next/font`'s
   `.variable` mechanism.
3. Re-run Step 0 teardown, then `rm -rf .next && npm run dev`, confirm `curl
   http://localhost:3000/` returns instantly.

If the file-watcher scope was the confirmed cause (Step 3), fix `turbopack.root` to
point at the correct, narrower directory and re-test the same way.

## Acceptance criteria

- [ ] Every test in this protocol was preceded by the Step 0 teardown — no orphaned
      `next dev`/`next-server` processes exist at the end.
- [ ] A single, specific cause is identified and stated explicitly (not "probably
      fonts" — either confirmed via Step 1b/Step 2's clean before/after comparison, or
      confirmed via Step 3's file-count/inotify numbers).
- [ ] `curl --max-time 15 http://localhost:3000/` returns real HTML content in under 5
      seconds on a freshly started, single dev server instance.
- [ ] No `strace`, `perf`, `ltrace`, or thread-level CPU sampling was attempted in this
      session — those are known dead ends here.
- [ ] The scratch test app at `/tmp/scratch-nextjs-test` is deleted once triage is
      done (`rm -rf /tmp/scratch-nextjs-test`) — don't leave it lying around.
