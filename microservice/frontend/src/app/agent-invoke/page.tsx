"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Bot,
  Send,
  Settings2,
  Trash2,
  Search,
  X,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { Select } from '@/components/Select';

interface Message {
  role: 'system' | 'bot' | 'user' | 'error';
  content: string;
}

export default function AgentInvoke() {
  return (
    <Suspense fallback={null}>
      <AgentInvokeInner />
    </Suspense>
  );
}

function AgentInvokeInner() {
  const searchParams = useSearchParams();
  const preselectAgent = searchParams.get('agent');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('UPLINK: STABLE');
  const [transactionId, setTransactionId] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [toolsList, setToolsList] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [modelInit, setModelInit] = useState<string | null>(null);
  const [agentInit, setAgentInit] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);

  const selectedAgentObj = agents.find(a => a.agent_id === selectedAgent);
  const connectedTools = selectedAgentObj
    ? (selectedAgentObj.tools || []).map((tid: string) => toolsList.find(t => t.tool_id === tid)).filter(Boolean)
    : [];

  const formatMessageContent = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={index} className="font-semibold text-slate-900">{part.slice(1, -1)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="font-mono bg-slate-100 text-rose-600 border border-slate-200 px-1.5 py-0.5 rounded text-xs font-semibold mx-0.5">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  const robotKey = process.env.NEXT_PUBLIC_ROBOT_KEY ?? "amadeus_local_dev";

  // Auto-generate transaction ID if empty
  useEffect(() => {
    if (typeof window !== 'undefined' && !transactionId) {
      try {
        setTransactionId(window.crypto.randomUUID());
      } catch (e) {
        setTransactionId('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        }));
      }
    }
  }, [transactionId]);

  useEffect(() => {
    const fetchAgentsAndTools = async () => {
      try {
        const [agentsRes, toolsRes] = await Promise.all([
          fetch(`${apiUrl}/agents`, { headers: { "x-robot-key": robotKey } }),
          fetch(`${apiUrl}/tools`, { headers: { "x-robot-key": robotKey } }),
        ]);
        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents(data || []);
        }
        if (toolsRes.ok) {
          const data = await toolsRes.json();
          setToolsList(data || []);
        }
      } catch (err) {
        console.error("Failed to load agents or tools", err);
      }
    };
    fetchAgentsAndTools();
  }, [apiUrl, robotKey]);

  // Pre-select agent from ?agent= query param (e.g. /agent-invoke?agent=orchestrator)
  // by loose name match, since we don't know the generated agent_id ahead of time.
  useEffect(() => {
    if (!preselectAgent || selectedAgent || agents.length === 0) return;
    const match = agents.find((a) =>
      a.agent_name?.toLowerCase().includes(preselectAgent.toLowerCase())
    );
    if (match) setSelectedAgent(match.agent_id);
  }, [preselectAgent, agents, selectedAgent]);

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }
    const currentInput = input;
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setInput('');
    setStatus('Processing...');
    setModelInit(null);
    setAgentInit(null);
    setResponseTime(null);

    try {
      const res = await fetch(`${apiUrl}/orchestrator/run-agentic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Robot-Key': robotKey
        },
        body: JSON.stringify({
          transactionId: transactionId.trim() || undefined,
          agentId: selectedAgent || undefined,
          idempotencyKey: `invoke-${Date.now()}`,
          prompt: currentInput,
          messages: [...messages, { role: 'user', content: currentInput }]
            .filter(m => m.role === 'user' || m.role === 'bot')
            .map(m => ({
              role: m.role === 'bot' ? 'assistant' : 'user',
              content: m.content
            })),
          stream: true
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error?.message || `Server error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) {
        throw new Error('Readable stream not supported on response.');
      }

      // Add a temporary bot message that we will append to
      setMessages(prev => [...prev, { role: 'bot', content: '' }]);

      let accumulatedResponse = '';
      let buffer = '';
      let currentEvent = 'update';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === 'metrics') {
                if (data.modelInit !== undefined) setModelInit(`${data.modelInit.toFixed(3)}s`);
                if (data.agentInit !== undefined) setAgentInit(`${data.agentInit.toFixed(3)}s`);
                if (data.responseTime !== undefined) setResponseTime(`${data.responseTime.toFixed(3)}s`);
              } else if (currentEvent === 'complete') {
                setStatus('Stream Complete');
              } else if (currentEvent === 'error') {
                throw new Error(data.message || data.error || 'Stream processing error');
              } else {
                if (data.message && data.message.content) {
                  if (data.node === 'agent' && data.message.role === 'assistant') {
                    accumulatedResponse = data.message.content;
                    setMessages(prev => {
                      const next = [...prev];
                      if (next.length > 0) {
                        next[next.length - 1] = {
                          role: 'bot',
                          content: accumulatedResponse
                        };
                      }
                      return next;
                    });
                  }
                }
                // If there are tool calls, show a system thinking log
                if (data.toolCalls && data.toolCalls.length > 0) {
                  const toolsCalled = data.toolCalls.map((t: any) => `${t.name}(${JSON.stringify(t.args)})`).join(', ');
                  setStatus(`Running tool: ${data.toolCalls[0].name}...`);
                  setMessages(prev => {
                    const next = [...prev];
                    const botMsg = next.pop(); // temporary remove bot message
                    next.push({ role: 'system', content: `⚙️ [Agent Call] Using tool ${toolsCalled}` });
                    if (botMsg) next.push(botMsg); // restore bot message
                    return next;
                  });
                }
              }
            } catch (e: any) {
              if (currentEvent === 'error') throw new Error(e.message || 'Stream execution failed');
              console.error('Failed to parse SSE data', e);
            }
          }
        }
      }
      setStatus('UPLINK: STABLE');
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: `Error: ${err.message}`
      }]);
      setStatus('UPLINK: ERROR');
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStatus('UPLINK: STABLE');
  };

  return (
    <div className="flex h-full text-slate-900 overflow-hidden bg-[#FAFAFA]">

      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar Panel — Mission Control */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <span className="terminal-dot bg-red-400" />
            <span className="terminal-dot bg-amber-400" />
            <span className="terminal-dot bg-emerald-400" />
            <span className="ui-label text-slate-500 ml-2">Amadeus Console</span>
          </div>

          <div className="p-6 space-y-8">

            {/* Agent Select */}
            <div>
              <label className="ui-label text-slate-500 block mb-2">Active Node</label>
              <div className="relative rounded-lg p-[1.5px] mb-2 overflow-hidden">
                <div className={`absolute inset-0 vibrant-rainbow-border ${selectedAgent ? 'animate-border-spin opacity-70' : 'opacity-25'}`} />
                <Select
                  value={selectedAgent}
                  onChange={setSelectedAgent}
                  placeholder="Select an agent"
                  options={agents.map((agent) => ({ value: agent.agent_id, label: agent.agent_name }))}
                  className="relative z-10"
                  triggerClassName="rounded-[7px] border-transparent"
                />
              </div>
              <button
                onClick={() => {
                  if (selectedAgent) {
                    setIsInspectOpen(true);
                  } else {
                    alert("Select an agent first!");
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 hover:underline transition-colors"
              >
                <Search className="w-3.5 h-3.5" /> Inspect Node
              </button>
            </div>

            {/* Session Settings */}
            <div>
              <label className="ui-label text-slate-500 block mb-2">Session</label>

              <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3 bg-slate-50">
                <span className="ui-label text-slate-400 border-r border-slate-200 px-3 flex items-center">Ref ID</span>
                <input
                  type="text"
                  placeholder="Transaction UUID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono text-slate-700 bg-transparent outline-none placeholder:text-slate-400"
                />
              </div>

              <label className="flex items-center justify-between gap-2 text-sm text-slate-700 mb-3 cursor-pointer">
                <span>Flush Memory</span>
                <span className="toggle-switch">
                  <input type="checkbox" />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </span>
              </label>
              <label className="flex items-center justify-between gap-2 text-sm text-slate-700 cursor-pointer">
                <span>Load Context</span>
                <span className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </span>
              </label>
            </div>

            {/* Metrics — Telemetry */}
            <div>
              <label className="ui-label text-slate-500 mb-2 flex justify-between items-center">
                Telemetry
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] text-white vibrant-rainbow-bg">LIVE</span>
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 text-[13px]">Model Init</span>
                  <span key={`m-${modelInit}`} className={`metric-value text-slate-900 text-[13px] ${modelInit ? 'stream-in' : ''}`}>{modelInit ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 text-[13px]">Agent Init</span>
                  <span key={`a-${agentInit}`} className={`metric-value text-slate-900 text-[13px] ${agentInit ? 'stream-in' : ''}`}>{agentInit ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 text-[13px]">Response Time</span>
                  <span key={`r-${responseTime}`} className={`metric-value text-slate-900 text-[13px] ${responseTime ? 'stream-in' : ''}`}>{responseTime ?? '—'}</span>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-auto p-4 border-t border-slate-200">
            <button className="relative w-full rounded-xl p-[1.5px] overflow-hidden group">
              <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
              <span className="relative z-10 flex items-center justify-center gap-2 bg-white text-slate-900 py-3 rounded-[10px] text-sm font-semibold">
                <Settings2 className="w-4 h-4" /> Apply Config
              </span>
            </button>
          </div>
        </aside>

        {/* Chat Area — Stream Console */}
        <main className="flex-1 flex flex-col relative bg-[#FAFAFA]">

          {/* Chat Header */}
          <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 absolute top-0 left-0 w-full z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="ui-label text-slate-500">{status}</span>
            </div>
            {selectedAgentObj && (
              <span className="ui-label text-slate-500 truncate max-w-[40%]">{selectedAgentObj.agent_name}</span>
            )}
            <button onClick={clearChat} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pt-20 p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden relative mb-4">
                  <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-90" />
                  <div className="absolute inset-[2px] bg-white rounded-[14px] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-slate-700" />
                  </div>
                </div>
                <p className="text-lg font-semibold text-slate-800">Start a conversation</p>
                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                  Select an agent and send a prompt to begin streaming its reasoning.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                if (msg.role === 'system') {
                  if (msg.content.startsWith('⚙️ [Agent Call]')) {
                    const match = msg.content.match(/⚙️ \[Agent Call\] Using tool ([^(]+)\((.*)\)/);
                    const toolName = match ? match[1] : 'Unknown Tool';
                    const toolArgs = match ? match[2] : '';

                    return (
                      <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-start w-full stream-in">
                        <div className="w-full relative overflow-hidden rounded-xl bg-white border border-slate-200 shadow-sm">
                          <div className="relative z-10 p-5 flex flex-col gap-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="ui-label text-slate-500">Agent Call Execution</span>
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-600">
                                <Cpu className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="ui-label text-slate-400 block">Invoking MCP Tool</span>
                                <span className="font-mono text-xs text-amber-700 font-semibold">{toolName}</span>
                              </div>
                            </div>

                            {toolArgs && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <span className="ui-label text-slate-400 block mb-1">Parameters</span>
                                <pre className="font-mono text-[11px] text-slate-700 overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                                  {toolArgs}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-start w-full">
                      <div className="bg-slate-100 border border-slate-200 text-slate-500 text-xs p-3 rounded-lg w-full flex justify-between items-center">
                        <span>{msg.content}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'error') {
                  return (
                    <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-start w-full stream-in">
                      <div className="w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'user') {
                  return (
                    <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-end">
                      <div className="relative rounded-2xl p-[2px] overflow-hidden max-w-[80%] rounded-tr-sm shadow-sm">
                        <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
                        <div className="relative bg-white rounded-[14px] p-4 z-10 flex flex-col">
                          <span className="text-sm leading-relaxed whitespace-pre-wrap block text-slate-800">
                            {formatMessageContent(msg.content)}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-2 text-right">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'bot') {
                  return (
                    <div key={idx} className="flex gap-3 max-w-3xl mx-auto justify-start stream-in">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 relative overflow-hidden p-[1.5px]">
                        <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-90" />
                        <div className="relative z-10 w-full h-full rounded-full bg-white flex items-center justify-center">
                          <Bot className="w-4 h-4 text-slate-700" />
                        </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-500 mb-1">Amadeus</span>
                        <span className="text-sm leading-relaxed whitespace-pre-wrap block text-slate-700">
                          {formatMessageContent(msg.content)}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-2">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })
            )}
          </div>

          {/* Input */}
          <div className="p-6 bg-[#FAFAFA] border-t border-slate-200">
            <div className="max-w-3xl mx-auto relative flex items-end bg-white border border-slate-200 rounded-2xl focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/5 transition-all p-2 shadow-sm">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message the agent…"
                className="flex-1 bg-transparent py-2 px-2 text-sm text-slate-900 focus:outline-none resize-none placeholder:text-slate-400 max-h-40"
              />

              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="relative p-3 rounded-xl overflow-hidden disabled:opacity-40 ml-2 group"
              >
                <div className="absolute inset-0 vibrant-rainbow-bg" />
                <Send className="relative z-10 w-4 h-4 text-white" />
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="ui-label text-slate-400">
                ⏎ send · shift+⏎ newline
              </span>
            </div>
          </div>

          {isInspectOpen && selectedAgentObj && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
                  <span className="terminal-dot bg-red-400" />
                  <span className="terminal-dot bg-amber-400" />
                  <span className="terminal-dot bg-emerald-400" />
                  <span className="text-sm font-semibold text-slate-900 ml-2 flex-1 truncate">Inspect Node: {selectedAgentObj.agent_name}</span>
                  <button onClick={() => setIsInspectOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                  <div>
                    <h4 className="ui-label text-slate-400 mb-2">Agent Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                      <div>
                        <span className="ui-label text-slate-400 block">Agent ID</span>
                        <span className="font-mono text-slate-700 font-medium break-all">{selectedAgentObj.agent_id}</span>
                      </div>
                      <div>
                        <span className="ui-label text-slate-400 block">Status</span>
                        <span className="text-slate-700 font-medium">
                          {selectedAgentObj.on_status ? '🟢 Online / Active' : '⚪ Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="ui-label text-slate-400 mb-2">System Personality Prompt</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-600 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {selectedAgentObj.agent_style || "No personality style configured."}
                    </div>
                  </div>

                  <div>
                    <h4 className="ui-label text-slate-400 mb-2">Connected Model Context Protocols (MCP)</h4>
                    {connectedTools.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4">No tools connected.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 border-y border-slate-100">
                        {connectedTools.map((tool: any) => (
                          <div key={tool.tool_id} className="py-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {tool.name}
                              </span>
                              <span className={`badge text-[9px] px-2 py-0.5 rounded-full ${tool.on_status === 'Online' ? 'badge-green' : 'badge-slate'}`}>
                                {tool.on_status || 'Offline'}
                              </span>
                            </div>
                            {tool.description && (
                              <p className="text-xs text-slate-500 leading-relaxed">{tool.description}</p>
                            )}
                            <div>
                              <span className="ui-label text-slate-400 block mb-1">MCP Connection Schema</span>
                              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 font-mono text-[11px] overflow-x-auto max-h-40 border border-slate-800">
                                {JSON.stringify(tool.versions, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                  <button onClick={() => setIsInspectOpen(false)} className="btn-primary text-xs rounded-xl py-2.5 px-4">
                    Close Inspector
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
