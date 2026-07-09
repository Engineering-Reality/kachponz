"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Layers, ListChecks, AlertTriangle } from "lucide-react";

interface QueueSummary {
  name: string;
  pendingCount: number | null;
}

interface ToolContext {
  toolId: string;
  toolName: string;
  processes: string[];
  queues: QueueSummary[];
  error?: string;
}

interface AgentContextPanelProps {
  agentId: string;
  apiUrl: string;
  robotKey: string;
}

/**
 * Proactive UiPath context — fetched the moment an agent is selected, not in
 * response to a chat message, so it never consumes a conversational turn.
 * Renders nothing if the agent has no UiPath-type tools attached.
 */
export function AgentContextPanel({ agentId, apiUrl, robotKey }: AgentContextPanelProps) {
  const [tools, setTools] = useState<ToolContext[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/orchestrator/agents/${agentId}/uipath-context`, {
        headers: { "x-robot-key": robotKey },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setTools(data.tools ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
      setTools(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, apiUrl, robotKey]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  if (!agentId) return null;
  if (!loading && !error && (!tools || tools.length === 0)) return null;

  return (
    <div>
      <label className="ui-label text-slate-500 mb-2 flex justify-between items-center">
        UiPath Context
        <button
          onClick={fetchContext}
          disabled={loading}
          title="Refresh"
          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </label>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-[13px]">
        {loading && !tools && <div className="text-slate-400">Loading…</div>}
        {error && (
          <div className="flex items-center gap-1.5 text-red-600 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}
        {tools?.map((t) => (
          <div key={t.toolId} className="space-y-2">
            <div className="text-slate-500 text-[11px] font-mono truncate">{t.toolName}</div>
            {t.error ? (
              <div className="text-amber-600 text-xs">{t.error}</div>
            ) : (
              <>
                <div className="flex items-start gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700">
                    Processes: {t.processes.length > 0
                      ? `${t.processes[0]}${t.processes.length > 1 ? ` (${t.processes.length - 1} more…)` : ""}`
                      : "none"}
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700">
                    {t.queues.length > 0
                      ? t.queues.map((q) => `${q.name}${q.pendingCount !== null ? ` (${q.pendingCount} pending)` : ""}`).join(", ")
                      : "no queues"}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
