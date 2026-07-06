"use client";

import { useEffect, useState } from "react";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import { Select } from "@/components/Select";
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
} from "lucide-react";

export default function ToolsPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentTool, setCurrentTool] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", description: "", on_status: "Online", port: "", args: "", method: "sse" });

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
  const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "";
  const headers = { "x-robot-key": robotKey };

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/tools`, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setTools(await res.json() || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTools(); }, []);

  const parseVersions = (tool: any) => {
    try {
      const versions = typeof tool.versions === "string" ? JSON.parse(tool.versions) : tool.versions;
      if (versions?.length > 0) {
        const latest = versions[versions.length - 1];
        return { port: latest.released?.port || "—", args: latest.released?.args || "", method: latest.released?.method || "sse" };
      }
    } catch { }
    return { port: "—", args: "", method: "sse" };
  };

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentTool(null);
    setFormData({ name: "", description: "", on_status: "Online", port: "", args: "", method: "sse" });
    setIsModalOpen(true);
  };

  const openEditModal = (tool: any) => {
    setModalMode("edit");
    setCurrentTool(tool);
    const { port, args, method } = parseVersions(tool);
    setFormData({ name: tool.name || "", description: tool.description || "", on_status: tool.on_status || "Online", port, args, method });
    setIsModalOpen(true);
  };

  const deleteTool = async (toolId: string) => {
    if (!confirm("Delete this MCP server?")) return;
    try {
      const res = await fetch(`${apiUrl}/tools/${toolId}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed");
      fetchTools();
    } catch (err: any) { alert(err.message); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        on_status: formData.on_status,
        versions: [{ version: "1.0.0", released: { method: formData.method, port: formData.port, args: formData.args, env: {} } }],
      };
      const url = modalMode === "create" ? `${apiUrl}/tools` : `${apiUrl}/tools/${currentTool.tool_id}`;
      const res = await fetch(url, {
        method: modalMode === "create" ? "POST" : "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
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

  const getJsonSnippet = (tool: any, port: string, args: string, method: string) => {
    const serverName = tool.name?.toLowerCase().replace(/\s+/g, "-") || "mcp-server";
    if (method === "sse") {
      return JSON.stringify({
        mcpServers: {
          [serverName]: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/client-sse", `http://localhost:${port}/sse`]
          }
        }
      }, null, 2);
    } else {
      const parts = args.split(" ");
      const cmd = parts[0] || "node";
      const cmdArgs = parts.slice(1);
      return JSON.stringify({
        mcpServers: {
          [serverName]: {
            command: cmd,
            args: cmdArgs
          }
        }
      }, null, 2);
    }
  };

  const filteredTools = tools.filter(t => {
    const { method } = parseVersions(t);
    const matchesSearch = t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMethod = methodFilter === "all" || method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
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

      {/* Quick Presets Grid */}
      <div className="mb-8">
        <h2 className="ui-label text-slate-400 mb-3 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> Quick-install presets</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { 
              label: "UiPath MCP Integration", 
              desc: "Trigger RPA settlement robot queues", 
              color: "border-orange-200 hover:border-orange-300 bg-orange-50/20 text-orange-700", 
              logo: (
                <svg className="w-5 h-5 mb-2" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 13V24C5 26.2091 6.79086 28 9 28H19V19H12C10.3431 19 9 17.6569 9 16V13H5Z" fill="#FA4616" />
                  <rect x="19" y="4" width="8" height="8" rx="2" fill="#FA4616" />
                  <path d="M19 14H27V28H19V14Z" fill="#141414" />
                </svg>
              ),
              preset: { name: "mcp-uipath", description: "UiPath MCP — RPA trigger and monitoring", on_status: "Online", port: "10001", args: "node /path/to/mcp-uipath/build/index.js", method: "sse" } 
            },
            { 
              label: "Amadeus MCP Core", 
              desc: "Verify LC steps & append transitions", 
              color: "border-indigo-200 hover:border-indigo-300 bg-indigo-50/20 text-indigo-700", 
              logo: <img src="/amadeus.svg" alt="Amadeus" className="w-5 h-5 mb-2" />,
              preset: { name: "amadeus-mcp", description: "Amadeus Orchestrator MCP — transaction tracker & step dispatcher", on_status: "Online", port: "10002", args: "node /path/to/amadeus-mcp/build/index.js", method: "sse" } 
            },
            { 
              label: "Power Automate MCP", 
              desc: "Trigger desktop automation flows", 
              color: "border-blue-200 hover:border-blue-300 bg-blue-50/20 text-blue-700", 
              logo: (
                <svg className="w-5 h-5 mb-2" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 2L2 11L11 20L20 11L11 2Z" fill="#0078D4" />
                  <path d="M21 12L12 21L21 30L30 21L21 12Z" fill="#005A9E" />
                </svg>
              ),
              preset: { name: "mcp-pad", description: "Power Automate Desktop MCP — Windows automation triggers", on_status: "Online", port: "10003", args: "node /path/to/mcp-pad/build/index.js", method: "sse" } 
            },
          ].map(({ label, desc, color, logo, preset }) => (
            <button
              key={label}
              onClick={() => { setModalMode("create"); setCurrentTool(null); setFormData(preset); setIsModalOpen(true); }}
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
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${methodFilter === tab.id
                  ? "bg-slate-900 border-slate-950 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
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
          <p className="mt-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Loading Smithery Registry…</p>
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
            const { port, args, method } = parseVersions(tool);
            const jsonSnippet = getJsonSnippet(tool, port, args, method);

            return (
              <div
                key={tool.tool_id}
                className="bg-white border border-slate-200 rounded-2xl p-6 card-hover group relative flex flex-col hover:border-slate-300 hover:shadow-xl hover:shadow-slate-500/5 transition-all duration-300"
              >
                {/* Actions */}
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button onClick={() => openEditModal(tool)} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 rounded-lg shadow-sm transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTool(tool.tool_id)} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg shadow-sm transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Header */}
                <div className="flex items-start gap-4 mb-4 pr-16">
                  <div className={`w-12 h-12 rounded-2xl ${isActive ? "bg-orange-50 border border-orange-100 text-orange-600" : "bg-slate-50 border border-slate-100 text-slate-400"} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-snug">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge text-[9px] px-2 py-0.5 rounded-full ${isActive ? "badge-green" : "badge-slate"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${isActive ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
                        {isActive ? "Active" : "Offline"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Transport: <span className="uppercase font-bold text-slate-600">{method}</span></span>
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
                  {args && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center ui-label text-slate-400">
                        <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> Command Line Args</span>
                        <button
                          onClick={() => copyToClipboard(args, `${tool.tool_id}-args`)}
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
                      <code className="block text-[10px] font-mono bg-slate-900 border border-slate-950 rounded-xl p-3 text-slate-100 overflow-x-auto whitespace-nowrap shadow-inner">
                        {args}
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

                  {/* Port / Connection parameters */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
                    <div className="flex justify-between border-r border-slate-100 pr-2">
                      <span className="text-slate-400">Port / Host</span>
                      <span className="text-slate-700 font-semibold">{port}</span>
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
              <div>
                <label className="form-label">Port / Connection URL</label>
                <input value={formData.port} onChange={e => setFormData({ ...formData, port: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. 10002" />
              </div>
              <div>
                <label className="form-label">Command Args (STDIO)</label>
                <input value={formData.args} onChange={e => setFormData({ ...formData, args: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. node build/index.js" />
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
    </div>
  );
}
