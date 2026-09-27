"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MessageSquare, AlertTriangle } from "lucide-react";

interface SharedThreadMessage {
  role: string;
  content: string;
  timestamp?: string;
}

interface SharedThread {
  agent_log_id: string;
  agent_id: string;
  date: string;
  chat_history: Array<{ messages?: SharedThreadMessage[] }>;
}

export default function SharedThreadPage() {
  const { hash } = useParams<{ hash: string }>();
  const [thread, setThread] = useState<SharedThread | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/agent-invoke/shared-thread/${hash}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error?.message ?? "This shared link is invalid or no longer public.");
        }
        return res.json();
      })
      .then(setThread)
      .catch((e) => setError(e.message));
  }, [hash]);

  const messages = thread?.chat_history?.[0]?.messages ?? [];

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl p-8 max-h-[85vh] overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        ) : !thread ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="w-5 h-5 text-slate-400" />
              <h1 className="font-semibold text-slate-900 text-lg">Shared conversation</h1>
              <span className="text-[10px] font-mono text-slate-400">read-only</span>
            </div>
            <div className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No messages in this thread.</p>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user" ? "bg-slate-50 text-slate-700" : "bg-violet-50 text-slate-700"
                    }`}
                  >
                    <p className="text-[9px] font-mono text-slate-400 mb-1 uppercase">{m.role}</p>
                    {m.content}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
