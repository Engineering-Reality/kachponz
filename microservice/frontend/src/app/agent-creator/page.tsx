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
      <div className="flex-1 flex flex-col border-r border-slate-100">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "bot" && (
                  <div className="w-8 h-8 rounded-lg bg-pink-50 border border-pink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-pink-500" />
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-xl max-w-[80%] text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-sm"
                      : "bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Example Prompts */}
        <div className="px-6 pb-3">
          <div className="max-w-2xl mx-auto flex gap-2 overflow-x-auto pb-1">
            {EXAMPLES.map(({ icon: Icon, label, text }) => (
              <button
                key={label}
                onClick={() => setInput(text)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-pink-200 hover:text-pink-600 hover:bg-pink-50 transition-all"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
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
              className="form-input pr-12 py-3"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspector / Config Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[#fafafa]">
        <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" /> Preview Config
          </h2>
          <span className="badge badge-slate">Awaiting</span>
        </div>

        <div className="flex-1 flex items-center justify-center flex-col text-center p-8 opacity-40">
          <Wand2 className="w-10 h-10 text-slate-400 mb-3" />
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
            Awaiting Extraction
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Describe your agent and the Architect will populate name, system prompt, and tool assignments here.
          </p>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white">
          <button
            disabled
            className="w-full btn-primary text-sm justify-center opacity-40 cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" /> Compile Agent
          </button>
          <p className="text-center text-[10px] text-slate-400 font-mono mt-2">
            Complete the chat to enable compilation.
          </p>
        </div>
      </div>
    </div>
  );
}
