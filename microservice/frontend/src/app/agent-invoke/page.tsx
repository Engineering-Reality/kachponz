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
  Search
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
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [modelInit, setModelInit] = useState<string | null>(null);
  const [agentInit, setAgentInit] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<string | null>(null);

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
    const fetchAgents = async () => {
      try {
        const res = await fetch(`${apiUrl}/agents`, { headers: { "x-robot-key": robotKey } });
        if (res.ok) {
          const data = await res.json();
          setAgents(data || []);
        }
      } catch (err) {
        console.error("Failed to load agents", err);
      }
    };
    fetchAgents();
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
              <button className="w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
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
              messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl ${msg.role === 'system' ? 'w-full' : 'max-w-[80%]'} ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white shadow-md rounded-tr-sm' 
                      : msg.role === 'system'
                        ? 'bg-slate-50 border border-slate-200 text-slate-500 font-mono text-xs w-full rounded-lg'
                        : msg.role === 'error'
                          ? 'bg-red-50 border border-red-200 text-red-800 w-full rounded-md'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className="text-[10px] opacity-50 mt-2 font-mono">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
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

        </main>
      </div>
    </div>
  );
}
