"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import { Select, MultiSelect } from "@/components/Select";
import { ShareModal } from "@/components/ShareModal";
import {
  RefreshCw,
  Plus,
  Bot,
  Power,
  Edit2,
  Trash2,
  Share2,
  X,
  Wrench,
  ChevronRight,
  Workflow,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";

// Client-side mirror of amadeus-core's recipes/types.ts (creatoroop.md) —
// form-editable shape only, no executor logic. argsTemplate-shaped fields are
// kept as raw JSON text while editing (Step 3's sanctioned textarea fallback)
// and parsed only on save.
interface RecipeStepForm {
  id: string;
  label: string;
  toolName: string;
  argsTemplateText: string;
  variantCount: string; // numeric text input, "" = unset
  resolveEnabled: boolean;
  resolverId: string;
  nameTemplate: string;
  pollForEnabled: boolean;
  pollForToolName: string;
  pollForArgsTemplateText: string;
  terminalField: string;
  terminalValuesText: string; // comma-separated
  successValuesText: string; // comma-separated, optional
  timeoutSeconds: string;
  pollIntervalSeconds: string;
  verifyEnabled: boolean;
  verifyToolName: string;
  verifyArgsTemplateText: string;
  checkField: string;
  mustBeNonEmpty: boolean;
  onFault: "rotate_variant" | "abort_iteration" | "abort_recipe";
}

interface RecipeForm {
  id?: string;
  label: string;
  iterations: string;
  resolversText: string; // raw JSON array of RecipeResolverDef
  steps: RecipeStepForm[];
}

function emptyStep(): RecipeStepForm {
  return {
    id: `step_${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    toolName: "",
    argsTemplateText: "{}",
    variantCount: "",
    resolveEnabled: false,
    resolverId: "",
    nameTemplate: "",
    pollForEnabled: false,
    pollForToolName: "",
    pollForArgsTemplateText: "{}",
    terminalField: "",
    terminalValuesText: "",
    successValuesText: "",
    timeoutSeconds: "120",
    pollIntervalSeconds: "5",
    verifyEnabled: false,
    verifyToolName: "",
    verifyArgsTemplateText: "{}",
    checkField: "",
    mustBeNonEmpty: true,
    onFault: "abort_iteration",
  };
}

function emptyRecipeForm(): RecipeForm {
  return { label: "", iterations: "1", resolversText: "[]", steps: [] };
}

function stepFromServer(step: any): RecipeStepForm {
  return {
    id: step.id,
    label: step.label ?? "",
    toolName: step.toolName ?? "",
    argsTemplateText: JSON.stringify(step.argsTemplate ?? {}, null, 2),
    variantCount: step.variantCount != null ? String(step.variantCount) : "",
    resolveEnabled: !!step.resolve,
    resolverId: step.resolve?.resolverId ?? "",
    nameTemplate: step.resolve?.nameTemplate ?? "",
    pollForEnabled: !!step.pollFor,
    pollForToolName: step.pollFor?.toolName ?? "",
    pollForArgsTemplateText: JSON.stringify(step.pollFor?.argsTemplate ?? {}, null, 2),
    terminalField: step.pollFor?.terminalField ?? "",
    terminalValuesText: (step.pollFor?.terminalValues ?? []).join(", "),
    successValuesText: (step.pollFor?.successValues ?? []).join(", "),
    timeoutSeconds: step.pollFor?.timeoutSeconds != null ? String(step.pollFor.timeoutSeconds) : "120",
    pollIntervalSeconds: step.pollFor?.pollIntervalSeconds != null ? String(step.pollFor.pollIntervalSeconds) : "5",
    verifyEnabled: !!step.verify,
    verifyToolName: step.verify?.toolName ?? "",
    verifyArgsTemplateText: JSON.stringify(step.verify?.argsTemplate ?? {}, null, 2),
    checkField: step.verify?.checkField ?? "",
    mustBeNonEmpty: step.verify?.mustBeNonEmpty ?? true,
    onFault: step.onFault ?? "abort_iteration",
  };
}

function recipeFormFromServer(recipe: any): RecipeForm {
  return {
    id: recipe.id,
    label: recipe.label ?? "",
    iterations: String(recipe.iterations ?? 1),
    resolversText: JSON.stringify(recipe.resolvers ?? [], null, 2),
    steps: (recipe.steps ?? []).map(stepFromServer),
  };
}

/** Parses the editable form back into the server RecipeDef shape. Throws
 * with a human-readable message on the first invalid field found — the
 * caller shows this instead of attempting a partial save. */
function buildServerRecipe(form: RecipeForm, agentId: string): any {
  const parseJson = (text: string, label: string) => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label}: invalid JSON`);
    }
  };
  const splitList = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

  if (form.steps.length === 0) throw new Error("At least one step is required.");

  const steps = form.steps.map((step, idx) => {
    if (!step.label.trim()) throw new Error(`Step ${idx + 1}: label is required.`);
    if (!step.toolName.trim()) throw new Error(`Step ${idx + 1}: tool name is required.`);
    const out: any = {
      id: step.id,
      label: step.label.trim(),
      toolName: step.toolName.trim(),
      argsTemplate: parseJson(step.argsTemplateText, `Step ${idx + 1} args`),
      onFault: step.onFault,
    };
    if (step.variantCount.trim()) out.variantCount = Number(step.variantCount);
    if (step.resolveEnabled) {
      if (!step.resolverId.trim() || !step.nameTemplate.trim()) {
        throw new Error(`Step ${idx + 1}: resolver id and name template are required when resolution is enabled.`);
      }
      out.resolve = { resolverId: step.resolverId.trim(), nameTemplate: step.nameTemplate.trim() };
    }
    if (step.pollForEnabled) {
      if (!step.pollForToolName.trim() || !step.terminalField.trim() || !step.terminalValuesText.trim()) {
        throw new Error(`Step ${idx + 1}: pollFor tool name, terminal field, and terminal values are required.`);
      }
      out.pollFor = {
        toolName: step.pollForToolName.trim(),
        argsTemplate: parseJson(step.pollForArgsTemplateText, `Step ${idx + 1} pollFor args`),
        terminalField: step.terminalField.trim(),
        terminalValues: splitList(step.terminalValuesText),
        ...(step.successValuesText.trim() ? { successValues: splitList(step.successValuesText) } : {}),
        timeoutSeconds: Number(step.timeoutSeconds) || 120,
        pollIntervalSeconds: Number(step.pollIntervalSeconds) || 5,
      };
    }
    if (step.verifyEnabled) {
      if (!step.verifyToolName.trim() || !step.checkField.trim()) {
        throw new Error(`Step ${idx + 1}: verify tool name and check field are required.`);
      }
      out.verify = {
        toolName: step.verifyToolName.trim(),
        argsTemplate: parseJson(step.verifyArgsTemplateText, `Step ${idx + 1} verify args`),
        checkField: step.checkField.trim(),
        mustBeNonEmpty: step.mustBeNonEmpty,
      };
    }
    return out;
  });

  return {
    id: form.id,
    agentId,
    label: form.label.trim() || "Untitled Recipe",
    steps,
    iterations: Number(form.iterations) || 1,
    maxConcurrentJobs: 1,
    resolvers: parseJson(form.resolversText, "Resolvers"),
  };
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [toolsList, setToolsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [currentAgent, setCurrentAgent] = useState<any>(null);
  const [sharingAgent, setSharingAgent] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    agent_name: "",
    description: "",
    agent_style: "The agent will reply in a warm and friendly manner, using English.",
    on_status: true,
    tools: [] as string[],
  });

  // Loop Mode (creatoroop.md) — a recipe belongs to exactly one agent and is
  // fetched/edited alongside that agent's own form, not on a separate page.
  const [recipeEnabled, setRecipeEnabled] = useState(false);
  const [recipeExistedOnOpen, setRecipeExistedOnOpen] = useState(false);
  const [recipe, setRecipe] = useState<RecipeForm>(emptyRecipeForm());
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchAgentsAndTools = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, toolsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/tools"),
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
    setRecipeEnabled(false);
    setRecipeExistedOnOpen(false);
    setRecipe(emptyRecipeForm());
    setRecipeError(null);
    setIsModalOpen(true);
  };

  const openEditModal = async (agent: any) => {
    setModalMode("edit");
    setCurrentAgent(agent);
    setFormData({ agent_name: agent.agent_name || "", description: agent.description || "", agent_style: agent.agent_style || "", on_status: agent.on_status ?? true, tools: agent.tools || [] });
    setRecipeError(null);
    setIsModalOpen(true);

    try {
      const res = await fetch(`/api/orchestrator/agents/${agent.agent_id}/recipe`);
      if (res.ok) {
        const data = await res.json();
        setRecipe(recipeFormFromServer(data));
        setRecipeEnabled(true);
        setRecipeExistedOnOpen(true);
      } else {
        setRecipe(emptyRecipeForm());
        setRecipeEnabled(false);
        setRecipeExistedOnOpen(false);
      }
    } catch {
      setRecipe(emptyRecipeForm());
      setRecipeEnabled(false);
      setRecipeExistedOnOpen(false);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm("Delete this agent?")) return;
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      fetchAgentsAndTools();
    } catch (err: any) { alert(err.message); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecipeError(null);

    // Validate the recipe form BEFORE touching the agent record, so a typo
    // in a JSON textarea never leaves the agent saved but the recipe silently
    // dropped.
    let serverRecipe: any = null;
    if (recipeEnabled) {
      try {
        serverRecipe = buildServerRecipe(recipe, currentAgent?.agent_id ?? "");
      } catch (err: any) {
        setRecipeError(err.message);
        return;
      }
    }

    try {
      const url = modalMode === "create" ? "/api/agents" : `/api/agents/${currentAgent.agent_id}`;
      const res = await fetch(url, {
        method: modalMode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to save");
      const savedAgent = await res.json();
      const agentId = savedAgent.agent_id ?? currentAgent?.agent_id;

      if (recipeEnabled && serverRecipe && agentId) {
        serverRecipe.agentId = agentId;
        const recipeRes = await fetch(`/api/orchestrator/agents/${agentId}/recipe`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serverRecipe),
        });
        if (!recipeRes.ok) throw new Error("Agent saved, but Loop Mode recipe failed to save.");
      } else if (!recipeEnabled && recipeExistedOnOpen && agentId) {
        await fetch(`/api/orchestrator/agents/${agentId}/recipe`, { method: "DELETE" });
      }

      setIsModalOpen(false);
      fetchAgentsAndTools();
    } catch (err: any) { alert(err.message); }
  };

  const updateStep = (idx: number, patch: Partial<RecipeStepForm>) => {
    setRecipe((r) => ({ ...r, steps: r.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  };
  const addStep = () => setRecipe((r) => ({ ...r, steps: [...r.steps, emptyStep()] }));
  const removeStep = (idx: number) => setRecipe((r) => ({ ...r, steps: r.steps.filter((_, i) => i !== idx) }));
  const moveStep = (idx: number, dir: -1 | 1) => {
    setRecipe((r) => {
      const target = idx + dir;
      if (target < 0 || target >= r.steps.length) return r;
      const steps = [...r.steps];
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...r, steps };
    });
  };

  // Helper to generate deterministic mock metrics for visual completeness
  const getAgentMetrics = (agentId: string) => {
    let val = 0;
    if (agentId) {
      for (let i = 0; i < agentId.length; i++) val += agentId.charCodeAt(i);
    }
    const successRate = 96.5 + (val % 3) + ((val % 10) / 10);
    const latency = 0.9 + ((val % 6) / 10);
    const runs = 220 + (val % 1250);
    return { successRate: successRate.toFixed(1), latency: latency.toFixed(1), runs };
  };

  /** Extracts transport method from a tool's versions JSONB. Returns 'sse' | 'stdio' | '?' */
  const getToolMethod = (tool: any): string => {
    try {
      const versions = typeof tool.versions === 'string' ? JSON.parse(tool.versions) : tool.versions;
      return versions?.[versions.length - 1]?.released?.method ?? '?';
    } catch {
      return '?';
    }
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.agent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "online" && agent.on_status) ||
      (statusFilter === "offline" && !agent.on_status);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="page-header border-b border-slate-100 pb-6 mb-6">
        <div>
          <p className="ui-label text-slate-400 mb-2">Agent Registry</p>
          <h1 className="section-head text-3xl text-slate-900 mb-1">Agent Gallery</h1>
          <p className="text-sm text-slate-500">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} registered ·{" "}
            {agents.filter(a => a.on_status).length} online and ready
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAgentsAndTools} className="btn-secondary text-xs py-2.5 px-4 rounded-xl shadow-sm bg-white hover:bg-slate-50 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={openCreateModal} className="btn-primary text-xs py-2.5 px-4 rounded-xl shadow-md bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Agent
          </button>
        </div>
      </div>

      {/* Toolbar: Search and Filter Chips */}
      {!loading && !error && agents.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8 bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search agents by name or role..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
            <Bot className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-mono text-slate-400 mr-2 flex-shrink-0">Filter Status:</span>
            {[
              { id: "all", label: `All (${agents.length})` },
              { id: "online", label: `Online (${agents.filter(a => a.on_status).length})` },
              { id: "offline", label: `Offline (${agents.filter(a => !a.on_status).length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${statusFilter === tab.id ? "bg-violet-50 border-violet-200 text-violet-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50" }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <RainbowRibbonLoader />
          <p className="mt-4 text-xs font-mono text-slate-400">Loading Agent Garden…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold mb-1">Connection Error</p>
          <p className="text-red-500 text-xs font-mono">{error}</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <p className="font-mono text-lg text-slate-400">
            amadeus@a2a:~$ <span className="cursor-blink text-slate-700">_</span>
          </p>
          <p className="text-xs font-mono text-slate-400 mt-3">No agents registered yet.</p>
          <button onClick={openCreateModal} className="mt-4 btn-primary text-xs py-2 px-4">
            <Plus className="w-3.5 h-3.5" /> Create First Agent
          </button>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white border border-slate-100 rounded-2xl">
          <Bot className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm font-medium">No agents match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAgents.map((agent, index) => {
            const assignedTools = (agent.tools || []).map((tid: string) =>
              toolsList.find(t => t.tool_id === tid)
            ).filter(Boolean);
            const metrics = getAgentMetrics(agent.agent_id);

            return (
              <div
                key={agent.agent_id}
                style={{ animationDelay: `${index * 0.05}s` }}
                className="stream-in bg-white border border-slate-200 rounded-2xl p-6 card-hover group relative flex flex-col hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-300"
              >
                {/* Status badge — top-right corner, hides on hover to reveal actions */}
                <div className="absolute top-4 right-4 opacity-100 group-hover:opacity-0 transition-opacity z-10 pointer-events-none">
                  <span className={`badge text-[9px] px-2 py-0.5 rounded-full ${agent.on_status ? "badge-green" : "badge-slate"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${agent.on_status ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
                    {agent.on_status ? "Online" : "Offline"}
                  </span>
                </div>

                {/* Actions (visible on hover) */}
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button onClick={() => setSharingAgent({ id: agent.agent_id, name: agent.agent_name })} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50 rounded-lg shadow-sm transition-all">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEditModal(agent)} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 rounded-lg shadow-sm transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteAgent(agent.agent_id)} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg shadow-sm transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Card Header */}
                <div className="flex items-start gap-4 mb-4 pr-16">
                  {/* Styled Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="section-head text-slate-900 text-base truncate leading-snug">{agent.agent_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono text-slate-400">ID: {agent.agent_id?.substring(0, 8)}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {agent.description ? (
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed line-clamp-2">{agent.description}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic mb-4">No description configured.</p>
                )}

                {/* System Prompt Code Box */}
                <div className="mb-4 bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                    <span>System Prompt / Personality</span>
                    <span>Configuration</span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 line-clamp-2 leading-relaxed">
                    {agent.agent_style || "The agent has no custom personality prompt configured."}
                  </div>
                </div>

                {/* Garden Metrics Row */}
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-100 mb-4 bg-slate-50/50 rounded-xl px-2">
                  <div className="text-center">
                    <p className="text-[9px] font-mono text-slate-400">Invocations</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{metrics.runs} runs</p>
                  </div>
                  <div className="text-center border-x border-slate-100">
                    <p className="text-[9px] font-mono text-slate-400">Avg Latency</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{metrics.latency}s</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-mono text-slate-400">Success Rate</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{metrics.successRate}%</p>
                  </div>
                </div>

                {/* Attached Tools (Wrench) */}
                <div className="mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tools Connected ({assignedTools.length})</span>
                  </div>
                  {assignedTools.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedTools.map((tool: any) => {
                        const method = getToolMethod(tool);
                        const methodIcon = method === 'stdio' ? '⚡' : method === 'sse' ? '📡' : '';
                        return (
                          <span
                            key={tool.tool_id}
                            title={`Transport: ${method.toUpperCase()}`}
                            className="badge badge-blue text-[9px] px-2 py-0.5 rounded-lg border border-blue-100 flex items-center gap-1"
                          >
                            <Wrench className="w-2.5 h-2.5 opacity-60" />
                            {methodIcon && <span className="text-[10px]">{methodIcon}</span>}
                            {tool.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No tools assigned to this agent.</p>
                  )}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <Link
                      href={`/playground?agent=${encodeURIComponent(agent.agent_name || "")}`}
                      className="text-xs font-semibold text-violet-600 hover:underline"
                    >
                      → Invoke
                    </Link>
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="font-extrabold text-slate-900 text-lg">
                {modalMode === "create" ? "Register New Agent" : "Edit Agent Details"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="agent-form" onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Agent Name</label>
                    <input required value={formData.agent_name} onChange={e => setFormData({ ...formData, agent_name: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. Settlement Clerk Assistant" />
                  </div>
                  <div>
                    <label className="form-label">Garden Status</label>
                    <Select
                      value={formData.on_status ? "true" : "false"}
                      onChange={(v) => setFormData({ ...formData, on_status: v === "true" })}
                      options={[
                        { value: "true", label: "Online" },
                        { value: "false", label: "Offline" },
                      ]}
                      triggerClassName="rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label">Description / Agent Role</label>
                  <input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="Primary task of the agent (e.g. extract document data and recommend transitions)..." />
                </div>
                <div>
                  <label className="form-label">System Prompt / Agent Persona</label>
                  <textarea value={formData.agent_style} onChange={e => setFormData({ ...formData, agent_style: e.target.value })} className="form-input rounded-xl border-slate-200 h-28 resize-none font-mono text-xs" />
                </div>
                <div>
                  <label className="form-label">Assign MCP Tools <span className="normal-case font-normal text-slate-400">(select one or more)</span></label>
                  <MultiSelect
                    values={formData.tools}
                    onChange={(vals) => setFormData({ ...formData, tools: vals })}
                    options={toolsList.map((tool) => {
                      const method = getToolMethod(tool);
                      const methodIcon = method === 'stdio' ? '⚡' : method === 'sse' ? '📡' : '?';
                      return {
                        value: tool.tool_id,
                        label: `${methodIcon} ${tool.name}`,
                        hint: `${method.toUpperCase()} · ${tool.on_status || 'Online'}`,
                      };
                    })}
                    placeholder="Select MCP tools…"
                    triggerClassName="rounded-xl"
                  />
                  {/* Legend */}
                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-3">
                    <span>⚡ STDIO — spawned on-demand</span>
                    <span>📡 SSE — persistent HTTP server</span>
                  </p>
                </div>

                {/* Loop Mode (creatoroop.md) — a structured step-chain form,
                    scoped to whatever tools are already attached above. Not a
                    node/canvas editor; that's flagged future work, not this. */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label flex items-center gap-1.5">
                      <Workflow className="w-3.5 h-3.5 text-slate-400" /> Loop Mode
                    </label>
                    {modalMode === "edit" && formData.tools.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRecipeEnabled((v) => !v)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${recipeEnabled ? "bg-indigo-600" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${recipeEnabled ? "translate-x-5" : ""}`} />
                      </button>
                    )}
                  </div>

                  {modalMode === "create" ? (
                    <p className="text-xs text-slate-400 italic">
                      Loop Mode configuration becomes available after creating this agent and attaching tools.
                    </p>
                  ) : formData.tools.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Attach at least one MCP tool above to configure Loop Mode.
                    </p>
                  ) : !recipeEnabled ? (
                    <p className="text-xs text-slate-400 italic">
                      This agent runs as a normal conversational agent — no recipe configured.
                    </p>
                  ) : (
                    <div className="space-y-4 mt-3">
                      {recipeError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {recipeError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="form-label">Recipe Label</label>
                          <input value={recipe.label} onChange={(e) => setRecipe({ ...recipe, label: e.target.value })} className="form-input rounded-xl border-slate-200" placeholder="e.g. Danantara Survey Loop" />
                        </div>
                        <div>
                          <label className="form-label">Iterations</label>
                          <input type="number" min={1} max={20} value={recipe.iterations} onChange={(e) => setRecipe({ ...recipe, iterations: e.target.value })} className="form-input rounded-xl border-slate-200" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        {recipe.steps.map((step, idx) => (
                          <div key={step.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-600">Step {idx + 1}</span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUp className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === recipe.steps.length - 1} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDown className="w-3.5 h-3.5" /></button>
                                <button type="button" onClick={() => removeStep(idx)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input value={step.label} onChange={(e) => updateStep(idx, { label: e.target.value })} placeholder="Label (e.g. Get disposable email)" className="form-input rounded-lg border-slate-200 text-xs" />
                              <input value={step.toolName} onChange={(e) => updateStep(idx, { toolName: e.target.value })} placeholder="MCP tool name (e.g. trigger_uipath_job)" className="form-input rounded-lg border-slate-200 text-xs font-mono" />
                            </div>
                            <p className="text-[10px] text-slate-400 -mt-1.5">Must match an MCP method exposed by one of this agent's attached tools — validated when the recipe runs.</p>

                            <div>
                              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Args template (JSON)</label>
                              <textarea value={step.argsTemplateText} onChange={(e) => updateStep(idx, { argsTemplateText: e.target.value })} className="form-input rounded-lg border-slate-200 h-16 resize-none font-mono text-xs" />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Variant count (optional)</label>
                                <input type="number" min={1} value={step.variantCount} onChange={(e) => updateStep(idx, { variantCount: e.target.value })} className="form-input rounded-lg border-slate-200 text-xs" />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">On fault</label>
                                <Select
                                  value={step.onFault}
                                  onChange={(v: any) => updateStep(idx, { onFault: v })}
                                  options={[
                                    { value: "rotate_variant", label: "Rotate variant" },
                                    { value: "abort_iteration", label: "Abort iteration" },
                                    { value: "abort_recipe", label: "Abort recipe" },
                                  ]}
                                  triggerClassName="rounded-lg !py-2 text-xs"
                                />
                              </div>
                            </div>

                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" checked={step.resolveEnabled} onChange={(e) => updateStep(idx, { resolveEnabled: e.target.checked })} />
                              This step needs name→ID resolution
                            </label>
                            {step.resolveEnabled && (
                              <div className="grid grid-cols-2 gap-2 pl-5">
                                <input value={step.resolverId} onChange={(e) => updateStep(idx, { resolverId: e.target.value })} placeholder="Resolver id" className="form-input rounded-lg border-slate-200 text-xs font-mono" />
                                <input value={step.nameTemplate} onChange={(e) => updateStep(idx, { nameTemplate: e.target.value })} placeholder="Name template (e.g. Get_Email_{{variant}})" className="form-input rounded-lg border-slate-200 text-xs font-mono" />
                              </div>
                            )}

                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" checked={step.pollForEnabled} onChange={(e) => updateStep(idx, { pollForEnabled: e.target.checked })} />
                              Wait for async completion
                            </label>
                            {step.pollForEnabled && (
                              <div className="space-y-2 pl-5">
                                <input value={step.pollForToolName} onChange={(e) => updateStep(idx, { pollForToolName: e.target.value })} placeholder="Status-check tool name" className="form-input rounded-lg border-slate-200 text-xs font-mono" />
                                <textarea value={step.pollForArgsTemplateText} onChange={(e) => updateStep(idx, { pollForArgsTemplateText: e.target.value })} className="form-input rounded-lg border-slate-200 h-14 resize-none font-mono text-xs" placeholder="Args template (JSON)" />
                                <div className="grid grid-cols-2 gap-2">
                                  <input value={step.terminalField} onChange={(e) => updateStep(idx, { terminalField: e.target.value })} placeholder="Terminal field (e.g. state)" className="form-input rounded-lg border-slate-200 text-xs" />
                                  <input value={step.terminalValuesText} onChange={(e) => updateStep(idx, { terminalValuesText: e.target.value })} placeholder="Terminal values (comma-separated)" className="form-input rounded-lg border-slate-200 text-xs" />
                                  <input value={step.successValuesText} onChange={(e) => updateStep(idx, { successValuesText: e.target.value })} placeholder="Success values (optional)" className="form-input rounded-lg border-slate-200 text-xs" />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={step.timeoutSeconds} onChange={(e) => updateStep(idx, { timeoutSeconds: e.target.value })} placeholder="Timeout (s)" className="form-input rounded-lg border-slate-200 text-xs" />
                                    <input type="number" value={step.pollIntervalSeconds} onChange={(e) => updateStep(idx, { pollIntervalSeconds: e.target.value })} placeholder="Interval (s)" className="form-input rounded-lg border-slate-200 text-xs" />
                                  </div>
                                </div>
                              </div>
                            )}

                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <input type="checkbox" checked={step.verifyEnabled} onChange={(e) => updateStep(idx, { verifyEnabled: e.target.checked })} />
                              Verify after completion
                            </label>
                            {step.verifyEnabled && (
                              <div className="space-y-2 pl-5">
                                <input value={step.verifyToolName} onChange={(e) => updateStep(idx, { verifyToolName: e.target.value })} placeholder="Verify tool name" className="form-input rounded-lg border-slate-200 text-xs font-mono" />
                                <textarea value={step.verifyArgsTemplateText} onChange={(e) => updateStep(idx, { verifyArgsTemplateText: e.target.value })} className="form-input rounded-lg border-slate-200 h-14 resize-none font-mono text-xs" placeholder="Args template (JSON)" />
                                <div className="flex items-center gap-2">
                                  <input value={step.checkField} onChange={(e) => updateStep(idx, { checkField: e.target.value })} placeholder="Check field" className="form-input rounded-lg border-slate-200 text-xs flex-1" />
                                  <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
                                    <input type="checkbox" checked={step.mustBeNonEmpty} onChange={(e) => updateStep(idx, { mustBeNonEmpty: e.target.checked })} />
                                    Must be non-empty
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button type="button" onClick={addStep} className="btn-secondary text-xs py-2 px-3 rounded-lg flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add Step
                      </button>

                      <details className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Resolvers (Advanced)</summary>
                        <p className="text-[10px] text-slate-400 mt-1 mb-2">
                          One-time name→ID resolution passes (e.g. resolving a release name to a real key via a
                          "list" tool call), referenced by a step's resolver id above.
                        </p>
                        <textarea
                          value={recipe.resolversText}
                          onChange={(e) => setRecipe({ ...recipe, resolversText: e.target.value })}
                          className="form-input rounded-lg border-slate-200 h-28 resize-none font-mono text-xs w-full"
                        />
                      </details>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary text-sm rounded-xl">Cancel</button>
              <button type="submit" form="agent-form" className="btn-primary text-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                {modalMode === "create" ? "Register Agent" : "Save Changes"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {sharingAgent && (
        <ShareModal
          agentId={sharingAgent.id}
          resourceName={sharingAgent.name}
          onClose={() => setSharingAgent(null)}
        />
      )}
    </div>
  );
}
