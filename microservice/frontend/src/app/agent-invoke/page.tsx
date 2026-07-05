"use client";

import { useState } from 'react';
import Link from 'next/link';
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
  role: 'system' | 'bot' | 'user';
  content: string;
}

export default function AgentInvoke() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('UPLINK: STABLE');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    setStatus('Connecting...');
    
    // Mock bot response for boilerplate
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: "I am analyzing your input..." 
      }]);
      setStatus('Stream Complete');
    }, 1500);
  };

  const clearChat = () => {
    setMessages([]);
    setStatus('UPLINK: STABLE');
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA] text-slate-900 font-sans">
      
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center text-cyan-600">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Invoke Stream</h1>
          </div>
        </div>
      </header>

      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar Panel */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Agent Select */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Node</label>
              <select className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg p-2.5 text-sm mb-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all">
                <option value="">Select an agent</option>
                <option value="1">Data Analyst Bot</option>
                <option value="2">Customer Support</option>
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
                <input type="text" placeholder="Thread ID" defaultValue="1" className="w-full p-2.5 text-sm outline-none" />
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
                  <span className="font-mono font-medium text-slate-900">-</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Agent Init:</span>
                  <span className="font-mono font-medium text-slate-900">-</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Response Time:</span>
                  <span className="font-mono font-medium text-slate-900">-</span>
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
                  <div className={`p-4 rounded-2xl max-w-[80%] ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white shadow-md rounded-tr-sm' 
                      : msg.role === 'system'
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
