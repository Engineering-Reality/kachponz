import { existsSync, statSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-platform command resolution for the MCP tool spawn call sites
 * (scripts/mcpAutoManager.ts, src/orchestrator/engine.ts).
 *
 * On Windows, `npx`/`npm`/`pnpm`/`yarn` are `.cmd` shims — Node's
 * child_process.spawn(command, args, { shell: false }) cannot execute a
 * `.cmd` directly (ENOENT, or EINVAL on Node >=18.20.2/20.12 per the
 * CVE-2024-27980 fix). We never fall back to `shell: true` — that would
 * reopen the shell-injection surface the `shell: false` callers were
 * written to avoid. Instead we route shims through `cmd.exe /d /s /c`
 * with our own argument quoting (windowsVerbatimArguments: true), and
 * resolve the real executable (node) to an absolute path via PATH.
 */

export interface ResolvedSpawnTarget {
  command: string;
  args: string[];
  /** Extra spawn()/StdioClientTransport options the caller must merge in. */
  options?: { windowsVerbatimArguments?: boolean; cwd?: string };
}

// CISO rule: absolutely no Python. `python`/`python3` were removed from this
// allowlist (previously ["npx","node","python","python3"]) — assertSpawnSafe()
// now throws for either, which permanently closes Python-based MCP servers
// (the uvx ecosystem). This is an accepted trade-off, not an oversight; see
// docs/security-audit.md. The only DB tool that used python (Supabase MCP
// v1.1.0, a Windows-path app_mcp_rag.py) was already non-functional here.
const ALLOWLISTED_COMMANDS = new Set(["npx", "node"]);

// Commands that ship as .cmd/.bat shims on Windows rather than a real .exe.
const WINDOWS_SHIM_COMMANDS = new Set(["npx", "npm", "pnpm", "yarn"]);

// Characters that have no business in a command or argument reaching spawn()
// here — rejecting them outright is cheaper and safer than trying to make
// cmd.exe quoting airtight against them.
const SHELL_METACHARACTERS = /[;&|`$(){}<>^%\r\n]/;

/**
 * Absolute path of the amadeus-core package root (the dir with package.json),
 * used as the spawn `cwd` for EVERY MCP child at all three call sites
 * (mcpAutoManager SSE, engine stdio x2). spawn()/StdioClientTransport otherwise
 * inherit whatever cwd the parent happened to start from, and `npx
 * --no-install` resolves node_modules/.bin RELATIVE to cwd — without pinning it
 * here the hardening in hardenNpxArgs() would silently fail to find packages.
 * Walks up from this module so it works both under tsx (src/) and compiled
 * (dist/). Memoized. (security-audit.md #1, A2)
 */
let _packageRoot: string | null = null;
export function getPackageRoot(): string {
  if (_packageRoot) return _packageRoot;
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      _packageRoot = dir;
      return dir;
    }
    dir = dirname(dir);
  }
  _packageRoot = process.cwd();
  return _packageRoot;
}

/**
 * Force npx to run cache/vendor-only in every non-dev environment.
 * `npx -y <pkg>` fetches and executes arbitrary code from the npm registry at
 * runtime — the real allowlist hole behind finding #1 (npx itself is
 * allowlisted, its package argument isn't). Outside NODE_ENV=development we
 * rewrite `-y`/`--yes` to `--no-install` (and ensure it's present), so npx only
 * runs a package already installed under the pinned cwd — no runtime registry
 * egress, which also matters for locked-down on-prem deploys. In development we
 * leave `-y` alone for convenience. No-op for any command other than npx.
 * (security-audit.md #1, A2)
 */
export function hardenNpxArgs(command: string, args: string[]): string[] {
  if (command !== "npx") return args;
  if (process.env.NODE_ENV === "development") return args;
  const hardened = args.map((a) => (a === "-y" || a === "--yes" ? "--no-install" : a));
  if (!hardened.includes("--no-install")) hardened.unshift("--no-install");
  return hardened;
}

/**
 * Allowlist + shell-metacharacter gate for EVERY spawn call site.
 * `resolveSpawnTarget()` (scripts/mcpAutoManager.ts) calls this, and BOTH of
 * the engine's direct `StdioClientTransport` paths (loadMcpTools and
 * connectToMcpToolById in src/orchestrator/engine.ts) MUST call it too —
 * otherwise a DB-configured tool command bypasses the allowlist and reaches
 * spawn() unchecked (security-audit.md finding #1).
 *
 * `command` is the RAW value from the DB tool config. It is matched against
 * ALLOWLISTED_COMMANDS with NO exception for absolute paths: an absolute path
 * (`/bin/sh`, `C:\Windows\System32\cmd.exe`) is arbitrary-binary execution,
 * not a safe command. The earlier `!isAbsolutePathLike(command)` escape hatch
 * let any absolute path through — anyone who could write a `tools` row got RCE
 * on this host (finding #1, A1). PATH resolution of an allowlisted command
 * (npx -> C:\...\npx.cmd) happens AFTER this gate in resolveSpawnTarget() and
 * is trusted precisely because the pre-resolution command already passed here.
 */
export function assertSpawnSafe(command: string, args: string[]): void {
  if (!ALLOWLISTED_COMMANDS.has(command)) {
    throw new Error(`spawnCompat: command "${command}" is not allowlisted`);
  }
  if (SHELL_METACHARACTERS.test(command)) {
    throw new Error(`spawnCompat: command contains shell metacharacters: ${command}`);
  }
  for (const arg of args) {
    if (SHELL_METACHARACTERS.test(arg)) {
      throw new Error(`spawnCompat: argument contains shell metacharacters: ${arg}`);
    }
  }
}

/** Windows cmd.exe argv quoting: only whitespace/quotes need escaping since
 * assertSafe() already rejected the shell-meta characters above. */
export function quoteCmdArg(arg: string): string {
  if (arg === "") return '""';
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function resolveOnPath(command: string): string | null {
  const pathVar = process.env.PATH ?? process.env.Path ?? "";
  const pathExt = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(delimiter);
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    for (const ext of ["", ...pathExt]) {
      const candidate = join(dir, command + ext);
      try {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // unreadable dir entry — keep scanning
      }
    }
  }
  return null;
}

function wrapWithCmd(command: string, args: string[], cwd: string): ResolvedSpawnTarget {
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args.map(quoteCmdArg)],
    options: { windowsVerbatimArguments: true, cwd },
  };
}

export function resolveSpawnTarget(command: string, args: string[]): ResolvedSpawnTarget {
  assertSpawnSafe(command, args);
  // Harden npx (registry egress) and pin cwd so `--no-install` resolves — both
  // at EVERY call site. (security-audit.md #1, A2)
  const hardenedArgs = hardenNpxArgs(command, args);
  const cwd = getPackageRoot();

  if (process.platform !== "win32") {
    return { command, args: hardenedArgs, options: { cwd } };
  }

  if (WINDOWS_SHIM_COMMANDS.has(command)) {
    return wrapWithCmd(command, hardenedArgs, cwd);
  }

  // node: a real .exe binary once resolved on PATH — no cmd.exe needed.
  // (Absolute-path commands can't reach here; assertSpawnSafe rejects anything
  // outside ALLOWLISTED_COMMANDS, and python was removed from it.)
  return { command: resolveOnPath(command) ?? command, args: hardenedArgs, options: { cwd } };
}
