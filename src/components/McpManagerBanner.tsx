"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Polls GET /orchestrator/mcp/manager-status and renders nothing unless the
 * mcpAutoManager child process crashed at startup — in which case no MCP
 * tool server is running and every tool call fails with a generic
 * connection error. Surfacing that here beats discovering it mid-chat.
 */
export function McpManagerBanner() {
  const [crashedEarly, setCrashedEarly] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/orchestrator/mcp/manager-status");
        if (!res.ok) return;
        const data: { running: boolean; crashedEarly: boolean; lastError: string | null } = await res.json();
        setCrashedEarly(data.crashedEarly);
        setLastError(data.lastError);
      } catch {
        // Best-effort — don't let this block the rest of the page.
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!crashedEarly) return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>
        <strong>MCP process manager is not running</strong> — tool calls will fail. Check server logs.
        {lastError ? <span className="block text-red-500 font-mono text-xs mt-1">{lastError}</span> : null}
      </span>
    </div>
  );
}
