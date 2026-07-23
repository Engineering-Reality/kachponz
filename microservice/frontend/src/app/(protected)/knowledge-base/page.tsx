"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Database, Plus, Search, FileText, Trash2, 
  Settings, Loader2, ArrowRight, BookOpen, FileUp, UploadCloud 
} from "lucide-react";

export default function KnowledgeBasePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingKbId, setUploadingKbId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetKbId, setTargetKbId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [kbRes, agentRes] = await Promise.all([
          fetch("/api/knowledge-bases"),
          fetch("/api/agents")
        ]);
        if (kbRes.ok && agentRes.ok) {
          setKnowledgeBases(await kbRes.json());
          setAgents(await agentRes.json());
        }
      } catch (e) {
        console.error("Failed to load knowledge bases", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleUploadClick = (kbId: string) => {
    setTargetKbId(kbId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // reset
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetKbId) return;

    setUploadingKbId(targetKbId);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`/api/knowledge-bases/${targetKbId}/documents`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload file");
      }
      
      // File uploaded successfully, we could show a toast here.
      alert(`Berhasil mengunggah dokumen: ${file.name}`);
      
    } catch (err: any) {
      console.error(err);
      alert(`Gagal mengunggah dokumen: ${err.message}`);
    } finally {
      setUploadingKbId(null);
      setTargetKbId(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="page-header border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="ui-label text-slate-400 dark:text-slate-500 mb-2">Vector Storage</p>
            <h1 className="section-head text-3xl text-slate-900 dark:text-white mb-1">Knowledge Bases</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage semantic context and document collections for your AI agents.
            </p>
          </div>
          <button className="btn-primary group">
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Create Knowledge Base
          </button>
        </div>
      </div>
      
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.xlsx,.xls,.docx,.doc" 
      />

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : knowledgeBases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {knowledgeBases.map((kb) => {
            const linkedAgents = agents.filter(a => a.knowledge_base_ids?.includes(kb.kb_id));
            
            return (
              <div key={kb.kb_id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-snug">{kb.name}</h3>
                      {kb.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{kb.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      title="Upload Document"
                      onClick={() => handleUploadClick(kb.kb_id)}
                      disabled={uploadingKbId === kb.kb_id}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 disabled:opacity-50"
                    >
                      {uploadingKbId === kb.kb_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Linked Agents Section */}
                <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Linked Agents</h4>
                  {linkedAgents.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {linkedAgents.map(agent => (
                        <span key={agent.agent_id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {agent.agent_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">No agents are currently using this knowledge base.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6">
            <Database className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Knowledge Bases Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8">
            Create a vector database to upload documents, PDFs, and text data. Your autonomous agents can use this context to provide more accurate and grounded responses.
          </p>
          <div className="flex gap-4">
            <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 border-emerald-500">
              <Plus className="w-4 h-4 mr-2" /> Initialize Vector Store
            </button>
            <button className="btn-secondary dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
              <BookOpen className="w-4 h-4 mr-2" /> Read Documentation
            </button>
          </div>
        </div>
      )}

      {/* Feature Explainer (Only shown when empty for better onboarding) */}
      {knowledgeBases.length === 0 && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <FileUp className="w-6 h-6 text-indigo-500 mb-4" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Document Ingestion</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload PDFs, CSVs, and text files. The system will automatically chunk and embed the contents using state-of-the-art embedding models.
            </p>
          </div>
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Search className="w-6 h-6 text-amber-500 mb-4" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Semantic Search</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Retrieve relevant context instantaneously based on meaning rather than just keyword matching, empowering agents with deep knowledge.
            </p>
          </div>
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Settings className="w-6 h-6 text-rose-500 mb-4" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Granular Control</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Manage sync schedules, adjust chunking strategies, and link specific knowledge bases only to the agents that need them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
