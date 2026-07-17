"use client";

import { useState, useEffect } from "react";
import { 
  Database, Plus, Search, FileText, Trash2, 
  Settings, Loader2, ArrowRight, BookOpen, FileUp 
} from "lucide-react";

export default function KnowledgeBasePage() {
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Simulate fetching
    const timer = setTimeout(() => {
      setKnowledgeBases([]);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

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

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : knowledgeBases.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {/* List items will go here in the future */}
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
