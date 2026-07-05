"use client";

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Bot, 
  Send, 
  Cpu, 
  CheckCircle,
  Wand2,
  Headset,
  LineChart,
  Code2,
  Users
} from 'lucide-react';

interface Message {
  role: 'bot' | 'user';
  content: string;
}

export default function AgentCreator() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'bot', 
      content: "Hello! I am the Architect. Give me a detailed description of the agent you'd like to build, and I'll help you configure its logic and tools." 
    }
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    
    // Mock bot response for boilerplate
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: "I'm analyzing your request to extract the best persona and tools..." 
      }]);
    }, 1000);
  };

  const handleExampleClick = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex flex-col h-screen bg-[#FAFAFA] text-slate-900">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600">
              <Wand2 className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Agent Creator</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Neural Link Active
          </span>
        </div>
      </header>

      {/* Main Content Split */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: Chat Area */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200 relative">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'bot' && (
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 border border-slate-200">
                    <Bot className="w-4 h-4 text-slate-600" />
                  </div>
                )}
                <div className={`p-4 rounded-2xl max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white shadow-md rounded-tr-sm' 
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <div className="px-6 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide max-w-3xl mx-auto">
              <button onClick={() => handleExampleClick("Create a customer support agent...")} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                <Headset className="w-3 h-3" /> Customer Support
              </button>
              <button onClick={() => handleExampleClick("Create a data analyst agent...")} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                <LineChart className="w-3 h-3" /> Data Analyst
              </button>
              <button onClick={() => handleExampleClick("Create a code reviewer agent...")} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                <Code2 className="w-3 h-3" /> Code Reviewer
              </button>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-6 pt-2 bg-white">
            <div className="max-w-3xl mx-auto relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Describe your dream agent..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button 
                onClick={handleSend}
                className="absolute right-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={!input.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Inspector Panel */}
        <div className="w-96 bg-slate-50 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Configuration
            </h2>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">PREVIEW</span>
          </div>

          <div className="flex-1 p-6 flex items-center justify-center flex-col text-center opacity-50">
            <Wand2 className="w-12 h-12 text-slate-400 mb-4" />
            <p className="text-sm uppercase tracking-widest text-slate-500 font-mono">Awaiting Extraction</p>
          </div>

          <div className="p-6 border-t border-slate-200 bg-white">
            <button disabled className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle className="w-4 h-4" /> Compile Agent
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
