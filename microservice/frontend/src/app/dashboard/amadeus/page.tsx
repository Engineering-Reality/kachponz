"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import {
  ArrowLeft, RefreshCw, Activity, CheckCircle, AlertTriangle,
  Layers, Clock, Shield, ChevronRight, Hash, ArrowRightLeft,
  TrendingUp, Zap, Rocket, BookOpen
} from "lucide-react";

const STEP_FLOW = [
  { key: "submitted", label: "Submitted", actor: "contact_point", financial: false },
  { key: "distributed_to_analyst", label: "Distributed", actor: "rpa_distributor", financial: false },
  { key: "doc_examined", label: "Doc Examined", actor: "analyst_or_agent", financial: false },
  { key: "ee_ntf_created", label: "EE/NTF Created", actor: "maker_agent", financial: false },
  { key: "ee_ntf_approved", label: "EE/NTF Approved", actor: "checker_human", financial: false },
  { key: "mt_converted", label: "MT Converted", actor: "rpa_mt_converter", financial: true },
  { key: "swift_released", label: "SWIFT Released", actor: "saa_gateway", financial: true },
  { key: "settled", label: "Settled", actor: "settlement_engine", financial: true },
  { key: "advised", label: "Advised", actor: "kopra_notify", financial: false },
];

interface Transaction {
  id: string;
  type: string;
  current_step: string;
  status: string;
  version: number;
  updated_at: string;
  company_id: string;
}

