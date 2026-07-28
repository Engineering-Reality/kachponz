import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertSpawnSafe,
  getPackageRoot,
  hardenNpxArgs,
  quoteCmdArg,
  resolveSpawnTarget,
} from "../src/lib/spawnCompat.js";

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

// Vitest runs with NODE_ENV=test, so hardenNpxArgs is in its "force --no-install"
// (non-dev) mode by default — that is the production/on-prem behavior we most
// want covered. Tests that need dev behavior flip NODE_ENV explicitly.
const ROOT = getPackageRoot();

describe("resolveSpawnTarget (SSE path — mcpAutoManager)", () => {
  const originalPlatform = process.platform;
  afterEach(() => setPlatform(originalPlatform));

  it("hardens npx -y to --no-install and pins cwd on non-Windows", () => {
    setPlatform("linux");
    const result = resolveSpawnTarget("npx", ["-y", "amadeus-mcp@latest"]);
    expect(result).toEqual({
      command: "npx",
      args: ["--no-install", "amadeus-mcp@latest"],
      options: { cwd: ROOT },
    });
  });

  it("pins cwd for node too (no arg rewrite)", () => {
    setPlatform("darwin");
    const result = resolveSpawnTarget("node", ["/opt/tools/index.js"]);
    expect(result).toEqual({
      command: "node",
      args: ["/opt/tools/index.js"],
      options: { cwd: ROOT },
    });
  });

  it("wraps npx in cmd.exe on Windows, still hardened + cwd", () => {
    setPlatform("win32");
    const result = resolveSpawnTarget("npx", ["-y", "amadeus-mcp@latest"]);
    expect(result.command).toBe("cmd.exe");
    expect(result.args).toEqual(["/d", "/s", "/c", "npx", "--no-install", "amadeus-mcp@latest"]);
    expect(result.options).toEqual({ windowsVerbatimArguments: true, cwd: ROOT });
  });

  it("does not wrap node on Windows in cmd.exe, but still pins cwd", () => {
    setPlatform("win32");
    const result = resolveSpawnTarget("node", ["C:\\tools\\mcp-uipath\\build\\index.js"]);
    expect(result.command).not.toBe("cmd.exe");
    expect(result.options).toEqual({ cwd: ROOT });
  });

  it("rejects a command not on the allowlist", () => {
    setPlatform("linux");
    expect(() => resolveSpawnTarget("curl", ["http://example.com"])).toThrow(/not allowlisted/);
  });

  // security-audit.md finding #1 / A1: an absolute path is NOT a substitute for
  // the allowlist. Before the A1 fix these lolos karena assertSpawnSafe punya
  // escape hatch `!isAbsolutePathLike(command)` — RCE via any DB-writable tool row.
  it("rejects an absolute unix path command not on the allowlist", () => {
    setPlatform("linux");
    expect(() => resolveSpawnTarget("/bin/sh", ["-c", "id"])).toThrow(/not allowlisted/);
  });

  it("rejects an absolute windows path command not on the allowlist", () => {
    setPlatform("win32");
    expect(() => resolveSpawnTarget("C:\\Windows\\System32\\cmd.exe", [])).toThrow(/not allowlisted/);
  });

  it("still allows an allowlisted command whose args carry an absolute path", () => {
    setPlatform("linux");
    // The DB stdio tools are `node <absolute-entry.js>` — the path is an ARG,
    // the command stays `node`. A1 must not regress this.
    const result = resolveSpawnTarget("node", ["/opt/mcp/build/index.js", "--stdio"]);
    expect(result).toEqual({
      command: "node",
      args: ["/opt/mcp/build/index.js", "--stdio"],
      options: { cwd: ROOT },
    });
  });

  it("rejects an argument containing shell metacharacters", () => {
    setPlatform("linux");
    expect(() => resolveSpawnTarget("node", ["index.js", "$(whoami)"])).toThrow(/metacharacters/);
  });
});

// CISO rule: absolutely no Python. `python`/`python3` were removed from
// ALLOWLISTED_COMMANDS — assertSpawnSafe must now reject them like any other
// non-allowlisted command. This permanently closes Python/uvx-based MCP
// servers (accepted trade-off, see docs/security-audit.md).
describe("assertSpawnSafe rejects python (removed from allowlist)", () => {
  it("throws for python", () => {
    expect(() => assertSpawnSafe("python", [])).toThrow(/not allowlisted/);
  });

  it("throws for python3", () => {
    expect(() => assertSpawnSafe("python3", [])).toThrow(/not allowlisted/);
  });

  it("still allows node and npx", () => {
    expect(() => assertSpawnSafe("node", ["/abs/index.js"])).not.toThrow();
    expect(() => assertSpawnSafe("npx", ["--no-install", "pkg"])).not.toThrow();
  });
});

