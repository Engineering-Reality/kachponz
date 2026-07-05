"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import { ArrowLeft, RefreshCw, Plus, Settings, Terminal, CheckCircle, XCircle, Trash2, Edit2, X } from "lucide-react";

export default function ToolsPage() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentTool, setCurrentTool] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    on_status: "Online",
    port: "",
    args: "",
    method: "sse"
  });
  
  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const res = await fetch(`${apiUrl}/tools`, {
        headers: {
          "x-robot-key": robotKey,
          "Content-Type": "application/json"
        }
      });
      
      if (!res.ok) throw new Error(`Error: ${res.status} ${res.statusText}`);
      
      const data = await res.json();
      setTools(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load tools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentTool(null);
    setFormData({ name: "", description: "", on_status: "Online", port: "", args: "", method: "sse" });
    setIsModalOpen(true);
  };

  const openEditModal = (tool: any) => {
    setModalMode("edit");
    setCurrentTool(tool);
    
    let port = "";
    let args = "";
    let method = "sse";
    try {
      const versions = typeof tool.versions === "string" ? JSON.parse(tool.versions) : tool.versions;
      if (versions && versions.length > 0) {
        const latest = versions[versions.length - 1];
        port = latest.released?.port || "";
        args = latest.released?.args || "";
        method = latest.released?.method || "sse";
      }
    } catch (e) {}

    setFormData({
      name: tool.name || "",
      description: tool.description || "",
      on_status: tool.on_status || "Online",
      port,
      args,
      method
    });
    setIsModalOpen(true);
  };

  const deleteTool = async (toolId: string) => {
    if (!confirm("Are you sure you want to delete this MCP Tool?")) return;
    
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const res = await fetch(`${apiUrl}/tools/${toolId}`, {
        method: "DELETE",
        headers: {
          "x-robot-key": robotKey
        }
      });
      
      if (!res.ok) throw new Error("Failed to delete tool");
      fetchTools();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      // Pack versions correctly
      const versions = [{
        version: "1.0.0",
        released: {
          method: formData.method,
          port: formData.port,
          args: formData.args,
          env: {}
        }
      }];

      const payload = {
        name: formData.name,
        description: formData.description,
        on_status: formData.on_status,
        versions: versions
      };

      const url = modalMode === "create" ? `${apiUrl}/tools` : `${apiUrl}/tools/${currentTool.tool_id}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "x-robot-key": robotKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to save tool");
      
      setIsModalOpen(false);
      fetchTools();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen p-8 lg:p-24 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[500px] opacity-20 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none z-0"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-12">
          <div>
            <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 uppercase tracking-wider text-sm font-mono transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Return to Core
            </Link>
            <h1 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter vibrant-rainbow-text">
              MCP Matrix (Tools)
            </h1>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 transition-all bg-white font-mono uppercase text-sm"
            >
              <Plus className="w-4 h-4" /> Register MCP
            </button>
            <button 
              onClick={fetchTools}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 transition-all bg-white font-mono uppercase text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Sync Matrix
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[600px] rounded-xl">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-mono uppercase tracking-widest text-sm font-bold text-slate-900">Tool Registry Ledger</h2>
            <div className="text-xs font-mono text-slate-500">{tools.length} Tools Available</div>
          </div>
          
          <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12">
              <RainbowRibbonLoader />
              <p className="text-center font-mono text-xs uppercase text-slate-500 mt-4 tracking-widest">Synchronizing state...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-slate-900 border border-red-200 bg-red-50 rounded-xl">
              <p className="font-mono text-red-600 font-bold">{error}</p>
              <p className="text-slate-500 mt-2 text-xs">Verify your backend is running and NEXT_PUBLIC_API_URL is correct.</p>
            </div>
          ) : tools.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono uppercase">
              No tools found in the registry.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => {
                const isActive = !tool.on_status?.toLowerCase().includes("offline") && !tool.on_status?.toLowerCase().includes("inactive");
                let port = "Unknown";
                let args = "";
                let method = "sse";
                try {
                  const versions = typeof tool.versions === "string" ? JSON.parse(tool.versions) : tool.versions;
                  if (versions && versions.length > 0) {
                    const latest = versions[versions.length - 1];
                    port = latest.released?.port || "Unknown";
                    args = latest.released?.args || "";
                    method = latest.released?.method || "sse";
                  }
                } catch (e) {}

                return (
                  <GlassCard key={tool.tool_id} className="flex flex-col h-full border-slate-200 group relative">
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(tool)} className="p-1 text-slate-400 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-md">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTool(tool.tool_id)} className="p-1 text-slate-400 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-md">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex justify-between items-start mb-4 pr-16">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{tool.name}</h3>
                        <div className="text-xs text-slate-400 font-mono mt-1">ID: {tool.tool_id.substring(0,8)}</div>
                      </div>
                      {isActive ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-600 flex-grow mb-4">
                      {tool.description || "No description provided."}
                    </p>

                    <div className="mt-auto space-y-2 border-t border-slate-200 pt-4">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-500">Status</span>
                        <span className={isActive ? "text-green-600 font-bold" : "text-slate-500"}>{tool.on_status}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-500">Transport Method</span>
                        <span className="text-slate-700 uppercase">{method}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-500">Port/URL</span>
                        <span className="text-slate-700">{port}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-xs font-mono pt-2">
                        <span className="text-slate-500 flex items-center gap-1"><Terminal className="w-3 h-3"/> Command Args</span>
                        <code className="bg-slate-50 p-2 rounded-md truncate block text-slate-700 border border-slate-200">
                          {args || "N/A"}
                        </code>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 w-full max-w-xl shadow-2xl flex flex-col rounded-xl">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h2 className="font-mono font-bold uppercase tracking-widest text-sm text-slate-900">
                {modalMode === "create" ? "Register New MCP Server" : "Modify MCP Server"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form id="tool-form" onSubmit={handleSave} className="space-y-4 font-mono text-sm text-slate-900">
                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">MCP Server Name</label>
                  <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="e.g. UiPath MCP" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 h-20 resize-none focus:outline-none focus:border-blue-500" placeholder="Agent tools description..."></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1 uppercase text-xs">Status</label>
                    <select value={formData.on_status} onChange={(e) => setFormData({...formData, on_status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500">
                      <option value="Online">Online</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 uppercase text-xs">Transport Method</label>
                    <select value={formData.method} onChange={(e) => setFormData({...formData, method: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500">
                      <option value="sse">SSE (HTTP)</option>
                      <option value="stdio">STDIO (Command)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">Port / URL</label>
                  <input value={formData.port} onChange={(e) => setFormData({...formData, port: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="e.g. 10001 or http://localhost:10001" />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">Command Arguments (STDIO)</label>
                  <input value={formData.args} onChange={(e) => setFormData({...formData, args: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="e.g. build/index.js" />
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-md text-slate-600 hover:text-slate-900 uppercase font-mono text-sm bg-white">Cancel</button>
              <button type="submit" form="tool-form" className="px-4 py-2 bg-slate-900 text-white rounded-md font-bold uppercase font-mono text-sm hover:bg-slate-700 transition-colors">
                {modalMode === "create" ? "Register" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