function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <GlassCard className="flex flex-col gap-1">
      <div className={`text-xs font-mono ${color} font-bold`}>{label}</div>
      <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 font-mono">{sub}</div>}
    </GlassCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded ${cfg[status] ?? "bg-slate-50 text-slate-500 border-slate-200"}`}>
      {status}
    </span>
  );
}

function StepBar({ currentStep, status }: { currentStep: string; status: string }) {
  const currentIdx = STEP_FLOW.findIndex(s => s.key === currentStep);
  return (
    <div className="flex items-center gap-px">
      {STEP_FLOW.map((s, i) => (
        <div
          key={s.key}
          title={`${s.label} (${s.actor})`}
          className={`h-1 rounded-sm flex-1 transition-all ${ status === "completed" || i < currentIdx ? "bg-emerald-400" : i === currentIdx && status !== "completed" ? "bg-blue-500 animate-pulse" : "bg-slate-200" }`}
        />
      ))}
    </div>
  );
}

export default function AmadeusDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY ?? "amadeus_local_dev";
  const headers = { "X-Robot-Key": robotKey, "Content-Type": "application/json" };

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/transactions?limit=50`, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json() as { items?: Transaction[] };
      setTransactions(data.items ?? []);
      setLastSynced(new Date());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Initial load + 5-second polling
  useEffect(() => {
    fetchTransactions();
    const id = setInterval(fetchTransactions, 5000);
    return () => clearInterval(id);
  }, [fetchTransactions]);

  const active = transactions.filter(t => t.status === "in_progress");
  const completed = transactions.filter(t => t.status === "completed");
  const failed = transactions.filter(t => t.status === "failed");

  // Transactions grouped by step for state machine view
  const byStep = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const arr = byStep.get(tx.current_step) ?? [];
    arr.push(tx);
    byStep.set(tx.current_step, arr);
  }

  // Step filter
  const displayed = selectedStep
    ? transactions.filter(t => t.current_step === selectedStep)
    : transactions;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 p-6 lg:p-10">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-xs font-mono mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Orchestrator Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tighter vibrant-rainbow-text">
                Amadeus Live Monitor
              </h1>
              <span className="text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded">
                amadeus.a2a/0 · polling 5s
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastSynced && (
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {lastSynced.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchTransactions}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link
              href="/playground"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" /> Invoke Agent
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total"
            value={transactions.length}
            sub="all time"
            color="text-slate-700"
          />
          <KpiCard
            label="Active"
            value={active.length}
            sub="in progress"
            color="text-blue-600"
          />
          <KpiCard
            label="Completed"
            value={completed.length}
            sub="settled"
            color="text-emerald-600"
          />
          <KpiCard
            label="Failed"
            value={failed.length}
            sub={failed.length > 0 ? "needs attention" : "all clear"}
            color={failed.length > 0 ? "text-red-600" : "text-slate-400"}
          />
        </div>

        {/* E2E Settlement Demo */}
        <GlassCard className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <Rocket className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">E2E Settlement Demo</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Run a full Import LC settlement from submitted to advised — 9 steps, cost-aware routing across LLM/PAD/UiPath.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href="/playground?agent=orchestrator"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5" /> Run via Agent
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" /> Setup Guide
            </Link>
          </div>
        </GlassCard>

        {/* State Machine Pipeline */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5" /> State Machine · Import LC / SKBDN / SBLC
            </h2>
            {selectedStep && (
              <button onClick={() => setSelectedStep(null)} className="text-[10px] font-mono text-blue-500 hover:text-blue-700">
                ✕ clear filter
              </button>
            )}
          </div>
          <div className="p-4 overflow-x-auto">
            <div className="flex items-stretch gap-1 min-w-max">
              {STEP_FLOW.map((step, idx) => {
                const count = byStep.get(step.key)?.length ?? 0;
                const isSelected = selectedStep === step.key;
                return (
                  <div key={step.key} className="flex items-center">
                    <button
                      onClick={() => setSelectedStep(isSelected ? null : step.key)}
                      className={`flex flex-col items-center px-3 py-2.5 rounded-lg border transition-all text-center min-w-[88px] ${ isSelected ? "border-blue-400 bg-blue-50" : count > 0 ? "border-slate-300 bg-slate-50 hover:border-slate-400" : "border-slate-100 hover:border-slate-200" }`}
                    >
                      <div className={`text-[9px] font-mono mb-1 ${step.financial ? "text-amber-600" : "text-slate-400"}`}>
                        {step.financial ? "💰" : `${idx + 1}`}
                      </div>
                      <div className={`text-[10px] font-bold leading-tight mb-1.5 ${count > 0 ? "text-slate-800" : "text-slate-400"}`}>
                        {step.label}
                      </div>
                      <div className={`text-lg font-black tabular-nums ${count > 0 ? "text-blue-600" : "text-slate-300"}`}>
                        {count}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5 font-mono">{step.actor}</div>
                    </button>
                    {idx < STEP_FLOW.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-0.5 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Transaction Ledger
              {selectedStep && <span className="font-normal text-blue-500">· filtered: {selectedStep}</span>}
            </h2>
            <span className="text-[10px] font-mono text-slate-400">{displayed.length} records</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="m-4 p-3 text-xs bg-red-50 border border-red-200 rounded-lg text-red-700">
              <div className="flex items-center gap-1.5 font-bold"><AlertTriangle className="w-3.5 h-3.5" /> {error}</div>
              <p className="text-red-400 mt-1">Ensure transaction_tracker is running at {apiUrl}</p>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 text-xs">
              <TrendingUp className="w-5 h-5 mb-1 opacity-30" />
              No transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                    <th className="py-2.5 px-5 font-medium">ID</th>
                    <th className="py-2.5 px-4 font-medium">Type</th>
                    <th className="py-2.5 px-4 font-medium">Current Step</th>
                    <th className="py-2.5 px-4 font-medium w-36">Pipeline</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium">Ver</th>
                    <th className="py-2.5 px-5 font-medium text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((tx) => {
                    const step = STEP_FLOW.find(s => s.key === tx.current_step);
                    return (
                      <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-xs">
                        <td 
                          className="py-3 px-5 font-mono text-slate-700 flex items-center gap-1.5 cursor-pointer hover:text-blue-600"
                          title={`Click to copy full UUID: ${tx.id}`}
                          onClick={() => {
                            navigator.clipboard.writeText(tx.id);
                            alert(`Copied full UUID: ${tx.id}`);
                          }}
                        >
                          <Hash className="w-3 h-3 text-slate-300" />
                          {tx.id.substring(0, 12)}...
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[10px] font-bold">
                          {tx.type?.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-slate-600">{tx.current_step}</span>
                            {step?.financial && (
                              <span title="Financial step">
                                <Shield className="w-3 h-3 text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StepBar currentStep={tx.current_step} status={tx.status} />
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={tx.status} />
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-slate-400">v{tx.version}</td>
                        <td className="py-3 px-5 font-mono text-[10px] text-slate-400 text-right whitespace-nowrap">
                          {tx.updated_at
                            ? new Date(tx.updated_at).toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-[10px] font-mono text-slate-400 text-center pb-4">
          amadeus-orchestrator-mcp · SSE transport · registered via Tools page · port auto-allocated
        </p>
      </div>
    </div>
  );
}
