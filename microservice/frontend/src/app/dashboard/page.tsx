"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { TransactionGraph } from "@/components/TransactionGraph";
import {
  ArrowLeft, RefreshCw, Play, CheckCircle, ChevronRight,
  Activity, Server, Database, Clock, Shield, Zap,
  ArrowRightLeft, Layers, Hash, AlertTriangle, ExternalLink, Rocket
} from "lucide-react";

const STEP_FLOW_DISPLAY = [
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

function StatusDot({ status }: { status: string }) {
  const color = status === "completed" ? "bg-emerald-500" : status === "failed" ? "bg-red-500" : "bg-blue-500";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function StepPipeline({ currentStep, status }: { currentStep: string; status: string }) {
  const currentIdx = STEP_FLOW_DISPLAY.findIndex(s => s.key === currentStep);
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1">
      {STEP_FLOW_DISPLAY.map((step, idx) => {
        const isCompleted = status === "completed" || idx < currentIdx;
        const isCurrent = idx === currentIdx && status !== "completed";
        const isFuture = idx > currentIdx && status !== "completed";
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`h-1.5 rounded-full transition-all ${
                isCompleted ? "w-5 bg-emerald-400" :
                isCurrent ? "w-5 bg-blue-500 animate-pulse" :
                "w-5 bg-slate-200"
              }`}
              title={`${step.label} (${step.actor})${step.financial ? " 💰" : ""}`}
            />
            {idx < STEP_FLOW_DISPLAY.length - 1 && (
              <div className={`w-0.5 h-0.5 rounded-full mx-px ${isCompleted ? "bg-emerald-300" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [txEvents, setTxEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"events" | "a2a" | "graph">("events");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
  const headers = { "x-robot-key": robotKey, "Content-Type": "application/json" };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/transactions?limit=50`, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setTransactions(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  const fetchEvents = useCallback(async (txId: string) => {
    try {
      const res = await fetch(`${apiUrl}/transactions/${txId}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setTxEvents(data.events || []);
    } catch (e) {
      setTxEvents([]);
    }
  }, [apiUrl]);

  const selectTx = (tx: any) => {
    setSelectedTx(tx);
    fetchEvents(tx.id);
  };

  const createTestTransaction = async () => {
    try {
      const res = await fetch(`${apiUrl}/transactions`, {
        method: "POST", headers,
        body: JSON.stringify({ type: "import_lc", idempotencyKey: `test-fe-${Date.now()}`, payload: { bank: "Mandiri", amount: 10000 } })
      });
      if (!res.ok) throw new Error("Failed to create transaction");
      fetchTransactions();
    } catch (err: any) { setError(err.message); }
  };

  const completeStep = async (id: string, step: string) => {
    try {
      const res = await fetch(`${apiUrl}/transactions/${id}/steps/${step}/complete`, {
        method: "POST", headers,
        body: JSON.stringify({ idempotencyKey: `step-fe-${Date.now()}`, reason: "Completed via FE", payload: { status: "success" } })
      });
      if (!res.ok) throw new Error("Failed to complete step");
      fetchTransactions();
      if (selectedTx?.id === id) fetchEvents(id);
    } catch (err: any) { setError(err.message); }
  };

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const activeCount = transactions.filter(t => t.status === "in_progress").length;
  const completedCount = transactions.filter(t => t.status === "completed").length;
  const failedCount = transactions.filter(t => t.status === "failed").length;

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA] text-slate-900 overflow-hidden">
      {/* Compact Header */}
      <header className="h-11 bg-white border-b border-slate-100 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Transaction Ledger</h2>
          <span className="badge badge-slate">{transactions.length} records</span>
        </div>
        <div className="flex items-center gap-2">
          {failedCount > 0 && (
            <span className="badge badge-red">
              <AlertTriangle className="w-2.5 h-2.5" /> {failedCount} Failed
            </span>
          )}
          <span className="badge badge-blue">{activeCount} Active</span>
          <span className="badge badge-green">{completedCount} Completed</span>
          <Link href="/dashboard/amadeus" className="btn-primary text-[11px] py-1.5 px-3">
            <Rocket className="w-3 h-3" /> E2E Demo
          </Link>
          <button onClick={createTestTransaction} className="btn-primary text-[11px] py-1.5 px-3">
            <Play className="w-3 h-3" /> Inject Tx
          </button>
          <button onClick={fetchTransactions} className="btn-secondary text-[11px] py-1.5 px-3">
            <RefreshCw className="w-3 h-3" /> Sync
          </button>
        </div>
      </header>

      {/* Main Split Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Transaction Table */}
        <div className="w-[55%] border-r border-slate-200 flex flex-col bg-white">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="ui-label text-slate-500">Transaction Ledger</h2>
            <span className="text-[10px] font-mono text-slate-400">{transactions.length} records</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : error ? (
              <div className="m-4 p-3 text-xs bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p className="font-medium">{error}</p>
                <p className="text-red-400 mt-1">Verify backend is running at {apiUrl}</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs">
                <Layers className="w-6 h-6 mb-2 opacity-40" />
                No transactions. Click "Inject Tx" to create one.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-[1]">
                  <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-2 px-4 font-medium">ID</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                    <th className="py-2 px-3 font-medium">Step</th>
                    <th className="py-2 px-3 font-medium">Pipeline</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium text-right">Updated</th>
                    <th className="py-2 px-3 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isSelected = selectedTx?.id === tx.id;
                    const borderColor =
                      tx.status === "completed" ? "border-l-emerald-400" :
                      tx.status === "failed" ? "border-l-red-400" :
                      tx.status === "in_progress" ? "border-l-blue-500" :
                      "border-l-slate-300";
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => selectTx(tx)}
                        className={`border-b border-slate-50 border-l-[3px] ${borderColor} cursor-pointer text-xs transition-colors ${
                          isSelected ? "bg-blue-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono text-slate-700 font-medium">
                          <div className="flex items-center gap-1.5">
                            <StatusDot status={tx.status} />
                            {tx.id.substring(0, 8)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 uppercase text-[10px] tracking-wider font-medium">{tx.type?.replace('_', ' ')}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] text-slate-700 bg-[#f8fafc] px-1.5 py-0.5 rounded">{tx.current_step}</span>
                        </td>
                        <td className="py-2.5 px-3"><StepPipeline currentStep={tx.current_step} status={tx.status} /></td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            tx.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                            tx.status === "failed" ? "bg-red-50 text-red-600" :
                            "bg-blue-50 text-blue-600"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 text-right whitespace-nowrap">
                          {tx.updated_at ? new Date(tx.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          {tx.status === "in_progress" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); completeStep(tx.id, tx.current_step); }}
                              title="Complete current step"
                              className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 flex flex-col bg-[#FAFAFA]">
          {!selectedTx ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
              <ArrowRightLeft className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-xs font-medium text-slate-400">Select a transaction to inspect A2A protocol flow</p>
            </div>
          ) : (
            <>
              {/* Selected TX Header */}
              <div className="px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-sm font-bold text-slate-900">{selectedTx.id.substring(0, 12)}...</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      selectedTx.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                      selectedTx.status === "failed" ? "bg-red-50 text-red-600" :
                      "bg-blue-50 text-blue-600"
                    }`}>{selectedTx.status}</span>
                  </div>
                  {selectedTx.status === "in_progress" && (
                    <button
                      onClick={() => completeStep(selectedTx.id, selectedTx.current_step)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Zap className="w-3 h-3" /> Advance Step
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {selectedTx.type}</span>
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {selectedTx.current_step}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> v{selectedTx.version}</span>
                  {STEP_FLOW_DISPLAY.find(s => s.key === selectedTx.current_step)?.financial && (
                    <span className="flex items-center gap-1 text-amber-600"><Shield className="w-3 h-3" /> Financial Step</span>
                  )}
                </div>
              </div>

              {/* Tab Bar */}
              <div className="flex border-b border-slate-200 bg-white px-4 flex-shrink-0">
                {(["events", "a2a", "graph"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wider border-b-2 transition-colors ${
                      tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {t === "events" ? "Event Log" : t === "a2a" ? "A2A Protocol" : "Flow Graph"}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {tab === "events" && (
                  <div className="p-4">
                    {txEvents.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-8">No events recorded yet.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {txEvents.map((evt: any, idx: number) => (
                          <div key={evt.id || idx} className="flex items-start gap-3 bg-white border border-slate-100 rounded-lg p-3 text-xs">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              evt.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                              evt.status === "failed" ? "bg-red-100 text-red-600" :
                              "bg-blue-100 text-blue-600"
                            }`}>
                              <CheckCircle className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono font-bold text-slate-800">{evt.step}</span>
                                <span className={`px-1 py-0.5 text-[9px] rounded font-medium ${
                                  evt.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                                  evt.status === "failed" ? "bg-red-50 text-red-500" :
                                  "bg-slate-50 text-slate-500"
                                }`}>{evt.status}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                <span>actor: {evt.actor}</span>
                                {evt.reason && <span className="text-slate-500">reason: {evt.reason}</span>}
                                <span className="font-mono">{evt.idempotency_key?.substring(0, 16)}</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                              {evt.created_at ? new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "a2a" && (
                  <div className="p-4 space-y-3">
                    {/* A2A Protocol Reference */}
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">A2A Envelope Schema</span>
                        <span className="font-mono text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">amadeus.a2a/0</span>
                      </div>
                      <div className="p-3">
                        <pre className="text-[10px] font-mono text-slate-600 leading-relaxed overflow-x-auto">{JSON.stringify({
                          protocol: "amadeus.a2a/0",
                          type: "task.complete",
                          transactionId: selectedTx.id,
                          step: selectedTx.current_step,
                          idempotencyKey: `step-${Date.now()}`,
                          correlationId: `agentic:${selectedTx.current_step}`,
                          reason: "Step completed by agent",
                          data: {},
                          sentAt: new Date().toISOString()
                        }, null, 2)}</pre>
                      </div>
                    </div>

                    {/* A2A Flow Pipeline */}
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Step Flow · {selectedTx.type}</span>
                      </div>
                      <div className="p-3 space-y-1">
                        {STEP_FLOW_DISPLAY.map((step, idx) => {
                          const currentIdx = STEP_FLOW_DISPLAY.findIndex(s => s.key === selectedTx.current_step);
                          const isCompleted = selectedTx.status === "completed" || idx < currentIdx;
                          const isCurrent = idx === currentIdx && selectedTx.status !== "completed";
                          return (
                            <div key={step.key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                              isCurrent ? "bg-blue-50 border border-blue-200" : isCompleted ? "bg-emerald-50/50" : "bg-slate-50/50"
                            }`}>
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                                isCompleted ? "bg-emerald-500 text-white" :
                                isCurrent ? "bg-blue-500 text-white animate-pulse" :
                                "bg-slate-200 text-slate-400"
                              }`}>{idx + 1}</div>
                              <span className={`font-mono text-[10px] flex-1 ${isCurrent ? "text-blue-700 font-bold" : isCompleted ? "text-emerald-700" : "text-slate-400"}`}>
                                {step.label}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">{step.actor}</span>
                              {step.financial && <Shield className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                              {isCurrent && <ChevronRight className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* A2A Message Types */}
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Supported Message Types</span>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-1.5">
                        {[
                          { type: "task.assign", desc: "Assign step to agent", color: "bg-purple-50 text-purple-700 border-purple-200" },
                          { type: "task.complete", desc: "Complete & handoff", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                          { type: "task.failed", desc: "Report failure", color: "bg-red-50 text-red-700 border-red-200" },
                          { type: "task.status", desc: "Query state", color: "bg-blue-50 text-blue-700 border-blue-200" },
                        ].map(m => (
                          <div key={m.type} className={`px-2.5 py-2 rounded-md border text-[10px] ${m.color}`}>
                            <div className="font-mono font-bold">{m.type}</div>
                            <div className="opacity-70 mt-0.5">{m.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "graph" && (
                  <div className="h-full min-h-[400px] relative">
                    <TransactionGraph tx={selectedTx} events={txEvents} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