// The stdio spawn path (engine.ts:490 loadMcpTools, engine.ts:717
// connectToMcpToolById) does not go through resolveSpawnTarget — it builds
// StdioClientTransport directly, applying these exact two helpers. Testing them
// here is the characterization for BOTH stdio call sites (security-audit.md #1, A2).
describe("hardenNpxArgs (shared by SSE + stdio spawn paths)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("rewrites -y to --no-install outside development (prod/on-prem)", () => {
    process.env.NODE_ENV = "production";
    expect(hardenNpxArgs("npx", ["-y", "mcp-remote", "https://mcp.linear.app/mcp"])).toEqual([
      "--no-install",
      "mcp-remote",
      "https://mcp.linear.app/mcp",
    ]);
  });

  it("rewrites --yes too", () => {
    process.env.NODE_ENV = "production";
    expect(hardenNpxArgs("npx", ["--yes", "pkg"])).toEqual(["--no-install", "pkg"]);
  });

  it("injects --no-install when the tool had no -y at all", () => {
    process.env.NODE_ENV = "staging";
    expect(hardenNpxArgs("npx", ["mcp-remote"])).toEqual(["--no-install", "mcp-remote"]);
  });

  it("is idempotent when --no-install is already present", () => {
    process.env.NODE_ENV = "production";
    expect(hardenNpxArgs("npx", ["--no-install", "pkg"])).toEqual(["--no-install", "pkg"]);
  });

  it("leaves -y alone in development (dev convenience)", () => {
    process.env.NODE_ENV = "development";
    expect(hardenNpxArgs("npx", ["-y", "pkg"])).toEqual(["-y", "pkg"]);
  });

  it("is a no-op for non-npx commands (node)", () => {
    process.env.NODE_ENV = "production";
    expect(hardenNpxArgs("node", ["-y", "/abs/index.js"])).toEqual(["-y", "/abs/index.js"]);
  });
});

describe("getPackageRoot", () => {
  it("resolves to the amadeus-core package root (dir with package.json)", () => {
    const root = getPackageRoot();
    expect(existsSync(join(root, "package.json"))).toBe(true);
  });
});

// Guards the exact asymmetry called out in the A2 review: if a future edit adds
// a stdio spawn site (or drops cwd/harden from one), SSE tools keep working
// while stdio tools silently fail to resolve packages. Assert EVERY
// StdioClientTransport in the engine pins cwd and hardens npx.
describe("engine stdio spawn sites stay symmetric with cwd + npx hardening", () => {
  const engineSrc = readFileSync(
    new URL("../src/orchestrator/engine.ts", import.meta.url),
    "utf8",
  );
  const stdioSites = engineSrc.match(/new StdioClientTransport\(/g)?.length ?? 0;

  it("has at least the two known stdio sites", () => {
    expect(stdioSites).toBeGreaterThanOrEqual(2);
  });

  it("pins cwd: getPackageRoot() once per stdio site", () => {
    const cwdCount = engineSrc.match(/cwd:\s*getPackageRoot\(\)/g)?.length ?? 0;
    expect(cwdCount).toBe(stdioSites);
  });

  it("applies hardenNpxArgs once per stdio site", () => {
    const hardenCount = engineSrc.match(/hardenNpxArgs\(/g)?.length ?? 0;
    expect(hardenCount).toBe(stdioSites);
  });
});

describe("quoteCmdArg", () => {
  it("leaves plain arguments untouched", () => {
    expect(quoteCmdArg("amadeus-mcp@latest")).toBe("amadeus-mcp@latest");
  });

  it("quotes arguments containing spaces", () => {
    expect(quoteCmdArg("C:\\Program Files\\node\\index.js")).toBe('"C:\\Program Files\\node\\index.js"');
  });

  it("escapes embedded double quotes", () => {
    expect(quoteCmdArg('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes an empty string", () => {
    expect(quoteCmdArg("")).toBe('""');
  });
});
