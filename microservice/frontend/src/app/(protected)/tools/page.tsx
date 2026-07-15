"use client";

import { useEffect, useState } from "react";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import { Select } from "@/components/Select";
import { McpManagerBanner } from "@/components/McpManagerBanner";
import {
  RefreshCw,
  Plus,
  Terminal,
  CheckCircle,
  XCircle,
  Trash2,
  Edit2,
  X,
  ChevronRight,
  Server,
  Copy,
  Check,
  Zap,
  Link as LinkIcon,
  Loader2,
  Star,
  Files,
  GitBranch,
  Mail,
  Globe,
  Cpu,
} from "lucide-react";

export default function ToolsPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentTool, setCurrentTool] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toolToDelete, setToolToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    on_status: "Online",
    method: "stdio",
    command: "node",
    argsText: "", // one CLI arg per line, joined into args[] on save
    envText: "", // one KEY=value per line, joined into env{} on save
  });
  const [pasteCommand, setPasteCommand] = useState("");

  // Live process state per tool_id, sourced from mcp_runtime_state via
  // GET /orchestrator/mcp/status — the ONLY place a currently-live SSE port
  // is recorded. Ports are assigned dynamically at process-start, so there is
  // no static value to show until the tool has actually been started.
  const [mcpStatus, setMcpStatus] = useState<Record<string, { port: number | null; status: string }>>({});

  const [starredTools, setStarredTools] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("amadeus_starred_tools");
      if (stored) setStarredTools(JSON.parse(stored));
    } catch (e) {}
  }, []);
  
  const toggleStar = (toolId: string) => {
    setStarredTools(prev => {
      const next = prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId];
      localStorage.setItem("amadeus_starred_tools", JSON.stringify(next));
      return next;
    });
  };

  const handleDuplicate = (tool: any) => {
    const { command, args, method, env } = parseVersions(tool);
    setFormData({
      name: `${tool.name} (Copy)`,
      description: tool.description || "",
      on_status: tool.on_status || "Online",
      method: method,
      command: command,
      argsText: args.join("\n"),
      envText: Object.entries(env || {}).map(([k, v]) => `${k}=${v}`).join("\n"),
    });
    setModalMode("create");
    setIsModalOpen(true);
  };

  const getDynamicIcon = (name: string, isActive: boolean) => {
    const n = name.toLowerCase();
    const className = `w-6 h-6 ${isActive ? "text-orange-600" : "text-slate-400"}`;
    if (n.includes("uipath")) return <img src="/uipath.svg" alt="UiPath" className={className} />;
    if (n.includes("github")) return <GitBranch className={className} />;
    if (n.includes("pad") || n.includes("power automate")) return <Zap className={className} />;
    if (n.includes("gmail") || n.includes("mail")) return <Mail className={className} />;
    if (n.includes("google") || n.includes("drive")) return <Globe className={className} />;
    return <Server className={className} />;
  };

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authProvider, setAuthProvider] = useState<"uipath" | "pad" | "amadeus" | "">("");
  const [authFormData, setAuthFormData] = useState({ connectionName: "", clientId: "", clientSecret: "", org: "", tenant: "", folderId: "", transportMethod: "stdio" as "stdio" | "sse" });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authConnectError, setAuthConnectError] = useState<string | null>(null);
  const [folderOptions, setFolderOptions] = useState<{ id: string; fullyQualifiedName: string }[]>([]);
  const [isTestingFolders, setIsTestingFolders] = useState(false);
  const [folderTestError, setFolderTestError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools");
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setTools(await res.json() || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMcpStatus = async () => {
    try {
      const res = await fetch("/api/orchestrator/mcp/status");
      if (!res.ok) return;
      const rows: Array<{ toolId: string; port: number | null; status: string }> = await res.json();
      const next: Record<string, { port: number | null; status: string }> = {};
      for (const row of rows) next[row.toolId] = { port: row.port, status: row.status };
      setMcpStatus(next);
    } catch {
      // Best-effort — the tools list itself still works if this polling fails.
    }
  };

  useEffect(() => {
    fetchTools();
    fetchMcpStatus();
    const interval = setInterval(fetchMcpStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Structured release shape: { method, command, args: string[], env: {} }.
  // Legacy rows may still hold `args` as a single concatenated string —
  // surfaced read-only (joined for display) rather than parsed/guessed.
  const parseVersions = (tool: any) => {
    try {
      const versions = typeof tool.versions === "string" ? JSON.parse(tool.versions) : tool.versions;
      if (versions?.length > 0) {
        const released = versions[versions.length - 1]?.released || {};
        const args: string[] = Array.isArray(released.args) ? released.args : (released.args ? [String(released.args)] : []);
        const env: Record<string, string> = released.env && typeof released.env === "object" ? released.env : {};
        return {
          port: released.port ?? "—",
          command: released.command || "node",
          args,
          env,
          method: released.method || "sse",
          isLegacyStringArgs: typeof released.args === "string",
        };
      }
    } catch { }
    return { port: "—", command: "node", args: [] as string[], env: {} as Record<string, string>, method: "sse", isLegacyStringArgs: false };
  };

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentTool(null);
    setFormData({ name: "", description: "", on_status: "Online", method: "stdio", command: "node", argsText: "", envText: "" });
    setPasteCommand("");
    setIsModalOpen(true);
  };

  const openEditModal = (tool: any) => {
    setModalMode("edit");
    setCurrentTool(tool);
    const { command, args, env, method } = parseVersions(tool);
    setFormData({
      name: tool.name || "",
      description: tool.description || "",
      on_status: tool.on_status || "Online",
      method,
      command,
      argsText: args.join("\n"),
      envText: Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n"),
    });
    setPasteCommand("");
    setIsModalOpen(true);
  };

  // Convenience: paste a full legacy command line (e.g. copied from an old
  // tool's display, or from a UiPath setup doc) and split it into the
  // structured command + args[] fields for review — never used at spawn time.
  const applyPastedCommand = () => {
    const tokens = splitCommandLine(pasteCommand.trim());
    if (tokens.length === 0) return;
    const [cmd, ...rest] = tokens;
    setFormData((prev) => ({ ...prev, command: cmd, argsText: rest.join("\n") }));
    setPasteCommand("");
  };

  const confirmDelete = (tool: any) => {
    setToolToDelete(tool);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!toolToDelete) return;
    try {
      const res = await fetch(`/api/tools/${toolToDelete.tool_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      fetchTools();
    } catch (err: any) { alert(err.message); }
    finally {
      setDeleteModalOpen(false);
      setToolToDelete(null);
    }
  };

  const [restartingId, setRestartingId] = useState<string | null>(null);

  // Manual escape hatch for cases the mtime auto-restart can't catch (e.g. env
  // var / DB config changes with no entry-file change) — kills the tracked
  // process and clears its runtime row; the daemon respawns it on its next
  // sync tick (≤10s), same as any other lifecycle transition.
  const restartTool = async (toolId: string) => {
    setRestartingId(toolId);
    try {
      const res = await fetch(`/api/orchestrator/mcp/${toolId}/restart`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restart");
      setTimeout(fetchMcpStatus, 2500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRestartingId(null);
    }
  };

  // Parse the textarea inputs into the structured args[] / env{} the API expects.
  const parseArgsText = (text: string): string[] =>
    text.split("\n").map((s) => s.trim()).filter(Boolean);

  // Quote-aware split, used ONLY as a one-time convenience to help users
  // migrate an old single-line command (e.g. copied from a legacy tool) into
  // the structured command/args[] fields below for review before saving.
  // This never runs at spawn time — the actual runtime path only ever reads
  // the structured array, so a parsing edge case here just means the user
  // has to tidy up a field, not a broken child process spawn.
  const splitCommandLine = (input: string): string[] => {
    const tokens: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'" && !inDoubleQuote) { inSingleQuote = !inSingleQuote; continue; }
      if (ch === '"' && !inSingleQuote) { inDoubleQuote = !inDoubleQuote; current += ch; continue; }
      if (ch === " " && !inSingleQuote && !inDoubleQuote) {
        if (current) { tokens.push(current); current = ""; }
        continue;
      }
      current += ch;
    }
    if (current) tokens.push(current);
    return tokens;
  };

  const parseEnvText = (text: string): Record<string, string> => {
    const env: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) env[key] = value;
    }
    return env;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const args = parseArgsText(formData.argsText);
      const env = parseEnvText(formData.envText);

      // Guard against the exact mistake that broke UiPath Iqbal: a whole
      // command pasted onto a single line instead of split into separate
      // args. A line with spaces that isn't a JSON blob is suspicious.
      const suspicious = args.filter((a) => a.includes(" ") && !a.trim().startsWith("{"));
      if (suspicious.length > 0) {
        const proceed = confirm(
          `This looks like a full command line on one Args row instead of separate lines:\n\n"${suspicious[0].slice(0, 80)}${suspicious[0].length > 80 ? "…" : ""}"\n\nEach argument should be its own line. Use "Split into fields" above, or continue anyway if this is intentional.`
        );
        if (!proceed) return;
      }

      // No `port` here — SSE ports are assigned dynamically at process-start
      // by the orchestrator's port allocator and tracked in mcp_runtime_state,
      // never submitted by the UI (see portprompt.md).
      const released: any = { method: formData.method, command: formData.command || "node", args, env };
      const payload = {
        name: formData.name,
        description: formData.description,
        on_status: formData.on_status,
        versions: [{ version: "1.0.0", released }],
      };
      const url = modalMode === "create" ? "/api/tools" : `/api/tools/${currentTool.tool_id}`;
      const res = await fetch(url, {
        method: modalMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      setIsModalOpen(false);
      fetchTools();
    } catch (err: any) { alert(err.message); }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getJsonSnippet = (tool: any, command: string, args: string[], method: string) => {
    const serverName = tool.name?.toLowerCase().replace(/\s+/g, "-") || "mcp-server";
    if (method === "sse") {
      const live = mcpStatus[tool.tool_id];
      const url = live?.status === "running" && live.port
        ? `http://localhost:${live.port}/sse`
        : "http://localhost:<port will be assigned at runtime — check the status panel after starting>/sse";
      return JSON.stringify({
        mcpServers: {
          [serverName]: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/client-sse", url]
          }
        }
      }, null, 2);
    } else {
      return JSON.stringify({
        mcpServers: {
          [serverName]: {
            command: command || "node",
            args
          }
        }
      }, null, 2);
    }
  };

  const openAuthModal = (provider: "uipath" | "pad" | "amadeus") => {
    setAuthProvider(provider);
    setAuthFormData({ connectionName: "", clientId: "", clientSecret: "", org: "", tenant: "", folderId: "", transportMethod: "stdio" });
    setFolderOptions([]);
    setFolderTestError(null);
    setAuthConnectError(null);
    setIsAuthModalOpen(true);
  };

  // Turns "paste the link from Orchestrator" into "pick your folder from a
  // dropdown once, at registration time" — does a live OAuth test connection
  // with the credentials already typed in, then lists real folder names.
  const testListFolders = async () => {
    setIsTestingFolders(true);
    setFolderTestError(null);
    setFolderOptions([]);
    try {
      const res = await fetch("/api/orchestrator/uipath/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: authFormData.clientId.trim(),
          clientSecret: authFormData.clientSecret.trim(),
          org: authFormData.org.trim(),
          tenant: authFormData.tenant.trim(),
          baseUrl: "https://cloud.uipath.com",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Failed to list folders");
      setFolderOptions(data.folders || []);
    } catch (err: any) {
      setFolderTestError(err.message);
    } finally {
      setIsTestingFolders(false);
    }
  };

  const handleUiPathUrlParse = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes("uipath.com")) {
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        if (pathSegments.length >= 2) {
          const org = pathSegments[0];
          const tenant = pathSegments[1];
          const fid = parsedUrl.searchParams.get("fid") || "";
          
          setAuthFormData(prev => ({
            ...prev,
            org: org || prev.org,
            tenant: tenant || prev.tenant,
            folderId: fid || prev.folderId
          }));
        }
      }
    } catch (e) {
      // ignore invalid URLs silently while typing
    }
  };

  const handleAuthConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthConnectError(null);
    try {
      let payload: any = {};
      const toolName = authFormData.connectionName.trim() || (authProvider === "uipath" ? "UiPath MCP" : authProvider === "amadeus" ? "Amadeus MCP" : "mcp-pad");

      if (authProvider === "uipath") {
        // STDIO: spawned on-demand per agent invoke by engine.ts (StdioClientTransport).
        //        McpAutoManager skips STDIO tools — no persistent process, no port.
        // SSE:   spawned as a persistent HTTP server by McpAutoManager.
        //        Appears in /orchestrator/mcp/status with a live port.
        const isStdio = authFormData.transportMethod === "stdio";
        const mcpArgs = isStdio
          ? ["/home/firania/Downloads/ponzgen/microservice/mcp/mcp-uipath/build/index.js", "--stdio"]
          : ["/home/firania/Downloads/ponzgen/microservice/mcp/mcp-uipath/build/index.js"]; // no --stdio = SSE/HTTP mode
        payload = {
          name: toolName,
          description: `UiPath MCP [${isStdio ? "STDIO" : "SSE"}] — Org: ${authFormData.org} / Tenant: ${authFormData.tenant} / Folder: ${authFormData.folderId}`,
          on_status: "Online",
          versions: [{
            version: "1.0.0",
            released: {
              method: authFormData.transportMethod,
              command: "node",
              args: mcpArgs,
              env: {
                UIPATH_BASE_URL: "https://cloud.uipath.com",
                UIPATH_ORG: authFormData.org.trim(),
                UIPATH_TENANT: authFormData.tenant.trim(),
                UIPATH_CLIENT_ID: authFormData.clientId.trim(),
                UIPATH_CLIENT_SECRET: authFormData.clientSecret.trim(),
                UIPATH_FOLDER_ID: authFormData.folderId.trim(),
                UIPATH_SCOPES: "OR.Jobs OR.Robots.Read OR.Execution OR.Folders.Read OR.Queues OR.Monitoring",
              }
            }
          }]
        };
      } else if (authProvider === "pad") {
        payload = {
          name: toolName,
          description: "Power Automate Desktop MCP — Windows automation triggers",
          on_status: "Online",
          versions: [{
            version: "1.0.0",
            released: { method: "sse", command: "node", args: ["/path/to/mcp-pad/build/index.js"], env: {} }
          }]
        };
      } else if (authProvider === "amadeus") {
        payload = {
          name: toolName,
          description: "Amadeus Orchestrator MCP — transaction tracker & step dispatcher",
          on_status: "Online",
          versions: [{
            version: "1.0.0",
            released: {
              method: "sse",
              command: "npx",
              args: ["-y", "amadeus-orchestrator-mcp@latest"],
              env: {
                AMADEUS_API_BASE: "",
                AMADEUS_ROBOT_KEY: "",
                AMADEUS_SIGNATURE_PEPPER: ""
              }
            }
          }]
        };
      }

      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = `Server error ${res.status}`;
        try {
          const errBody = await res.json();
          errMsg = errBody?.message || errBody?.error || errMsg;
        } catch {
          errMsg = await res.text().then(t => t.slice(0, 200)) || errMsg;
        }
        throw new Error(errMsg);
      }

      setIsAuthModalOpen(false);
      fetchTools();
    } catch (err: any) {
      setAuthConnectError(err.message || "Failed to connect integration");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const filteredTools = [...tools]
    .filter(t => {
      const { method } = parseVersions(t);
      const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod = methodFilter === "all" || method === methodFilter;
      return matchesSearch && matchesMethod;
    })
    .sort((a, b) => {
      const aStarred = starredTools.includes(a.tool_id);
      const bStarred = starredTools.includes(b.tool_id);
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <McpManagerBanner />

      {/* Page Header */}
      <div className="page-header border-b border-slate-100 pb-6 mb-6">
        <div>
          <p className="ui-label text-slate-400 mb-2">MCP Infrastructure</p>
          <h1 className="section-head text-3xl text-slate-900 mb-1">Tools Registry</h1>
          <p className="text-sm text-slate-500">
            {tools.length} MCP server{tools.length !== 1 ? "s" : ""} registered ·{" "}
            {tools.filter(t => !t.on_status?.toLowerCase().includes("offline")).length} active &amp; running
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTools} className="btn-secondary text-xs py-2.5 px-4 rounded-xl shadow-sm bg-white hover:bg-slate-50 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreateModal} className="btn-primary text-xs py-2.5 px-4 rounded-xl shadow-md bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Register MCP
          </button>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="mb-8">
        <h2 className="ui-label text-slate-400 mb-3 flex items-center gap-1.5"><LinkIcon className="w-3.5 h-3.5 text-blue-500" /> Connect Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { 
              label: "Login with UiPath", 
              desc: "Trigger RPA settlement robot queues", 
              color: "border-orange-200 hover:border-orange-300 bg-orange-50/20 text-orange-700", 
              logo: (
                <svg className="w-5 h-5 mb-2" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13V24C5 26.2091 6.79086 28 9 28H19V19H12C10.3431 19 9 17.6569 9 16V13H5Z" fill="#FA4616" />
                  <rect x="19" y="4" width="8" height="8" rx="2" fill="#FA4616" />
                  <path d="M19 14H27V28H19V14Z" fill="#141414" />
                </svg>
              ),
              provider: "uipath" as const
            },
            { 
              label: "Connect Amadeus Core", 
              desc: "Verify LC steps & append transitions", 
              color: "border-indigo-200 hover:border-indigo-300 bg-indigo-50/20 text-indigo-700", 
              logo: <img src="/amadeus.svg" alt="Amadeus" className="w-5 h-5 mb-2" />,
              provider: "amadeus" as const
            },
            { 
              label: "Login with Power Automate", 
              desc: "Trigger desktop automation flows", 
              color: "border-blue-200 hover:border-blue-300 bg-blue-50/20 text-blue-700", 
              logo: (
                <svg className="w-5 h-5 mb-2" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 2L2 11L11 20L20 11L11 2Z" fill="#0078D4" />
                  <path d="M21 12L12 21L21 30L30 21L21 12Z" fill="#005A9E" />
                </svg>
              ),
              provider: "pad" as const
            },
          ].map(({ label, desc, color, logo, provider }) => (
            <button
              key={label}
              onClick={() => openAuthModal(provider)}
              className={`border p-4 rounded-2xl text-left hover:shadow-md transition-all duration-200 ${color}`}
            >
              {logo}
              <div className="font-bold text-xs">{label}</div>
              <div className="text-[10px] opacity-80 mt-1">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar: Search and Filters */}
      {!loading && !error && tools.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search MCP servers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500"
            />
            <Server className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="ui-label text-slate-400 mr-2 flex-shrink-0">Transport</span>
            {[
              { id: "all", label: "All Methods" },
              { id: "sse", label: "SSE (HTTP)" },
              { id: "stdio", label: "STDIO" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMethodFilter(tab.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${methodFilter === tab.id ? "bg-slate-900 border-slate-950 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50" }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <RainbowRibbonLoader />
          <p className="mt-4 text-xs font-mono text-slate-400">Loading Smithery Registry…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold mb-1">Connection Error</p>
          <p className="text-red-500 text-xs font-mono">{error}</p>
        </div>
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Server className="w-10 h-10 mb-3 opacity-30 animate-pulse" />
          <p className="text-sm font-medium">No MCP servers registered yet.</p>
          <button onClick={openCreateModal} className="mt-4 btn-primary text-xs py-2 px-4">
            <Plus className="w-3.5 h-3.5" /> Register First Server
          </button>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white border border-slate-100 rounded-2xl">
          <Server className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm font-medium">No servers match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTools.map((tool) => {
            const isActive = !tool.on_status?.toLowerCase().includes("offline");
            const { command, args, method, isLegacyStringArgs } = parseVersions(tool);
            const argsDisplay = isLegacyStringArgs ? args.join(" ") : `${command} ${args.join(" ")}`.trim();
            const jsonSnippet = getJsonSnippet(tool, command, args, method);
            const liveStatus = mcpStatus[tool.tool_id];

            return (
              <div
                key={tool.tool_id}
                className="bg-white border border-slate-200 rounded-2xl p-6 card-hover group relative flex flex-col hover:border-slate-300 hover:shadow-xl hover:shadow-slate-500/5 transition-all duration-300"
              >
                {/* Actions */}
                <div className="absolute top-4 right-4 flex gap-1 transition-opacity z-10 opacity-100">
                  <button onClick={() => toggleStar(tool.tool_id)} title="Favorite" className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50 rounded-lg shadow-sm transition-all">
                    <Star className={`w-3.5 h-3.5 ${starredTools.includes(tool.tool_id) ? "fill-amber-400 text-amber-500" : ""}`} />
                  </button>
                  {isActive && (
                    <button
                      onClick={() => restartTool(tool.tool_id)}
                      disabled={restartingId === tool.tool_id}
                      title="Restart"
                      className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg shadow-sm transition-all disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${restartingId === tool.tool_id ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  <button onClick={() => handleDuplicate(tool)} title="Duplicate" className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 rounded-lg shadow-sm transition-all">
                    <Files className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEditModal(tool)} title="Edit" className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 rounded-lg shadow-sm transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => confirmDelete(tool)} title="Delete" className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg shadow-sm transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Header */}
                <div className="flex items-start gap-4 mb-4 pr-16">
                  <div className={`w-12 h-12 rounded-2xl ${isActive ? "bg-orange-50 border border-orange-100 text-orange-600" : "bg-slate-50 border border-slate-100 text-slate-400"} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    {getDynamicIcon(tool.name, isActive)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-snug">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-[9px] px-2 py-0.5 rounded-full ${isActive ? "badge-green" : "badge-slate"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${isActive ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
                        {isActive ? "Active" : "Offline"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Transport: <span className="font-bold text-slate-600">{method}</span></span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 mb-4 leading-relaxed line-clamp-2">
                  {tool.description || "No description provided."}
                </p>

                {/* Copyable Console blocks */}
                <div className="space-y-3 mt-auto">

                  {/* CLI Command */}
                  {argsDisplay && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center ui-label text-slate-400">
                        <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> Command Line Args</span>
                        <button
                          onClick={() => copyToClipboard(argsDisplay, `${tool.tool_id}-args`)}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {copiedId === `${tool.tool_id}-args` ? (
                            <>
                              <Check className="w-3 h-3 text-green-500" />
                              <span className="text-green-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      {isLegacyStringArgs && (
                        <p className="text-[10px] text-amber-600 font-mono">Legacy format — re-save this tool to migrate to structured args.</p>
                      )}
                      <code className="block text-[10px] font-mono bg-slate-900 border border-slate-950 rounded-xl p-3 text-slate-100 overflow-x-auto whitespace-nowrap shadow-inner">
                        {argsDisplay}
                      </code>
                    </div>
                  )}

                  {/* JSON Config Box */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center ui-label text-slate-400">
                      <span>Claude Desktop Configuration</span>
                      <button
                        onClick={() => copyToClipboard(jsonSnippet, `${tool.tool_id}-json`)}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {copiedId === `${tool.tool_id}-json` ? (
                          <>
                            <Check className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono bg-slate-900 border border-slate-950 rounded-xl p-3 text-slate-200 overflow-x-auto max-h-36 scrollbar-thin shadow-inner">
                      {jsonSnippet}
                    </pre>
                  </div>

                  {/* Live port / Connection parameters */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
                    <div className="flex justify-between border-r border-slate-100 pr-2">
                      <span className="text-slate-400">Live Port</span>
                      {method === "sse" ? (
                        liveStatus?.status === "running" && liveStatus.port ? (
                          <span className="text-green-700 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> :{liveStatus.port}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> stopped
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 font-semibold">n/a (stdio)</span>
                      )}
                    </div>
                    <div className="flex justify-between pl-2">
                      <span className="text-slate-400">Node ID</span>
                      <span className="text-slate-700 font-semibold">{tool.tool_id?.substring(0, 8)}</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="font-extrabold text-slate-900 text-lg">
                {modalMode === "create" ? "Register MCP Server" : "Edit MCP Server"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="form-label">Server Name</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. amadeus-mcp" />
              </div>
              <div>
                <label className="form-label">Description / Capabilities</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="form-input rounded-xl border-slate-200 h-20 resize-none" placeholder="What tools and operations does this server expose..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Status</label>
                  <Select
                    value={formData.on_status}
                    onChange={(v) => setFormData({ ...formData, on_status: v })}
                    options={[
                      { value: "Online", label: "Online" },
                      { value: "Offline", label: "Offline" },
                    ]}
                    triggerClassName="rounded-xl"
                  />
                </div>
                <div>
                  <label className="form-label">Transport Protocol</label>
                  <Select
                    value={formData.method}
                    onChange={(v) => setFormData({ ...formData, method: v })}
                    options={[
                      { value: "sse", label: "SSE (HTTP)" },
                      { value: "stdio", label: "STDIO" },
                    ]}
                    triggerClassName="rounded-xl"
                  />
                </div>
              </div>
              {formData.method === "sse" && (
                <div>
                  <label className="form-label">Live Port</label>
                  <div className="form-input rounded-xl border-slate-200 bg-slate-50 text-slate-400 flex items-center gap-2 cursor-not-allowed">
                    {(() => {
                      const live = currentTool ? mcpStatus[currentTool.tool_id] : undefined;
                      if (live?.status === "running" && live.port) {
                        return <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> running on :{live.port}</>;
                      }
                      return <><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> not started yet — assigned automatically when the server starts</>;
                    })()}
                  </div>
                </div>
              )}
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 space-y-2">
                <label className="form-label">Have a full command line instead? <span className="normal-case font-normal text-slate-400">(e.g. copied from docs or an old tool)</span></label>
                <div className="flex gap-2">
                  <input
                    value={pasteCommand}
                    onChange={e => setPasteCommand(e.target.value)}
                    className="form-input rounded-lg border-slate-200 font-mono text-xs flex-1"
                    placeholder={`node /path/to/index.js '{"key":"value"}' --stdio`}
                  />
                  <button
                    type="button"
                    onClick={applyPastedCommand}
                    disabled={!pasteCommand.trim()}
                    className="btn-secondary text-xs px-3 rounded-lg disabled:opacity-40"
                  >
                    Split into fields
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Paste here, click Split, then review the Command/Args below before saving — this never runs automatically, it just fills in the fields.</p>
              </div>
              <div>
                <label className="form-label">Command (executable)</label>
                <input value={formData.command} onChange={e => setFormData({ ...formData, command: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. node" />
              </div>
              <div>
                <label className="form-label">Args <span className="normal-case font-normal text-slate-400">(one per line — each is passed as a separate argv entry, no shell parsing)</span></label>
                <textarea
                  value={formData.argsText}
                  onChange={e => setFormData({ ...formData, argsText: e.target.value })}
                  className="form-input rounded-xl border-slate-200 h-24 resize-none font-mono text-xs"
                  placeholder={"/absolute/path/to/build/index.js\n--stdio"}
                />
              </div>
              <div>
                <label className="form-label">Env <span className="normal-case font-normal text-slate-400">(one KEY=value per line)</span></label>
                {/* UiPath credential sub-form */}
                {(formData.argsText.includes('uipath-mcp') || formData.argsText.includes('uipath')) && (
                  <div className="space-y-2 border rounded-xl p-4 bg-amber-50/50 mb-3">
                    <h4 className="text-sm font-semibold text-amber-800">🔒 UiPath Credentials</h4>
                    <p className="text-[10px] text-amber-600">
                      Stored securely in the database. Injected as environment variables at runtime — 
                      never embedded in CLI arguments or visible in process listings.
                    </p>
                    {[
                      { key: 'UIPATH_ORG', label: 'Organization slug', placeholder: 'e.g. anakindia' },
                      { key: 'UIPATH_TENANT', label: 'Tenant slug', placeholder: 'e.g. DefaultTenant' },
                      { key: 'UIPATH_CLIENT_ID', label: 'Client ID', placeholder: 'from External App registration' },
                      { key: 'UIPATH_CLIENT_SECRET', label: 'Client Secret', placeholder: 'from External App registration', isSecret: true },
                      { key: 'UIPATH_FOLDER_ID', label: 'Folder ID', placeholder: 'numeric, from URL ?fid=XXXXX' },
                      { key: 'UIPATH_SCOPES', label: 'Scopes', placeholder: 'OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring' },
                    ].map(field => {
                      // Parse current envText to get existing value for this key
                      const envObj = parseEnvText(formData.envText);
                      return (
                        <input
                          key={field.key}
                          type={field.isSecret ? 'password' : 'text'}
                          placeholder={`${field.label} (${field.placeholder})`}
                          value={envObj[field.key] ?? ''}
                          onChange={e => {
                            const newEnv = { ...envObj, [field.key]: e.target.value };
                            const newText = Object.entries(newEnv).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join('\n');
                            setFormData({ ...formData, envText: newText });
                          }}
                          className="form-input w-full rounded-lg border-amber-200 text-xs"
                        />
                      );
                    })}
                  </div>
                )}
                <textarea
                  value={formData.envText}
                  onChange={e => setFormData({ ...formData, envText: e.target.value })}
                  className="form-input rounded-xl border-slate-200 h-16 resize-none font-mono text-xs"
                  placeholder={"UIPATH_ORG=anakindia\nUIPATH_TENANT=DefaultTenant\nUIPATH_CLIENT_ID=..."}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm rounded-xl">Cancel</button>
              <button onClick={handleSave} className="btn-primary text-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                {modalMode === "create" ? "Register Server" : "Save Changes"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                {authProvider === "uipath" && <span className="text-orange-600">Connect to UiPath</span>}
                {authProvider === "pad" && <span className="text-blue-600">Connect to Power Automate</span>}
                {authProvider === "amadeus" && <span className="text-indigo-600">Connect Amadeus Core</span>}
              </h2>
              <button type="button" onClick={() => setIsAuthModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAuthConnect} className="flex-1 flex flex-col">
              <div className="p-6 space-y-4">
                {/* Inline error banner — replaces browser alert() */}
                {authConnectError && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-red-700">Connection failed</p>
                      <p className="text-red-600 text-xs mt-0.5 font-mono break-all">{authConnectError}</p>
                    </div>
                  </div>
                )}
                {authProvider === "uipath" ? (
                  <>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-500">
                      Enter your UiPath External Application credentials. Credentials are stored as environment variables — never exposed in process listings.
                    </div>
                    <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 space-y-2">
                      <label className="form-label text-indigo-900 mb-0">Auto-Fill from URL <span className="normal-case font-normal text-indigo-600/70">(Optional)</span></label>
                      <p className="text-[10px] text-indigo-500 mb-2">Paste your Orchestrator folder URL to automatically extract Org, Tenant, and Folder ID.</p>
                      <input 
                        type="url"
                        onChange={(e) => handleUiPathUrlParse(e.target.value)}
                        className="form-input rounded-xl border-indigo-200 bg-white placeholder-indigo-300 focus:ring-indigo-500 focus:border-indigo-500 w-full" 
                        placeholder="https://cloud.uipath.com/org/tenant/orchestrator_/?fid=XXXXX" 
                      />
                    </div>
                    <div>
                      <label className="form-label">Transport Method</label>
                      <div className="flex gap-2">
                        {([
                          { value: "stdio", label: "STDIO", desc: "On-demand, stateless", icon: "⚡" },
                          { value: "sse",   label: "SSE",   desc: "Persistent HTTP server", icon: "📡" },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAuthFormData({ ...authFormData, transportMethod: opt.value })}
                            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${ authFormData.transportMethod === opt.value ? "bg-slate-900 border-slate-900 text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700" }`}
                          >
                            <span className="text-base">{opt.icon}</span>
                            <span>{opt.label}</span>
                            <span className={`font-normal text-[10px] ${authFormData.transportMethod === opt.value ? "text-slate-300" : "text-slate-400"}`}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                      {authFormData.transportMethod === "stdio" ? (
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          <span className="font-semibold text-slate-600">STDIO</span> — Spawned on-demand saat agent dipanggil. Tidak butuh port. Cocok untuk UiPath, stateless tools.
                        </p>
                      ) : (
                        <p className="text-[10px] text-orange-600 mt-1.5">
                          <span className="font-semibold">SSE</span> — Dijalankan sebagai HTTP server permanen oleh McpAutoManager. Akan muncul di status panel dengan live port. Cocok jika butuh warm-up cepat atau state persistent.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Connection Name <span className="normal-case font-normal text-slate-400">(how it appears in the registry)</span></label>
                      <input
                        value={authFormData.connectionName}
                        onChange={e => { setAuthFormData({ ...authFormData, connectionName: e.target.value }); setAuthConnectError(null); }}
                        className="form-input rounded-xl border-slate-200"
                        placeholder="e.g. UiPath Queue, UiPath RPA Prod"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Organization</label>
                        <input required value={authFormData.org} onChange={e => setAuthFormData({ ...authFormData, org: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. maestffaiddh" />
                      </div>
                      <div>
                        <label className="form-label">Tenant</label>
                        <input required value={authFormData.tenant} onChange={e => setAuthFormData({ ...authFormData, tenant: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. DefaultTenant" />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Client ID (App ID)</label>
                      <input required value={authFormData.clientId} onChange={e => { setAuthFormData({ ...authFormData, clientId: e.target.value }); setAuthConnectError(null); }} className="form-input rounded-xl border-slate-200" placeholder="e.g. 0b7fd08e-3614-4687-bacc-5f2446049e6b" />
                    </div>
                    <div>
                      <label className="form-label">Client Secret</label>
                      <input required type="password" value={authFormData.clientSecret} onChange={e => { setAuthFormData({ ...authFormData, clientSecret: e.target.value }); setAuthConnectError(null); }} className="form-input rounded-xl border-slate-200" placeholder="••••••••••••••••" />
                    </div>
                    <div>
                      <label className="form-label">Folder ID</label>
                      <div className="flex gap-2">
                        <input required value={authFormData.folderId} onChange={e => setAuthFormData({ ...authFormData, folderId: e.target.value })} className="form-input rounded-xl border-slate-200 flex-1" placeholder="e.g. 6500192" />
                        <button
                          type="button"
                          onClick={testListFolders}
                          disabled={isTestingFolders || !authFormData.clientId || !authFormData.clientSecret || !authFormData.org || !authFormData.tenant}
                          className="btn-secondary text-xs px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isTestingFolders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test & List Folders"}
                        </button>
                      </div>
                      {folderTestError && (
                        <p className="text-xs text-red-600 mt-1.5">{folderTestError}</p>
                      )}
                      {folderOptions.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                          {folderOptions.map((f) => (
                            <button
                              type="button"
                              key={f.id}
                              onClick={() => setAuthFormData({ ...authFormData, folderId: f.id })}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex justify-between items-center ${authFormData.folderId === f.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-600"}`}
                            >
                              <span className="truncate">{f.fullyQualifiedName}</span>
                              <span className="font-mono text-[10px] text-slate-400 ml-2 shrink-0">{f.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-500 text-center py-8">
                    Standard connection initialization.<br/>Click Connect to proceed.
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
                <button type="button" onClick={() => setIsAuthModalOpen(false)} className="btn-secondary text-sm rounded-xl">Cancel</button>
                <button type="submit" disabled={isAuthenticating} className="btn-primary text-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-70 disabled:cursor-wait">
                  {isAuthenticating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</>
                  ) : (
                    "Connect Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && toolToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Delete MCP Server?</h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                Are you sure you want to delete <span className="font-bold text-slate-700">{toolToDelete.name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setDeleteModalOpen(false); setToolToDelete(null); }} 
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete} 
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
