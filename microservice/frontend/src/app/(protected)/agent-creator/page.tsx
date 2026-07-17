"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Send, Cpu, CheckCircle, Wand2, Headset, LineChart,
  Code2, Landmark, Loader2, Wrench, AlertTriangle, RotateCcw,
  Globe, Search, ExternalLink, Plus, Sparkles, Share2, Database,
  Upload, X, FileText, Image as ImageIcon, File as FileIcon,
} from "lucide-react";
import { ShareModal } from "@/components/ShareModal";
import MarkdownViewer from "@/components/MarkdownViewer";

interface Message {
  role: "bot" | "user";
  content: string;
}

interface AgentConfig {
  agent_name: string;
  description: string;
  agent_style: string;
  keywords: string[];
  tool_ids: string[];
  reasoning: string;
  available_tools: { tool_id: string; name: string; description: string | null }[];
}

interface McpServer {
  name: string;
  description: string;
  repository: string;
  version: string;
  remotes: { type: string; url: string }[];
  official: boolean;
}

interface KbDocument {
  doc_id: string;
  filename: string;
  file_type: "pdf" | "image" | "txt";
  status: "processing" | "ready" | "failed";
}

interface KnowledgeBaseOption {
  kb_id: string;
  name: string;
  description: string | null;
  documents: KbDocument[];
}

const EXAMPLES = [
  { icon: Headset, label: "Customer Support", text: "Create a customer support agent that answers questions about LC settlement status and escalates unresolved issues to a human checker." },
  { icon: LineChart, label: "Data Analyst", text: "Create a data analyst agent that queries transaction history and generates settlement summaries in JSON format." },
  { icon: Code2, label: "Code Reviewer", text: "Create a code reviewer agent that validates UiPath bot scripts against Amadeus A2A protocol v1 specifications." },
  { icon: Landmark, label: "LC Settlement", text: "Create an orchestrator agent that coordinates Import LC settlement across 9 steps using amadeus-mcp and mcp-uipath tools." },
];

