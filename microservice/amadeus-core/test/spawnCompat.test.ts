import { afterEach, describe, expect, it } from "vitest";
import { quoteCmdArg, resolveSpawnTarget } from "../src/lib/spawnCompat.js";

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

describe("resolveSpawnTarget", () => {
  const originalPlatform = process.platform;
  afterEach(() => setPlatform(originalPlatform));

  it("passes non-Windows platforms through unchanged", () => {
    setPlatform("linux");
    const result = resolveSpawnTarget("npx", ["-y", "amadeus-mcp@latest"]);
    expect(result).toEqual({ command: "npx", args: ["-y", "amadeus-mcp@latest"] });
  });

  it("passes macOS through unchanged too", () => {
    setPlatform("darwin");
    const result = resolveSpawnTarget("node", ["/opt/tools/index.js"]);
    expect(result).toEqual({ command: "node", args: ["/opt/tools/index.js"] });
  });

  it("wraps npx in cmd.exe on Windows with verbatim quoting", () => {
    setPlatform("win32");
    const result = resolveSpawnTarget("npx", ["-y", "amadeus-mcp@latest"]);
    expect(result.command).toBe("cmd.exe");
    expect(result.args).toEqual(["/d", "/s", "/c", "npx", "-y", "amadeus-mcp@latest"]);
    expect(result.options).toEqual({ windowsVerbatimArguments: true });
  });

  it("does not wrap node/python on Windows in cmd.exe", () => {
    setPlatform("win32");
    const result = resolveSpawnTarget("node", ["C:\\tools\\mcp-uipath\\build\\index.js"]);
    expect(result.command).not.toBe("cmd.exe");
    expect(result.options).toBeUndefined();
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
    expect(result).toEqual({ command: "node", args: ["/opt/mcp/build/index.js", "--stdio"] });
  });

  it("rejects an argument containing shell metacharacters", () => {
    setPlatform("linux");
    expect(() => resolveSpawnTarget("node", ["index.js", "$(whoami)"])).toThrow(/metacharacters/);
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
