import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

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
 * resolve real executables (node/python) to an absolute path via PATH.
 */

export interface ResolvedSpawnTarget {
  command: string;
  args: string[];
  /** Extra spawn()/StdioClientTransport options the caller must merge in. */
  options?: { windowsVerbatimArguments?: boolean };
}

const ALLOWLISTED_COMMANDS = new Set(["npx", "node", "python", "python3"]);

// Commands that ship as .cmd/.bat shims on Windows rather than a real .exe.
const WINDOWS_SHIM_COMMANDS = new Set(["npx", "npm", "pnpm", "yarn"]);

// Characters that have no business in a command or argument reaching spawn()
// here — rejecting them outright is cheaper and safer than trying to make
// cmd.exe quoting airtight against them.
const SHELL_METACHARACTERS = /[;&|`$(){}<>^%\r\n]/;

function isAbsolutePathLike(command: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(command) || command.startsWith("/");
}

function assertSafe(command: string, args: string[]): void {
  if (!ALLOWLISTED_COMMANDS.has(command) && !isAbsolutePathLike(command)) {
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

function wrapWithCmd(command: string, args: string[]): ResolvedSpawnTarget {
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", command, ...args.map(quoteCmdArg)],
    options: { windowsVerbatimArguments: true },
  };
}

export function resolveSpawnTarget(command: string, args: string[]): ResolvedSpawnTarget {
  assertSafe(command, args);

  if (process.platform !== "win32") {
    return { command, args };
  }

  if (WINDOWS_SHIM_COMMANDS.has(command)) {
    return wrapWithCmd(command, args);
  }

  // node/python/python3 or an already-absolute path: these are real .exe
  // binaries once resolved — no cmd.exe needed.
  return { command: resolveOnPath(command) ?? command, args };
}
