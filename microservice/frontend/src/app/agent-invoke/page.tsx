"use client";

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  Send,
  Settings2,
  Trash2,
  Activity,
  Image as ImageIcon,
  Search,
  X
} from 'lucide-react';

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
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
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
    <div className="flex h-full text-slate-900 overflow-hidden">

      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar Panel */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Agent Select */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Node</label>
              <select 
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 text-sm mb-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">Select an agent</option>
                {agents.map(agent => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {agent.agent_name}
                  </option>
                ))}
              </select>
              <button 
                onClick={() => {
                  if (selectedAgent) {
                    setIsInspectOpen(true);
                  } else {
                    alert("Select an agent first!");
                  }
                }}
                className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" /> Inspect Node
              </button>
            </div>

            {/* Session Settings */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Environment</label>
              
              <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3">
                <span className="bg-slate-50 border-r border-slate-200 text-slate-500 text-xs font-bold px-3 flex items-center">HASH</span>
                <input 
                  type="text" 
                  placeholder="Transaction UUID" 
                  value={transactionId} 
                  onChange={(e) => setTransactionId(e.target.value)} 
                  className="w-full p-2.5 text-sm outline-none" 
                />
              </div>

              <select className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 text-sm mb-4 outline-none">
                <option value="custom-vlm">Auto Protocol</option>
              </select>

              <label className="flex items-center gap-2 text-sm text-slate-700 mb-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Flush Memory
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Load Context (JSON)
              </label>
            </div>

            {/* Metrics */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                Metrics
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">LIVE</span>
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Model Init:</span>
                  <span className="font-mono font-medium text-slate-900">{modelInit ?? '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Agent Init:</span>
                  <span className="font-mono font-medium text-slate-900">{agentInit ?? '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Response Time:</span>
                  <span className="font-mono font-medium text-slate-900">{responseTime ?? '-'}</span>
                </div>
              </div>
            </div>

          </div>
          
          <div className="mt-auto p-4 border-t border-slate-200">
            <button className="w-full bg-black text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
              <Settings2 className="w-4 h-4" /> Apply Config
            </button>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col relative bg-[#FAFAFA]">
          
          {/* Chat Header */}
          <div className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur flex items-center justify-between px-6 absolute top-0 left-0 w-full z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-xs font-bold text-slate-600 tracking-wider uppercase">{status}</span>
            </div>
            <button onClick={clearChat} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pt-20 p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <Bot className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-xl font-light tracking-widest uppercase">Awaiting Data</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                if (msg.role === 'system') {
                  if (msg.content.startsWith('⚙️ [Agent Call]')) {
                    const match = msg.content.match(/⚙️ \[Agent Call\] Using tool ([^(]+)\((.*)\)/);
                    const toolName = match ? match[1] : 'Unknown Tool';
                    const toolArgs = match ? match[2] : '';
                    
                    return (
                      <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-start w-full">
                        <div className="w-full relative overflow-hidden rounded-2xl p-[1.5px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 shadow-md">
                          <div className="absolute inset-0 vibrant-rainbow-border opacity-20" />
                          <div className="relative bg-zinc-950 text-white rounded-[14px] p-5 z-10 flex flex-col gap-3 font-sans border border-white/5">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Agent Call Execution</span>
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-base">
                                ⚙️
                              </div>
                              <div>
                                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 block">Invoking MCP Tool</span>
                                <span className="font-mono text-xs text-amber-300 font-semibold">{toolName}</span>
                              </div>
                            </div>
                            
                            {toolArgs && (
                              <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">Parameters</span>
                                <pre className="font-mono text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all max-h-32">
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
                      <div className="bg-slate-100 border border-slate-200 text-slate-500 font-mono text-[11px] p-3 rounded-lg w-full flex justify-between items-center shadow-sm">
                        <span>{msg.content}</span>
                        <span className="text-[9px] text-slate-400">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'error') {
                  return (
                    <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-start w-full">
                      <div className="w-full bg-red-950/20 border border-red-500/30 text-red-200 p-4 rounded-xl font-mono text-xs shadow-sm">
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'user') {
                  return (
                    <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-end">
                      <div className="relative rounded-2xl p-[2px] overflow-hidden max-w-[80%] rounded-tr-sm shadow-md">
                        <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-80" />
                        <div className="relative bg-white rounded-[14px] p-4 text-slate-800 z-10 flex flex-col">
                          <span className="text-sm leading-relaxed whitespace-pre-wrap block">
                            {formatMessageContent(msg.content)}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-2 font-mono text-right">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (msg.role === 'bot') {
                  return (
                    <div key={idx} className="flex gap-4 max-w-3xl mx-auto justify-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative overflow-hidden p-[1px] bg-gradient-to-tr from-violet-500 to-indigo-600 shadow-md">
                        <Bot className="w-4 h-4 text-white z-10" />
                      </div>
                      <div className="relative rounded-2xl p-[2px] overflow-hidden max-w-[80%] rounded-tl-sm shadow-sm">
                        <div className="absolute inset-0 vibrant-rainbow-border opacity-70" />
                        <div className="relative bg-white/75 backdrop-blur-md rounded-[14px] p-4 text-slate-800 z-10 flex flex-col">
                          <span className="text-sm leading-relaxed whitespace-pre-wrap block">
                            {formatMessageContent(msg.content)}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-2 font-mono">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
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
          <div className="p-6 bg-white border-t border-slate-200">
            <div className="max-w-3xl mx-auto relative flex items-center bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all p-2">
              
              <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
              
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-transparent py-2 px-2 text-sm focus:outline-none"
              />
              
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 ml-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center mt-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                Amadeus Quantum Stream v2.5 // Secure Uplink
              </span>
            </div>
          </div>
          {isInspectOpen && selectedAgentObj && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600 animate-pulse" /> Inspect Agent Node: {selectedAgentObj.agent_name}
                  </h2>
                  <button onClick={() => setIsInspectOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Agent Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs">
                      <div>
                        <span className="text-slate-400 block uppercase font-mono tracking-wider">Agent ID</span>
                        <span className="font-mono text-slate-800 font-medium break-all">{selectedAgentObj.agent_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono tracking-wider">Status</span>
                        <span className="font-mono text-slate-800 font-medium">
                          {selectedAgentObj.on_status ? '🟢 Online / Active' : '⚪ Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Personality Prompt</h4>
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 font-mono text-xs text-slate-600 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedAgentObj.agent_style || "No personality style configured."}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Connected Model Context Protocols (MCP)</h4>
                    {connectedTools.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed rounded-xl p-4">No tools connected.</p>
                    ) : (
                      <div className="space-y-4">
                        {connectedTools.map((tool: any) => (
                          <div key={tool.tool_id} className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
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
                              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">MCP Connection Schema</span>
                              <pre className="bg-slate-900 text-slate-100 rounded-lg p-3.5 font-mono text-[11px] overflow-x-auto max-h-40 border border-white/5 shadow-inner">
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
                  <button onClick={() => setIsInspectOpen(false)} className="btn-primary text-xs rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors py-2.5 px-4 shadow-md">
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
