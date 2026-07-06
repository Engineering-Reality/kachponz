"use client";

import { useEffect, useState } from "react";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
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
} from "lucide-react";

export default function ToolsPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentTool, setCurrentTool] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", description: "", on_status: "Online", port: "", args: "", method: "sse" });

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
    } catch {}
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">MCP Tool Registry</h1>
          <p className="text-sm text-slate-500">
            {tools.length} server{tools.length !== 1 ? "s" : ""} registered ·{" "}
            {tools.filter(t => !t.on_status?.toLowerCase().includes("offline")).length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTools} className="btn-secondary text-xs py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreateModal} className="btn-primary text-xs py-2 px-3">
            <Plus className="w-3.5 h-3.5" /> Register MCP
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { label: "UiPath MCP", color: "badge-orange", preset: { name: "mcp-uipath", description: "UiPath MCP — RPA trigger and monitoring", on_status: "Online", port: "10001", args: "node /path/to/mcp-uipath/build/index.js", method: "sse" } },
          { label: "Amadeus MCP", color: "badge-blue", preset: { name: "amadeus-mcp", description: "Amadeus Orchestrator MCP — transaction tracker & step dispatcher", on_status: "Online", port: "10002", args: "node /path/to/amadeus-mcp/build/index.js", method: "sse" } },
          { label: "SendGrid MCP", color: "badge-green", preset: { name: "sendgrid-mcp", description: "SendGrid MCP — email sending and campaign automation", on_status: "Online", port: "10003", args: "node /path/to/sendgrid_mcp/build/index.js", method: "sse" } },
        ].map(({ label, color, preset }) => (
          <button
            key={label}
            onClick={() => { setModalMode("create"); setCurrentTool(null); setFormData(preset); setIsModalOpen(true); }}
            className={`badge ${color} cursor-pointer hover:opacity-80 transition-opacity`}
          >
            + {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <RainbowRibbonLoader />
          <p className="mt-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Loading registry…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold mb-1">Connection Error</p>
          <p className="text-red-500 text-xs font-mono">{error}</p>
        </div>
      ) : tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Server className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No MCP servers registered yet.</p>
          <button onClick={openCreateModal} className="mt-4 btn-primary text-xs py-2 px-4">
            <Plus className="w-3.5 h-3.5" /> Register First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const isActive = !tool.on_status?.toLowerCase().includes("offline");
            const { port, args, method } = parseVersions(tool);
            return (
              <div key={tool.tool_id} className="bg-white border border-slate-200 rounded-xl p-5 card-hover group relative flex flex-col">
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(tool)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTool(tool.tool_id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-start gap-3 mb-4 pr-14">
                  <div className={`w-9 h-9 ${isActive ? "bg-orange-50" : "bg-slate-50"} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Server className={`w-4.5 h-4.5 ${isActive ? "text-orange-500" : "text-slate-400"}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 leading-tight">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {isActive ? (
                        <span className="badge badge-green"><CheckCircle className="w-2.5 h-2.5" /> Online</span>
                      ) : (
                        <span className="badge badge-slate"><XCircle className="w-2.5 h-2.5" /> Offline</span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">{tool.tool_id?.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mb-4 leading-relaxed flex-1">
                  {tool.description || "No description."}
                </p>

                <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Transport</span>
                    <span className="text-slate-700 uppercase font-semibold">{method}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Port / URL</span>
                    <span className="text-slate-700">{port}</span>
                  </div>
                  {args && (
                    <div className="pt-1">
                      <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1"><Terminal className="w-3 h-3" /> Command</p>
                      <code className="block text-[10px] font-mono bg-slate-50 border border-slate-100 rounded-md p-2 text-slate-600 truncate">{args}</code>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {modalMode === "create" ? "Register MCP Server" : "Edit MCP Server"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="form-label">Server Name</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="form-input" placeholder="e.g. amadeus-mcp" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="form-input h-20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Status</label>
                  <select value={formData.on_status} onChange={e => setFormData({ ...formData, on_status: e.target.value })} className="form-input">
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Transport</label>
                  <select value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value })} className="form-input">
                    <option value="sse">SSE (HTTP)</option>
                    <option value="stdio">STDIO</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Port / URL</label>
                <input value={formData.port} onChange={e => setFormData({ ...formData, port: e.target.value })} className="form-input" placeholder="10001" />
              </div>
              <div>
                <label className="form-label">Command Args (STDIO)</label>
                <input value={formData.args} onChange={e => setFormData({ ...formData, args: e.target.value })} className="form-input" placeholder="node build/index.js" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} className="btn-primary text-sm">
                {modalMode === "create" ? "Register" : "Save Changes"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
