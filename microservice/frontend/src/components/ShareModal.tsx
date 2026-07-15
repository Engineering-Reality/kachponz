"use client";

import { useState } from "react";
import { X, Link2, UserPlus, Eye, Copy, Check, Loader2 } from "lucide-react";

interface ShareModalProps {
  agentId: string;
  threadId?: string;
  resourceName: string;
  onClose: () => void;
}

type Tab = "editor" | "visitor" | "link";

function parseEmails(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0),
    ),
  );
}

/** Functional-minimum share modal (feature.md B.5) — three modes, no management dashboard. */
export function ShareModal({ agentId, threadId, resourceName, onClose }: ShareModalProps) {
  const [tab, setTab] = useState<Tab>("editor");
  const [editorInput, setEditorInput] = useState("");
  const [visitorInput, setVisitorInput] = useState("");
  const [publicHash, setPublicHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTab, setSavedTab] = useState<Tab | null>(null);
  const [copied, setCopied] = useState(false);

  const base = threadId
    ? `/api/feature-sharing/thread`
    : `/api/feature-sharing/agent`;
  const idSuffix = threadId ? `${agentId}/${threadId}` : agentId;

  async function submitEmails(kind: "editor" | "visitor") {
    const emails = parseEmails(kind === "editor" ? editorInput : visitorInput);
    if (emails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/share-${kind}-with/${idSuffix}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to share.");
      }
      setSavedTab(kind);
      if (kind === "editor") setEditorInput("");
      else setVisitorInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to share.");
    } finally {
      setLoading(false);
    }
  }

  async function generateLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/share-anyone-with-link/${idSuffix}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "Failed to generate link.");
      }
      setPublicHash(data.public_hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate link.");
    } finally {
      setLoading(false);
    }
  }

  const publicUrl = publicHash
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${threadId ? "thread" : "agent"}/${publicHash}`
    : null;

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg">Share {threadId ? "thread" : "agent"}</h2>
            <p className="text-xs text-slate-400 truncate max-w-[280px]">{resourceName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {[
            { key: "editor" as const, label: "Editor", icon: UserPlus },
            { key: "visitor" as const, label: "Visitor", icon: Eye },
            { key: "link" as const, label: "Public link", icon: Link2 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setError(null);
              }}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                tab === key ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          {tab === "editor" && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Share with editors (read-write access)
              </label>
              <input
                type="text"
                value={editorInput}
                onChange={(e) => setEditorInput(e.target.value)}
                placeholder="person@company.com, person2@company.com"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              {savedTab === "editor" && <p className="text-xs text-green-600">Shared successfully.</p>}
              <button
                onClick={() => submitEmails("editor")}
                disabled={loading}
                className="btn-primary text-sm rounded-xl mt-1 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Share as editor
              </button>
            </div>
          )}

          {tab === "visitor" && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-slate-700">
                Share with visitors (read-only access)
              </label>
              <input
                type="text"
                value={visitorInput}
                onChange={(e) => setVisitorInput(e.target.value)}
                placeholder="person@company.com, person2@company.com"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              {savedTab === "visitor" && <p className="text-xs text-green-600">Shared successfully.</p>}
              <button
                onClick={() => submitEmails("visitor")}
                disabled={loading}
                className="btn-primary text-sm rounded-xl mt-1 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Share as visitor
              </button>
            </div>
          )}

          {tab === "link" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">Anyone with this link can view this {threadId ? "thread" : "agent"}, no login required.</p>
              {publicUrl ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={publicUrl}
                    className="flex-1 text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-600"
                  />
                  <button
                    onClick={copyLink}
                    className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateLink}
                  disabled={loading}
                  className="btn-primary text-sm rounded-xl flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Generate public link
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
