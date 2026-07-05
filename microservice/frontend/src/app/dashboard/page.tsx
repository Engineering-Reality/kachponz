"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { RainbowRibbonLoader } from "@/components/RainbowRibbonLoader";
import { TransactionGraph } from "@/components/TransactionGraph";
import { Activity, Server, Database, ArrowLeft, RefreshCw, Play, CheckCircle } from "lucide-react";

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const res = await fetch(`${apiUrl}/transactions?limit=50`, {
        headers: {
          "x-robot-key": robotKey,
          "Content-Type": "application/json"
        }
      });
      
      if (!res.ok) {
        throw new Error(`Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      setTransactions(data.items || []);
    } catch (err: any) {
      setError(err.message || "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  const createTestTransaction = async () => {
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const res = await fetch(`${apiUrl}/transactions`, {
        method: "POST",
        headers: {
          "x-robot-key": robotKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "import_lc",
          idempotencyKey: `test-fe-${Date.now()}`,
          payload: { bank: "Mandiri", amount: 10000 }
        })
      });
      
      if (!res.ok) throw new Error("Failed to create transaction");
      fetchTransactions();
    } catch (err: any) {
      setError(err.message || "Failed to create test transaction.");
    }
  };

  const completeStep = async (id: string, step: string) => {
    try {
      const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY || "amadeus_local_dev";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      
      const res = await fetch(`${apiUrl}/transactions/${id}/steps/${step}/complete`, {
        method: "POST",
        headers: {
          "x-robot-key": robotKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idempotencyKey: `step-fe-${Date.now()}`,
          reason: "Completed via FE Test",
          payload: { status: "success" }
        })
      });
      
      if (!res.ok) throw new Error("Failed to complete step");
      fetchTransactions();
    } catch (err: any) {
      setError(err.message || "Failed to complete step.");
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="min-h-screen p-8 lg:p-24 relative overflow-hidden">
      {/* Subtle background static wave or gradient can go here */}
      <div className="absolute top-0 left-0 w-full h-[500px] opacity-20 bg-gradient-to-b from-blue-50 to-transparent pointer-events-none z-0"></div>
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-12">
          <div>
            <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 uppercase tracking-wider text-sm font-mono transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Return to Core
            </Link>
            <h1 className="text-4xl md:text-5xl font-extrabold uppercase tracking-tighter vibrant-rainbow-text">
              Orchestrator Dashboard
            </h1>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={createTestTransaction}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 transition-all bg-white font-mono uppercase text-sm"
            >
              <Play className="w-4 h-4" /> Inject Mock Tx
            </button>
            <button 
              onClick={fetchTransactions}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:border-slate-500 text-slate-600 hover:text-slate-900 transition-all bg-white font-mono uppercase text-sm"
            >
              <RefreshCw className="w-4 h-4" /> Sync State
            </button>
          </div>
        </header>

        {/* Agent Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono uppercase tracking-widest text-sm text-slate-500">UiPath Dispatcher</h3>
              <Server className="w-5 h-5 text-slate-900" />
            </div>
            <div className="text-3xl font-bold text-slate-900">ONLINE</div>
            <div className="text-xs text-slate-400 mt-2 font-mono">ID: a2b4-9f81</div>
          </GlassCard>
          
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono uppercase tracking-widest text-sm text-slate-500">PAD Dispatcher</h3>
              <Activity className="w-5 h-5 text-slate-900" />
            </div>
            <div className="text-3xl font-bold text-slate-400">STANDBY</div>
            <div className="text-xs text-slate-400 mt-2 font-mono">ID: c7x9-3m20</div>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono uppercase tracking-widest text-sm text-slate-500">PostgreSQL DB</h3>
              <Database className="w-5 h-5 text-slate-900" />
            </div>
            <div className="text-3xl font-bold text-slate-900">CONNECTED</div>
            <div className="text-xs text-slate-400 mt-2 font-mono">Latency: 12ms</div>
          </GlassCard>
        </div>

        {/* Main Content Area: Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
          
          {/* Transactions Table */}
          <div className="border border-slate-200 bg-white overflow-hidden flex flex-col h-full rounded-xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="font-mono uppercase tracking-widest text-sm font-bold text-slate-900">Transaction Ledger</h2>
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
                <p className="text-slate-500 mt-2 text-xs">Verify your backend is running and NEXT_PUBLIC_API_URL / NEXT_PUBLIC_ROBOT_KEY are set in .env.local</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-mono uppercase">
                No active transactions found in the ledger.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-mono text-xs uppercase tracking-widest">
                      <th className="pb-3 pr-4 font-normal">Identifier</th>
                      <th className="pb-3 px-4 font-normal">Schema</th>
                      <th className="pb-3 px-4 font-normal">State Vector</th>
                      <th className="pb-3 px-4 font-normal">Status</th>
                      <th className="pb-3 pl-4 font-normal text-right">Timestamp</th>
                      <th className="pb-3 px-4 font-normal text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedTx(tx)}
                        className={`border-b border-slate-100 transition-colors cursor-pointer group ${
                          selectedTx?.id === tx.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-4 pr-4 font-mono text-sm text-slate-900">{tx.id.split('-')[0]}</td>
                        <td className="py-4 px-4 uppercase text-sm tracking-wider text-slate-700">{tx.type.replace('_', ' ')}</td>
                        <td className="py-4 px-4 font-mono text-sm text-slate-600">{tx.current_step}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2 py-1 text-xs font-mono uppercase border rounded-md ${
                            tx.status === 'completed' ? 'border-green-500 text-green-700 bg-green-50' :
                            tx.status === 'failed' ? 'border-red-300 text-red-600 bg-red-50' :
                            'border-blue-300 text-blue-600 bg-blue-50'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-4 pl-4 font-mono text-xs text-slate-400 text-right">
                          {new Date(tx.updated_at).toISOString().split('T')[0]} {new Date(tx.updated_at).toISOString().split('T')[1].substring(0,8)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {tx.status === 'active' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); completeStep(tx.id, tx.current_step); }}
                              className="inline-flex items-center gap-1 text-xs font-mono uppercase text-blue-500 hover:text-blue-700 transition-colors"
                            >
                              <CheckCircle className="w-3 h-3" /> Execute Step
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
          
          {/* Right Side: Graph Visualizer */}
          <div className="h-full border border-slate-200 bg-white flex flex-col overflow-hidden relative rounded-xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <h2 className="font-mono uppercase tracking-widest text-sm font-bold text-slate-900">
                Agent Orchestration Graph {selectedTx && `(ID: ${selectedTx.id.split('-')[0]})`}
              </h2>
            </div>
            <div className="flex-1 w-full relative">
              <TransactionGraph currentStep={selectedTx?.current_step || null} />
            </div>
            
            {/* Absolute overlay when no tx is selected to guide the user */}
            {!selectedTx && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                <div className="border border-slate-200 bg-slate-50 p-6 max-w-sm text-center rounded-xl shadow-lg">
                  <Activity className="w-8 h-8 text-slate-900 mx-auto mb-4" />
                  <h3 className="font-mono font-bold uppercase mb-2 text-slate-900">No Target Selected</h3>
                  <p className="text-xs font-mono text-slate-500">Select a transaction from the ledger to visualize the Agent-to-Agent handoff flow.</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
