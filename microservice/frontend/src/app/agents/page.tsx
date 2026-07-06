"use client";

import { useEffect, useState } from "react";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import {
  RefreshCw,
  Plus,
  Bot,
  Power,
  Edit2,
  Trash2,
  X,
  Wrench,
  ChevronRight,
} from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [toolsList, setToolsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentAgent, setCurrentAgent] = useState<any>(null);
  const [formData, setFormData] = useState({
    agent_name: "",
    description: "",
    agent_style: "The agent will reply in a warm and friendly manner, using English.",
    on_status: true,
    tools: [] as string[],
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
  const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "";
  const headers = { "x-robot-key": robotKey };

  const fetchAgentsAndTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, toolsRes] = await Promise.all([
        fetch(`${apiUrl}/agents`, { headers }),
        fetch(`${apiUrl}/tools`, { headers }),
      ]);
      if (!agentsRes.ok) throw new Error(`Agents: ${agentsRes.statusText}`);
      if (!toolsRes.ok) throw new Error(`Tools: ${toolsRes.statusText}`);
      setAgents(await agentsRes.json() || []);
      setToolsList(await toolsRes.json() || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgentsAndTools(); }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentAgent(null);
    setFormData({ agent_name: "", description: "", agent_style: "The agent will reply in a warm and friendly manner, using English.", on_status: true, tools: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (agent: any) => {
    setModalMode("edit");
    setCurrentAgent(agent);
    setFormData({ agent_name: agent.agent_name || "", description: agent.description || "", agent_style: agent.agent_style || "", on_status: agent.on_status ?? true, tools: agent.tools || [] });
    setIsModalOpen(true);
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm("Delete this agent?")) return;
    try {
      const res = await fetch(`${apiUrl}/agents/${agentId}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed");
      fetchAgentsAndTools();
    } catch (err: any) { alert(err.message); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = modalMode === "create" ? `${apiUrl}/agents` : `${apiUrl}/agents/${currentAgent.agent_id}`;
      const res = await fetch(url, {
        method: modalMode === "create" ? "POST" : "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to save");
      setIsModalOpen(false);
      fetchAgentsAndTools();
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Agent Registry</h1>
          <p className="text-sm text-slate-500">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} enrolled ·{" "}
            {agents.filter(a => a.on_status).length} online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAgentsAndTools} className="btn-secondary text-xs py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreateModal} className="btn-primary text-xs py-2 px-3">
            <Plus className="w-3.5 h-3.5" /> New Agent
          </button>
        </div>
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
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Bot className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No agents registered yet.</p>
          <button onClick={openCreateModal} className="mt-4 btn-primary text-xs py-2 px-4">
            <Plus className="w-3.5 h-3.5" /> Create First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => {
            const assignedTools = (agent.tools || []).map((tid: string) =>
              toolsList.find(t => t.tool_id === tid)
            ).filter(Boolean);

            return (
              <div
                key={agent.agent_id}
                className="bg-white border border-slate-200 rounded-xl p-5 card-hover group relative flex flex-col"
              >
                {/* Actions */}
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(agent)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteAgent(agent.agent_id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Header */}
                <div className="flex items-start gap-3 mb-4 pr-14">
                  <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4.5 h-4.5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 leading-tight">{agent.agent_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${agent.on_status ? "badge-green" : "badge-slate"}`}>
                        <Power className="w-2.5 h-2.5" />
                        {agent.on_status ? "Online" : "Offline"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{agent.agent_id?.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {agent.description && (
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">{agent.description}</p>
                )}

                {/* System Prompt */}
                <div className="mb-4">
                  <p className="form-label">System Prompt</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs font-mono text-slate-500 line-clamp-2">
                    {agent.agent_style || "No system prompt configured."}
                  </div>
                </div>

                {/* Tools */}
                <div className="mt-auto pt-4 border-t border-slate-100">
                  <p className="form-label mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3 h-3" /> Attached Tools ({assignedTools.length})
                  </p>
                  {assignedTools.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedTools.map((tool: any) => (
                        <span key={tool.tool_id} className="badge badge-blue">{tool.name}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No tools assigned.</p>
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
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {modalMode === "create" ? "Register New Agent" : "Edit Agent"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="agent-form" onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Agent Name</label>
                    <input required value={formData.agent_name} onChange={e => setFormData({ ...formData, agent_name: e.target.value })} className="form-input" placeholder="e.g. Finance Assistant" />
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select value={formData.on_status ? "true" : "false"} onChange={e => setFormData({ ...formData, on_status: e.target.value === "true" })} className="form-input">
                      <option value="true">Online</option>
                      <option value="false">Offline</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="form-input" placeholder="Agent's primary role and scope…" />
                </div>
                <div>
                  <label className="form-label">System Prompt</label>
                  <textarea value={formData.agent_style} onChange={e => setFormData({ ...formData, agent_style: e.target.value })} className="form-input h-28 resize-none" />
                </div>
                <div>
                  <label className="form-label">Assign MCP Tools <span className="normal-case font-normal text-slate-400">(Ctrl/Cmd + click for multiple)</span></label>
                  <select
                    multiple
                    value={formData.tools}
                    onChange={e => setFormData({ ...formData, tools: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="form-input h-28"
                  >
                    {toolsList.map(tool => (
                      <option key={tool.tool_id} value={tool.tool_id}>
                        {tool.name} ({tool.on_status || "Unknown"})
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" form="agent-form" className="btn-primary text-sm">
                {modalMode === "create" ? "Register Agent" : "Save Changes"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
