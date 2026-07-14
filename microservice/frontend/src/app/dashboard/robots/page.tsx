"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { ArrowLeft, RefreshCw, ChevronRight, ExternalLink, Clock, Loader2 } from "lucide-react";

interface JobTraceRow {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  tool_id: string | null;
  session_label: string | null;
  job_id: string;
  job_key: string | null;
  release_key: string | null;
  process_name: string | null;
  folder_id: string | null;
  queue_name: string | null;
  state: "Pending" | "Running" | "Successful" | "Faulted" | "Stopped";
  triggered_at: string;
  last_polled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  info: string | null;
}

interface QueueItem {
  id: number;
  status: string;
  reference: string | null;
  createdAt: string | null;
}

const STATE_STYLES: Record<string, { badge: string; dot: string }> = {
  Pending: { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  Running: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500 animate-pulse" },
  Successful: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Faulted: { badge: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
  Stopped: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

function StateBadge({ state }: { state: string }) {
  const cfg = STATE_STYLES[state] ?? STATE_STYLES.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium border rounded ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {state}
    </span>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <GlassCard className="flex flex-col gap-1">
      <div className={`text-xs font-mono ${color} font-bold`}>{label}</div>
      <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
    </GlassCard>
  );
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function orchestratorUrl(row: JobTraceRow): string | null {
  if (!row.folder_id) return null;
  return `https://cloud.uipath.com/orchestrator_/jobs?folderId=${row.folder_id}`;
}

export default function RobotsDashboard() {
  const [jobs, setJobs] = useState<JobTraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<Record<string, QueueItem[] | "loading" | "error">>({});

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY ?? "amadeus_local_dev";
  const headers = { "X-Robot-Key": robotKey, "Content-Type": "application/json" };

  const fetchJobs = useCallback(async () => {
    try {
      const qs = stateFilter !== "all" ? `&state=${stateFilter}` : "";
      const res = await fetch(`${apiUrl}/orchestrator/uipath-jobs?limit=100${qs}`, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setJobs(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, robotKey, stateFilter]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 7000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const toggleExpand = async (row: JobTraceRow) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (!row.queue_name || !row.tool_id) return;
    if (queueItems[row.id]) return;
    setQueueItems((prev) => ({ ...prev, [row.id]: "loading" }));
    try {
      const qs = new URLSearchParams({ queueName: row.queue_name });
      if (row.folder_id) qs.set("folderId", row.folder_id);
      const res = await fetch(`${apiUrl}/orchestrator/tools/${row.tool_id}/uipath-queue-transactions?${qs}`, { headers });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setQueueItems((prev) => ({ ...prev, [row.id]: data.items ?? [] }));
    } catch {
      setQueueItems((prev) => ({ ...prev, [row.id]: "error" }));
    }
  };

  const counts = {
    Pending: jobs.filter((j) => j.state === "Pending").length,
    Running: jobs.filter((j) => j.state === "Running").length,
    Successful: jobs.filter((j) => j.state === "Successful").length,
    Faulted: jobs.filter((j) => j.state === "Faulted").length,
    Stopped: jobs.filter((j) => j.state === "Stopped").length,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="page-header border-b border-slate-100 pb-6 mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="section-head text-3xl text-slate-900 mb-1">Robot Trace</h1>
          <p className="text-sm text-slate-500">
            UiPath job &amp; queue activity triggered through agent chats — no Orchestrator link-pasting required.
          </p>
        </div>
        <button onClick={fetchJobs} className="btn-secondary text-xs py-2.5 px-4 rounded-xl shadow-sm bg-white hover:bg-slate-50 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-6">
        <KpiCard label="Pending" value={counts.Pending} color="text-slate-500" />
        <KpiCard label="Running" value={counts.Running} color="text-blue-600" />
        <KpiCard label="Successful" value={counts.Successful} color="text-emerald-600" />
        <KpiCard label="Faulted" value={counts.Faulted} color="text-red-600" />
        <KpiCard label="Stopped" value={counts.Stopped} color="text-amber-600" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        {["all", "Pending", "Running", "Successful", "Faulted", "Stopped"].map((s) => (
          <button
            key={s}
            onClick={() => setStateFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${ stateFilter === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50" }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 text-xs bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No robot jobs traced yet. Trigger a UiPath job through an agent chat to see it appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.map((row) => (
              <div key={row.id}>
                <button
                  onClick={() => toggleExpand(row)}
                  className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <ChevronRight className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${expandedId === row.id ? "rotate-90" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {row.process_name || `Job ${row.job_id}`}
                      </span>
                      {row.queue_name && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{row.queue_name}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      job:{row.job_id} · agent:{row.agent_name ?? "—"} {row.session_label ? `· session:${row.session_label}` : ""}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> {formatDuration(row.started_at ?? row.triggered_at, row.ended_at)}
                  </div>
                  <StateBadge state={row.state} />
                  {orchestratorUrl(row) && (
                    <a
                      href={orchestratorUrl(row)!}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-1 shrink-0"
                    >
                      Orchestrator <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </button>

                {expandedId === row.id && (
                  <div className="px-5 pb-4 pl-12 bg-slate-50/50">
                    {row.info && (
                      <div className="text-xs text-slate-500 mb-2 font-mono">{row.info}</div>
                    )}
                    {!row.queue_name ? (
                      <div className="text-xs text-slate-400">No queue associated with this job.</div>
                    ) : queueItems[row.id] === "loading" ? (
                      <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading queue items…</div>
                    ) : queueItems[row.id] === "error" ? (
                      <div className="text-xs text-red-500">Failed to load queue transactions.</div>
                    ) : Array.isArray(queueItems[row.id]) && (queueItems[row.id] as QueueItem[]).length > 0 ? (
                      <div className="space-y-1">
                        {(queueItems[row.id] as QueueItem[]).map((item) => (
                          <div key={item.id} className="flex items-center gap-3 text-xs font-mono text-slate-600">
                            <span className="text-slate-400">#{item.id}</span>
                            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px]">{item.status}</span>
                            {item.reference && <span className="text-slate-400 truncate">{item.reference}</span>}
                            <span className="text-slate-300">{item.createdAt}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">No transaction items found in this queue.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
