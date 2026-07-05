"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import { ArrowLeft, RefreshCw, Plus, Bot, Power, Box, Edit2, Trash2, X } from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [toolsList, setToolsList] = useState<any[]>([]); // For the assign tool dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentAgent, setCurrentAgent] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    agent_name: "",
    description: "",
    agent_style: "The agent will reply in a warm and friendly manner, using English.",
    on_status: true,
    tools: [] as string[]
  });
  
  const fetchAgentsAndTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const [agentsRes, toolsRes] = await Promise.all([
        fetch(`${apiUrl}/agents`, { headers: { "x-robot-key": robotKey } }),
        fetch(`${apiUrl}/tools`, { headers: { "x-robot-key": robotKey } })
      ]);
      
      if (!agentsRes.ok) throw new Error(`Agents API Error: ${agentsRes.statusText}`);
      if (!toolsRes.ok) throw new Error(`Tools API Error: ${toolsRes.statusText}`);
      
      const agentsData = await agentsRes.json();
      const toolsData = await toolsRes.json();
      
      setAgents(agentsData || []);
      setToolsList(toolsData || []);
    } catch (err: any) {
      setError(err.message || "Failed to load agents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentsAndTools();
  }, []);

  const openCreateModal = () => {
    setModalMode("create");
    setCurrentAgent(null);
    setFormData({ 
      agent_name: "", 
      description: "", 
      agent_style: "The agent will reply in a warm and friendly manner, using English.", 
      on_status: true, 
      tools: [] 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (agent: any) => {
    setModalMode("edit");
    setCurrentAgent(agent);
    
    setFormData({
      agent_name: agent.agent_name || "",
      description: agent.description || "",
      agent_style: agent.agent_style || "",
      on_status: agent.on_status ?? true,
      tools: agent.tools || []
    });
    setIsModalOpen(true);
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to delete this Agent?")) return;
    
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const res = await fetch(`${apiUrl}/agents/${agentId}`, {
        method: "DELETE",
        headers: { "x-robot-key": robotKey }
      });
      
      if (!res.ok) throw new Error("Failed to delete agent");
      fetchAgentsAndTools();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const payload = {
        agent_name: formData.agent_name,
        description: formData.description,
        agent_style: formData.agent_style,
        on_status: formData.on_status,
        tools: formData.tools
      };

      const url = modalMode === "create" ? `${apiUrl}/agents` : `${apiUrl}/agents/${currentAgent.agent_id}`;
      const method = modalMode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "x-robot-key": robotKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to save agent");
      
      setIsModalOpen(false);
      fetchAgentsAndTools();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToolSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({ ...formData, tools: selectedOptions });
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
              Agent Matrix
            </h1>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 transition-all bg-white font-mono uppercase text-sm"
            >
              <Plus className="w-4 h-4" /> Create Agent
            </button>
            <button 
              onClick={fetchAgentsAndTools}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 transition-all bg-white font-mono uppercase text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Sync Matrix
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="border border-slate-200 bg-white overflow-hidden flex flex-col min-h-[600px] rounded-xl">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-mono uppercase tracking-widest text-sm font-bold text-slate-900">Agent Registry Ledger</h2>
            <div className="text-xs font-mono text-slate-500">{agents.length} Agents Enrolled</div>
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
          ) : agents.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono uppercase">
              No agents found in the registry.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <GlassCard key={agent.agent_id} className="flex flex-col h-full border-slate-200 group relative">
                  
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditModal(agent)} className="p-1 text-slate-400 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-md">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteAgent(agent.agent_id)} className="p-1 text-slate-400 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-md">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex justify-between items-start mb-4 pr-16">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                        <Bot className="w-6 h-6 text-slate-900" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-slate-900">{agent.agent_name}</h3>
                        <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-2">
                          <span className={agent.on_status ? "text-green-600 font-bold" : "text-slate-400"}>
                            <Power className="w-3 h-3 inline mr-1" />
                            {agent.on_status ? "ONLINE" : "OFFLINE"}
                          </span>
                          <span className="text-slate-300">|</span>
                          ID: {agent.agent_id.substring(0,8)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Description</h4>
                    <p className="text-sm text-slate-700">
                      {agent.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">System Prompt</h4>
                    <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs font-mono text-slate-600 line-clamp-3">
                      {agent.agent_style || "Default assistant behavior."}
                    </div>
                  </div>

                  <div className="mt-auto space-y-2 border-t border-slate-200 pt-4">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <Box className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-500">Attached Tools:</span>
                      <span className="text-slate-900 font-bold">{agent.tools?.length || 0} Tools</span>
                    </div>
                    {agent.tools && agent.tools.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {agent.tools.map((toolId: string) => {
                          const toolObj = toolsList.find(t => t.tool_id === toolId);
                          return (
                            <span key={toolId} className="px-2 py-1 text-[10px] uppercase font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                              {toolObj ? toolObj.name : toolId.substring(0,8)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
              <h2 className="font-mono font-bold uppercase tracking-widest text-sm text-slate-900">
                {modalMode === "create" ? "Enlist New Agent" : "Modify Agent Parameters"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form id="agent-form" onSubmit={handleSave} className="space-y-4 font-mono text-sm text-slate-900">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1 uppercase text-xs">Agent Name</label>
                    <input required value={formData.agent_name} onChange={(e) => setFormData({...formData, agent_name: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="e.g. Finance Assistant" />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 uppercase text-xs">Status</label>
                    <select value={formData.on_status ? "true" : "false"} onChange={(e) => setFormData({...formData, on_status: e.target.value === "true"})} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500">
                      <option value="true">Online</option>
                      <option value="false">Offline</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">Description</label>
                  <input value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} type="text" className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 focus:outline-none focus:border-blue-500" placeholder="Agent's primary role..." />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">System Prompt (Personality & Rules)</label>
                  <textarea value={formData.agent_style} onChange={(e) => setFormData({...formData, agent_style: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 h-32 resize-none focus:outline-none focus:border-blue-500"></textarea>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 uppercase text-xs">Assign MCP Tools (Hold Ctrl/Cmd to select multiple)</label>
                  <select 
                    multiple 
                    value={formData.tools} 
                    onChange={handleToolSelection} 
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md px-3 py-2 h-32 focus:outline-none focus:border-blue-500"
                  >
                    {toolsList.map(tool => (
                      <option key={tool.tool_id} value={tool.tool_id}>
                        {tool.name} ({tool.on_status ? 'Online' : 'Offline'})
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-4">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded-md text-slate-600 hover:text-slate-900 uppercase font-mono text-sm bg-white">Cancel</button>
              <button type="submit" form="agent-form" className="px-4 py-2 bg-slate-900 text-white rounded-md font-bold uppercase font-mono text-sm hover:bg-slate-700 transition-colors">
                {modalMode === "create" ? "Enlist" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