export default function AgentCreator() {
  const [activeTab, setActiveTab] = useState<"architect" | "discover">("architect");

  // --- Architect state ---
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "Hello! I'm the Architect — describe the agent you'd like to build and I'll configure its persona, system prompt, and MCP tool assignments using AI." },
  ]);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [recommendedExternal, setRecommendedExternal] = useState<McpServer[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAgentId, setSavedAgentId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [kbEnabled, setKbEnabled] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseOption[]>([]);
  const [selectedKbs, setSelectedKbs] = useState<Set<string>>(new Set());
  const [kbLoading, setKbLoading] = useState(false);
  const [showNewKbForm, setShowNewKbForm] = useState(false);
  const [newKbForm, setNewKbForm] = useState({ name: "", description: "" });
  const [creatingKb, setCreatingKb] = useState(false);
  const [uploadingKbId, setUploadingKbId] = useState<string | null>(null);
  const kbFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [installingExternal, setInstallingExternal] = useState<string | null>(null);
  const [autofilling, setAutofilling] = useState<"description" | "agent_style" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Discover state ---
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverResults, setDiscoverResults] = useState<McpServer[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverSearched, setDiscoverSearched] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // The LLM wizard has no way to know about knowledge bases (they're not
  // part of its generated config) — fetched independently so the user can
  // attach or create one from within the Knowledge Base section below.
  const fetchKnowledgeBases = useCallback(async () => {
    setKbLoading(true);
    try {
      const res = await fetch("/api/knowledge-bases");
      if (!res.ok) {
        setKnowledgeBases([]);
        return;
      }
      const list: { kb_id: string; name: string; description?: string | null }[] = (await res.json()) || [];
      const details = await Promise.all(
        list.map(async (kb) => {
          const detailRes = await fetch(`/api/knowledge-bases/${kb.kb_id}`);
          if (!detailRes.ok) return { ...kb, description: kb.description ?? null, documents: [] };
          return (await detailRes.json()) as KnowledgeBaseOption;
        }),
      );
      setKnowledgeBases(details);
    } catch {
      setKnowledgeBases([]);
    } finally {
      setKbLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const createKb = async () => {
    if (!newKbForm.name.trim() || creatingKb) return;
    setCreatingKb(true);
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKbForm),
      });
      if (!res.ok) throw new Error("Gagal membuat knowledge base");
      setNewKbForm({ name: "", description: "" });
      setShowNewKbForm(false);
      await fetchKnowledgeBases();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingKb(false);
    }
  };

  const handleKbFileSelected = async (kbId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingKbId(kbId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/knowledge-bases/${kbId}/documents`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Gagal upload dokumen");
      await fetchKnowledgeBases();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingKbId(null);
    }
  };

  const deleteKbDocument = async (kbId: string, docId: string) => {
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal hapus dokumen");
      await fetchKnowledgeBases();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const kbFileIcon = (fileType: string) => {
    if (fileType === "pdf") return <FileText className="w-3 h-3" />;
    if (fileType === "image") return <ImageIcon className="w-3 h-3" />;
    return <FileIcon className="w-3 h-3" />;
  };

  const kbStatusDot: Record<string, string> = {
    ready: "bg-green-500",
    processing: "bg-blue-500 animate-pulse",
    failed: "bg-red-500",
  };

  // Auto-load popular MCPs when user first opens the discover tab
  useEffect(() => {
    if (activeTab === "discover" && !discoverSearched) {
      handleDiscover("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setError(null);
    setSaved(false);

    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setMessages(prev => [...prev, { role: "bot", content: "Analyzing your description… generating agent configuration." }]);
    setIsLoading(true);
    setConfig(null);
    setRecommendedExternal([]);

    try {
      const res = await fetch("/api/agents/create-from-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: userMsg }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || data.message || `Error ${res.status}`);
      }

      const data: AgentConfig = await res.json();
      setConfig(data);
      setSelectedTools(new Set(data.tool_ids));
      
      // Auto-fetch recommended external tools based on LLM keywords
      if (data.keywords && data.keywords.length > 0) {
        setIsSearchingExternal(true);
        try {
          const kwSearch = data.keywords.slice(0, 2).join(" ");
          let extRes = await fetch(`/api/mcp-registry/search?q=${encodeURIComponent(kwSearch)}&limit=3`);
          let extData = extRes.ok ? await extRes.json() : { servers: [] };
          
          // Fallback to single keyword if combined search yields 0 results
          if ((!extData.servers || extData.servers.length === 0) && data.keywords.length > 1) {
            const fallbackRes = await fetch(`/api/mcp-registry/search?q=${encodeURIComponent(data.keywords[0])}&limit=3`);
            if (fallbackRes.ok) {
              extData = await fallbackRes.json();
            }
          }
          
          setRecommendedExternal(extData.servers ?? []);
        } catch (e) {
          console.error("Failed to fetch external recommendations", e);
        } finally {
          setIsSearchingExternal(false);
        }
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "bot", content: `Done! I've configured **${data.agent_name}** with ${data.tool_ids.length} tool(s) assigned. Review the panel on the right and click "Compile Agent" to save it.` },
      ]);
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "bot", content: `Sorry, something went wrong: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompile = async () => {
    if (!config || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: config.agent_name,
          description: config.description,
          agent_style: config.agent_style,
          tools: Array.from(selectedTools),
          knowledge_base_ids: kbEnabled ? Array.from(selectedKbs) : [],
          on_status: true,
          share_editor_with: [],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setSaved(true);
      setSavedAgentId(data.agent_id ?? null);
      setMessages(prev => [...prev, { role: "bot", content: `✅ Agent **${config.agent_name}** has been saved! You can find it in the Agents page.` }]);
    } catch (err: any) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscover = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : discoverQuery).trim() || "automation";
    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscoverSearched(true);
    try {
      const res = await fetch(`/api/mcp-registry/search?q=${encodeURIComponent(q)}&limit=15`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDiscoverResults(data.servers ?? []);
    } catch (err: any) {
      setDiscoverError(err.message);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  const toggleKb = (kbId: string) => {
    setSelectedKbs(prev => {
      const next = new Set(prev);
      if (next.has(kbId)) next.delete(kbId);
      else next.add(kbId);
      return next;
    });
  };

  // Magic Pen — suggests a value for a single field, using whatever's
  // already filled in as context. Populates the (editable) field so the
  // user sees the suggestion and can accept or change it — never applied
  // silently.
  const handleAutofillSuggest = async (fieldName: "description" | "agent_style") => {
    if (!config || autofilling) return;
    setAutofilling(fieldName);
    try {
      const res = await fetch("/api/orchestrator/autofill/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldName,
          fieldContext: {
            agent_name: config.agent_name,
            description: config.description,
            agent_style: config.agent_style,
            keywords: config.keywords,
          },
          currentValue: config[fieldName],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || data.message || `Error ${res.status}`);
      }
      const data = await res.json();
      if (typeof data.value === "string" && data.value.trim()) {
        setConfig(prev => (prev ? { ...prev, [fieldName]: data.value.trim() } : prev));
      }
    } catch (err: any) {
      setError(`Autofill suggestion failed: ${err.message}`);
    } finally {
      setAutofilling(null);
    }
  };

  const handleInstallExternal = async (ext: McpServer) => {
    if (installingExternal) return;
    setInstallingExternal(ext.name);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ext.name,
          description: ext.description,
          versions: [{
            version: ext.version || "1.0.0",
            released: {
              method: "stdio",
              command: "npx",
              args: ["-y", ext.name]
            }
          }],
          on_status: "Offline",
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || `Error ${res.status}`);
      }
      
      const newTool = await res.json();
      
      // Add the new tool to config.available_tools and check it
      if (config) {
        setConfig({
          ...config,
          available_tools: [...config.available_tools, { tool_id: newTool.tool_id, name: newTool.name, description: newTool.description }]
        });
        setSelectedTools(prev => {
          const next = new Set(prev);
          next.add(newTool.tool_id);
          return next;
        });
      }
      
      // Remove from recommended list
      setRecommendedExternal(prev => prev.filter(item => item.name !== ext.name));
      
    } catch (err: any) {
      setError(`Failed to install ${ext.name}: ${err.message}`);
    } finally {
      setInstallingExternal(null);
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-slate-900 overflow-hidden flex-col">
      {/* Top Tab Bar */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900 flex-shrink-0">
        <button
          onClick={() => setActiveTab("architect")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "architect" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800"}`}
        >
          <Wand2 className="w-3.5 h-3.5" /> Agent Architect
        </button>
        <button
          onClick={() => setActiveTab("discover")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "discover" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800"}`}
        >
          <Globe className="w-3.5 h-3.5" /> Discover Global MCP
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {activeTab === "architect" ? (
          <>
            {/* Chat */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700/70 min-w-0">
              <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden relative flex-shrink-0">
                    <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-90" />
                    <div className="absolute inset-[2px] bg-white dark:bg-slate-900 rounded-[7px] flex items-center justify-center">
                      <Bot className="w-4 h-4 text-slate-800 dark:text-slate-200" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">Agent Architect</h1>
                    <p className="ui-label text-slate-400 dark:text-slate-500">LLM-powered agent builder</p>
                  </div>
                </div>
                <span className={`badge ${saved ? "badge-green" : "badge-slate"}`}>
                  {saved ? "Compiled ✓" : isLoading ? "Generating…" : "Draft"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-5">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "bot" && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 relative overflow-hidden p-[1.5px]">
                          <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-90" />
                          <div className="relative z-10 w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                          </div>
                        </div>
                      )}
                      <div className={`px-4 py-3 rounded-2xl max-w-full text-sm leading-relaxed shadow-sm ${msg.role === "user" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-tr-sm" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm w-full"}`}>
                        <MarkdownViewer content={msg.content} />
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-slate-400 dark:text-slate-500 animate-spin" />
                      </div>
                      <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm animate-pulse">LLM is thinking…</div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="px-6 pb-3">
                <div className="max-w-2xl mx-auto">
                  <p className="ui-label text-slate-400 dark:text-slate-500 mb-2">Templates</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {EXAMPLES.map(({ icon: Icon, label, text }) => (
                      <button key={label} onClick={() => setInput(text)} className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-fuchsia-200 dark:border-fuchsia-500/30 hover:text-fuchsia-600 hover:bg-fuchsia-50 dark:bg-fuchsia-900/30 transition-all shadow-sm">
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 pt-2">
                <div className="max-w-2xl mx-auto relative">
                  <textarea rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Describe your agent in plain language… (Enter to send)" className="form-input pr-12 py-3 rounded-2xl resize-none w-full" disabled={isLoading} />
                  <button onClick={handleSend} disabled={!input.trim() || isLoading} className="absolute right-2 bottom-2 p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Inspector Panel */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-[#FAFAFA] dark:bg-[var(--background)]">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900 flex items-center justify-between">
                <h2 className="ui-label text-slate-500 dark:text-slate-400 flex items-center gap-2"><Cpu className="w-3.5 h-3.5" /> Preview Config</h2>
                {config && <button onClick={() => { setConfig(null); setSaved(false); setError(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400"><RotateCcw className="w-3.5 h-3.5" /></button>}
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-3 flex gap-2 text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</div>}
                {!config ? (
                  <>
                    {[{ label: "Agent Name", lines: 1 }, { label: "System Persona", lines: 3 }, { label: "MCP Tool Assignments", lines: 2 }].map(f => (
                      <div key={f.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
                        <p className="ui-label text-slate-400 dark:text-slate-500">{f.label}</p>
                        {Array.from({ length: f.lines }).map((_, i) => (<div key={i} className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800" style={{ width: `${90 - i * 18}%` }} />))}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 justify-center pt-2 text-slate-400 dark:text-slate-500">
                      <Wand2 className="w-3.5 h-3.5" />
                      <p className="text-xs leading-relaxed text-center">Describe your agent — the Architect fills this in.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-1">
                      <p className="ui-label text-slate-400 dark:text-slate-500">Agent Name</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{config.agent_name}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="ui-label text-slate-400 dark:text-slate-500">Description</p>
                        <button
                          onClick={() => handleAutofillSuggest("description")}
                          disabled={autofilling !== null}
                          title="Suggest a value with AI"
                          className="p-1 text-slate-300 hover:text-fuchsia-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {autofilling === "description" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <textarea
                        value={config.description}
                        onChange={e => setConfig(prev => (prev ? { ...prev, description: e.target.value } : prev))}
                        rows={3}
                        className="w-full text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-transparent resize-none outline-none focus:bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1 -m-1 transition-colors"
                      />
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="ui-label text-slate-400 dark:text-slate-500">System Persona</p>
                        <button
                          onClick={() => handleAutofillSuggest("agent_style")}
                          disabled={autofilling !== null}
                          title="Suggest a value with AI"
                          className="p-1 text-slate-300 hover:text-fuchsia-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {autofilling === "agent_style" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <textarea
                        value={config.agent_style}
                        onChange={e => setConfig(prev => (prev ? { ...prev, agent_style: e.target.value } : prev))}
                        rows={4}
                        className="w-full text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap bg-transparent resize-none outline-none focus:bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1 -m-1 transition-colors"
                      />
                    </div>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                      <p className="ui-label text-slate-400 dark:text-slate-500 flex items-center gap-1.5"><Wrench className="w-3 h-3" /> Assigned MCP Tools ({selectedTools.size})</p>
                      {config.available_tools.length === 0 ? (<p className="text-xs text-slate-400 dark:text-slate-500 italic">No tools available in Library.</p>) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {config.available_tools.map(tool => (
                            <label key={tool.tool_id} className="flex items-start gap-2.5 p-2 hover:bg-slate-50 dark:bg-slate-800/50 rounded-lg cursor-pointer border border-transparent hover:border-slate-100 dark:border-slate-800 transition-colors">
                              <input 
                                type="checkbox" 
                                className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                checked={selectedTools.has(tool.tool_id)}
                                onChange={() => toggleTool(tool.tool_id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-medium truncate ${selectedTools.has(tool.tool_id) ? "text-cyan-700 dark:text-cyan-400" : "text-slate-700 dark:text-slate-300"}`}>{tool.name}</p>
                                {tool.description && <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{tool.description}</p>}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                      {config.reasoning && <p className="text-[10px] text-slate-400 dark:text-slate-500 italic mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800"><span className="font-semibold text-slate-500 dark:text-slate-400">LLM Reasoning:</span> {config.reasoning}</p>}
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <span className="ui-label text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                          <Database className="w-3 h-3" /> Gunakan Knowledge Base {kbEnabled && `(${selectedKbs.size})`}
                        </span>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          checked={kbEnabled}
                          onChange={() => setKbEnabled(v => !v)}
                        />
                      </label>

                      {kbEnabled && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                          {kbLoading ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic">Memuat knowledge base…</p>
                          ) : knowledgeBases.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic">Belum ada knowledge base.</p>
                          ) : (
                            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                              {knowledgeBases.map(kb => (
                                <div key={kb.kb_id} className="border border-slate-100 dark:border-slate-800 rounded-lg p-2">
                                  <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                      checked={selectedKbs.has(kb.kb_id)}
                                      onChange={() => toggleKb(kb.kb_id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs font-medium truncate ${selectedKbs.has(kb.kb_id) ? "text-cyan-700 dark:text-cyan-400" : "text-slate-700 dark:text-slate-300"}`}>{kb.name}</p>
                                      {kb.description && <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{kb.description}</p>}
                                    </div>
                                  </label>

                                  <div className="mt-2 pl-6 space-y-1">
                                    {kb.documents.map(doc => (
                                      <div key={doc.doc_id} className="flex items-center justify-between gap-2 text-[10px] bg-slate-50 dark:bg-slate-800/50 rounded-md px-2 py-1">
                                        <div className="flex items-center gap-1 min-w-0 text-slate-600 dark:text-slate-400">
                                          {kbFileIcon(doc.file_type)}
                                          <span className="truncate">{doc.filename}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className={`w-1.5 h-1.5 rounded-full ${kbStatusDot[doc.status] || "bg-slate-400"}`} title={doc.status} />
                                          <button onClick={() => deleteKbDocument(kb.kb_id, doc.doc_id)} className="text-slate-400 dark:text-slate-500 hover:text-red-600">
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => kbFileInputRefs.current[kb.kb_id]?.click()}
                                      disabled={uploadingKbId === kb.kb_id}
                                      className="text-[10px] text-cyan-600 hover:text-cyan-800 flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {uploadingKbId === kb.kb_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                      Upload dokumen
                                    </button>
                                    <input
                                      ref={(el) => { kbFileInputRefs.current[kb.kb_id] = el; }}
                                      type="file"
                                      accept=".pdf,image/*,.txt"
                                      className="hidden"
                                      onChange={(e) => {
                                        handleKbFileSelected(kb.kb_id, e.target.files?.[0]);
                                        e.target.value = "";
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {showNewKbForm ? (
                            <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-2">
                              <input
                                value={newKbForm.name}
                                onChange={e => setNewKbForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Nama knowledge base"
                                className="form-input text-xs py-1.5 rounded-lg w-full"
                              />
                              <input
                                value={newKbForm.description}
                                onChange={e => setNewKbForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Deskripsi (opsional)"
                                className="form-input text-xs py-1.5 rounded-lg w-full"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={createKb}
                                  disabled={!newKbForm.name.trim() || creatingKb}
                                  className="btn-primary text-[10px] py-1.5 px-2.5 rounded-lg flex-1 justify-center disabled:opacity-50"
                                >
                                  {creatingKb ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buat"}
                                </button>
                                <button onClick={() => setShowNewKbForm(false)} className="btn-secondary text-[10px] py-1.5 px-2.5 rounded-lg">
                                  Batal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setShowNewKbForm(true)} className="text-[10px] text-cyan-600 hover:text-cyan-800 flex items-center gap-1 font-medium">
                              <Plus className="w-3 h-3" /> Knowledge Base Baru
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {(isSearchingExternal || recommendedExternal.length > 0 || config.keywords?.length > 0) && (
                      <div className="bg-white dark:bg-slate-900 border border-fuchsia-200 dark:border-fuchsia-500/30 shadow-sm rounded-xl p-4 space-y-2 mt-2">
                        <p className="ui-label text-fuchsia-600 flex items-center gap-1.5">
                          <Globe className="w-3 h-3" /> External Recommendations
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">Searching registry for: <span className="font-medium text-slate-500 dark:text-slate-400">{config.keywords?.join(", ")}</span></p>
                        
                        {isSearchingExternal ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin" />
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2">Scraping global registry...</span>
                          </div>
                        ) : recommendedExternal.length === 0 ? (
                          <div className="p-3 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">No matching external MCPs found in the global registry.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {recommendedExternal.map((ext, idx) => (
                              <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 hover:border-cyan-300 transition-colors">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{ext.name.split("/").pop()}</span>
                                  {ext.official && <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5 font-semibold">official</span>}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{ext.description}</p>
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                                  {ext.repository ? (
                                    <a href={ext.repository} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-500 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1 font-medium">
                                      <ExternalLink className="w-2.5 h-2.5" /> Source
                                    </a>
                                  ) : <div />}
                                  <button 
                                    onClick={() => handleInstallExternal(ext)}
                                    disabled={installingExternal === ext.name}
                                    className="text-[10px] bg-fuchsia-50 dark:bg-fuchsia-900/30 hover:bg-fuchsia-100 text-fuchsia-700 dark:text-fuchsia-400 font-semibold py-1 px-2.5 rounded border border-fuchsia-200 dark:border-fuchsia-500/30 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {installingExternal === ext.name ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" /> Installing...</>
                                    ) : (
                                      <><Plus className="w-3 h-3" /> Install</>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="p-5 border-t border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900">
                <button onClick={handleCompile} disabled={!config || isSaving || saved} className="w-full btn-primary text-sm justify-center rounded-xl disabled:opacity-40 disabled:cursor-not-allowed">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : saved ? <><CheckCircle className="w-4 h-4" /> Agent Saved!</> : <><CheckCircle className="w-4 h-4" /> Compile Agent</>}
                </button>
                {saved && savedAgentId && (
                  <button onClick={() => setShowShareModal(true)} className="w-full btn-secondary text-sm justify-center rounded-xl mt-2 flex items-center gap-2">
                    <Share2 className="w-3.5 h-3.5" /> Share this agent
                  </button>
                )}
                <p className="text-center ui-label text-slate-400 dark:text-slate-500 mt-2">{config ? "Review config above then save" : "Complete the chat to enable compilation"}</p>
              </div>
            </div>
          </>
        ) : (
          /* Discover Global MCP Tab */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700/70 bg-white dark:bg-slate-900 flex-shrink-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Official MCP Registry</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Search {">"}10,000 MCP servers from <span className="font-medium text-slate-600 dark:text-slate-400">registry.modelcontextprotocol.io</span></p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={e => setDiscoverQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleDiscover()}
                    placeholder="Search: github, uipath, slack, notion…"
                    className="form-input pl-9 py-2 rounded-xl w-full text-sm"
                  />
                </div>
                <button
                  onClick={() => handleDiscover()}
                  disabled={discoverLoading}
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {discoverLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {discoverError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-4 flex gap-2 text-sm text-red-700 mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{discoverError}
                </div>
              )}

              {!discoverSearched && !discoverLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-slate-500">
                  <Globe className="w-10 h-10 mb-3 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Search the Global MCP Registry</p>
                  <p className="text-xs">Find any MCP server from the official Anthropic registry by keyword</p>
                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {["github", "notion", "slack", "database", "email", "calendar", "uipath", "automation"].map(kw => (
                      <button key={kw} onClick={() => { setDiscoverQuery(kw); handleDiscover(kw); }} className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full hover:border-cyan-300 hover:text-cyan-600 transition-all">{kw}</button>
                    ))}
                  </div>
                </div>
              )}

              {discoverLoading && (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                  <span className="ml-2 text-sm text-slate-400 dark:text-slate-500">Searching registry…</span>
                </div>
              )}

              {!discoverLoading && discoverResults.length === 0 && discoverSearched && (
                <div className="text-center text-slate-400 dark:text-slate-500 text-sm pt-10">No results found for "{discoverQuery}"</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl mx-auto">
                {discoverResults.map((server, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:border-slate-300 hover:shadow-md transition-all flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{server.name.split("/").pop()}</span>
                          {server.official && <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0">official</span>}
                          {server.version && <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono flex-shrink-0">v{server.version}</span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{server.description || "No description available."}</p>
                      </div>
                    </div>

                    {server.remotes.length > 0 && (
                      <div className="space-y-1">
                        {server.remotes.slice(0, 2).map((r, ri) => (
                          <div key={ri} className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1 truncate">
                            <span className="text-cyan-500 font-semibold">{r.type}</span> · {r.url}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mt-auto">
                      {server.repository && (
                        <a href={server.repository} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                          <ExternalLink className="w-3 h-3" /> GitHub
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setActiveTab("architect");
                          setInput(`Create an agent that uses the "${server.name.split("/").pop()}" MCP server. ${server.description}`);
                        }}
                        className="ml-auto flex items-center gap-1.5 text-xs text-cyan-600 hover:text-cyan-800 font-medium transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Use this server
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showShareModal && savedAgentId && config && (
        <ShareModal
          agentId={savedAgentId}
          resourceName={config.agent_name}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
