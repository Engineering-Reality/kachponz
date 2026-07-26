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

  it("allows an absolute path command even though it isn't in the allowlist set", () => {
    setPlatform("linux");
    const result = resolveSpawnTarget("/usr/local/bin/amadeus-mcp", ["--stdio"]);
    expect(result).toEqual({ command: "/usr/local/bin/amadeus-mcp", args: ["--stdio"] });
  });

  it("rejects an allowlisted-path command containing shell metacharacters", () => {
    setPlatform("linux");
    expect(() => resolveSpawnTarget("/usr/local/bin/tool; rm -rf /", [])).toThrow(/metacharacters/);
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
