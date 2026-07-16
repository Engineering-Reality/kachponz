"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, AlertTriangle } from "lucide-react";

interface SharedAgent {
  agent_id: string;
  agent_name: string;
  description: string | null;
  agent_style: string | null;
  on_status: boolean;
}

export default function SharedAgentPage() {
  const { hash } = useParams<{ hash: string }>();
  const [agent, setAgent] = useState<SharedAgent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agent-invoke/shared-agent/${hash}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error?.message ?? "This shared link is invalid or no longer public.");
        }
        return res.json();
      })
      .then(setAgent)
      .catch((e) => setError(e.message));
  }, [hash]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl p-8">
        {error ? (
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        ) : !agent ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 text-lg">{agent.agent_name}</h1>
                <span className="text-[10px] font-mono text-slate-400">Shared agent · read-only</span>
              </div>
            </div>
            {agent.description && (
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">{agent.description}</p>
            )}
            {agent.agent_style && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <p className="text-[9px] font-mono text-slate-400 mb-1">System Prompt / Personality</p>
                <p className="text-xs font-mono text-slate-500 leading-relaxed whitespace-pre-wrap">{agent.agent_style}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
