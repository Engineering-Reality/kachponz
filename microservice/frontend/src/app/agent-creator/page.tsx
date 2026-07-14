"use client";

import { useState } from "react";
import {
  Bot,
  Send,
  Cpu,
  CheckCircle,
  Wand2,
  Headset,
  LineChart,
  Code2,
  Landmark,
  X,
} from "lucide-react";

interface Message {
  role: "bot" | "user";
  content: string;
}

const EXAMPLES = [
  { icon: Headset, label: "Customer Support", text: "Create a customer support agent that answers questions about LC settlement status and escalates unresolved issues to a human checker." },
  { icon: LineChart, label: "Data Analyst", text: "Create a data analyst agent that queries transaction history and generates settlement summaries in JSON format." },
  { icon: Code2, label: "Code Reviewer", text: "Create a code reviewer agent that validates UiPath bot scripts against Amadeus A2A protocol v1 specifications." },
  { icon: Landmark, label: "LC Settlement Orchestrator", text: "Create an orchestrator agent that coordinates Import LC settlement across 9 steps using amadeus-mcp and mcp-uipath tools. It should use cost-aware routing (LLM for doc examination, PAD for simple CRUD, UiPath for financial steps) and provide real-time status updates." },
];

export default function AgentCreator() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content:
        "Hello! I'm the Architect — describe the agent you'd like to build and I'll help configure its persona, system prompt, and MCP tool assignments.",
    },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", content: input }]);
    setInput("");
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: "bot",
          content:
            "Analyzing your request… I'll extract the best persona, capabilities, and tool assignments based on your description.",
        },
      ]);
    }, 900);
  };

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Chat */}
      <div className="flex-1 flex flex-col border-r border-slate-200/70 min-w-0">
        {/* Architect Header */}
        <div className="px-6 py-4 border-b border-slate-200/70 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden relative flex-shrink-0">
              <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-90" />
              <div className="absolute inset-[2px] bg-white rounded-[9px] flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-slate-800" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 leading-tight">Agent Architect</h1>
              <p className="ui-label text-slate-400">Natural-language agent builder</p>
            </div>
          </div>
          <span className="badge badge-slate">Draft session</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "bot" && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 relative overflow-hidden p-[1.5px]">
                    <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-90" />
                    <div className="relative z-10 w-full h-full rounded-full bg-white flex items-center justify-center">
                      <Bot className="w-4 h-4 text-slate-700" />
                    </div>
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm leading-relaxed shadow-sm ${ msg.role === "user" ? "bg-slate-900 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm" }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Example Prompts */}
        <div className="px-6 pb-3">
          <div className="max-w-2xl mx-auto">
            <p className="ui-label text-slate-400 mb-2">Start from a template</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {EXAMPLES.map(({ icon: Icon, label, text }) => (
                <button
                  key={label}
                  onClick={() => setInput(text)}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:border-pink-200 hover:text-pink-600 hover:bg-pink-50 transition-all shadow-sm"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="px-6 pb-6 pt-2">
          <div className="max-w-2xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder="Describe your agent in plain language…"
              className="form-input pr-12 py-3 rounded-2xl"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspector / Config Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[#fafafa]">
        <div className="px-5 py-4 border-b border-slate-200/70 bg-white flex items-center justify-between">
          <h2 className="ui-label text-slate-500 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" /> Preview Config
          </h2>
          <span className="badge badge-slate">Awaiting</span>
        </div>

        {/* Skeleton preview — enterprise placeholder */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {[
            { label: "Agent Name", lines: 1 },
            { label: "System Persona", lines: 3 },
            { label: "MCP Tool Assignments", lines: 2 },
          ].map((f) => (
            <div key={f.label} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
              <p className="ui-label text-slate-400">{f.label}</p>
              {Array.from({ length: f.lines }).map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-full bg-slate-100"
                  style={{ width: `${90 - i * 18}%` }}
                />
              ))}
            </div>
          ))}
          <div className="flex items-center gap-2 justify-center pt-2 text-slate-400">
            <Wand2 className="w-3.5 h-3.5" />
            <p className="text-xs leading-relaxed text-center">
              Describe your agent — the Architect fills this in.
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200/70 bg-white">
          <button
            disabled
            className="w-full btn-primary text-sm justify-center opacity-40 cursor-not-allowed rounded-xl"
          >
            <CheckCircle className="w-4 h-4" /> Compile Agent
          </button>
          <p className="text-center ui-label text-slate-400 mt-2">
            Complete the chat to enable compilation
          </p>
        </div>
      </div>
    </div>
  );
}
