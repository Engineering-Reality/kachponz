const fs = require('fs');

const code = fs.readFileSync('microservice/frontend/src/app/agent-invoke/page.tsx', 'utf-8');

const startMainSplit = code.indexOf('{/* Main Split */}');
const endMainSplit = code.lastIndexOf('</div>\n    </div>\n  );\n}');

if (startMainSplit === -1 || endMainSplit === -1) {
  console.error("Could not find boundaries");
  process.exit(1);
}

const beforeSplit = code.slice(0, startMainSplit);
const afterSplit = code.slice(endMainSplit);

const mainSplitInner = code.slice(startMainSplit, endMainSplit);

// Extract the Messages Area (from {/* Messages */} to the end of mainSplitInner)
const startMessages = mainSplitInner.indexOf('{/* Messages */}');
if (startMessages === -1) {
  console.error("Could not find messages area");
  process.exit(1);
}

const messagesArea = mainSplitInner.slice(startMessages);
const withoutAside = messagesArea.replace(/<\/main>\s*$/, ''); // remove the closing main tag

const newMainSplit = `
      {/* Main Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area — Stream Console */}
        <main className="flex-1 flex flex-col relative bg-[#FAFAFA] min-w-0">

          {/* Chat Header / Amadeus Console Top Bar */}
          <div className="border-b border-slate-200 bg-white flex flex-col sticky top-0 z-20 w-full shrink-0 shadow-sm">
            {/* Top Row: Title & Basic Info */}
            <div className="h-10 flex items-center justify-between px-6 border-b border-slate-100 bg-slate-50/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="terminal-dot bg-red-400" />
                <span className="terminal-dot bg-amber-400" />
                <span className="terminal-dot bg-emerald-400" />
                <span className="ui-label text-slate-500 ml-2">Amadeus Console</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="ui-label text-slate-500">{status}</span>
                </div>
                {selectedAgentObj && (
                  <span className="ui-label text-slate-500 truncate max-w-[150px]">{selectedAgentObj.agent_name}</span>
                )}
                <button onClick={clearChat} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50" title="Clear Chat">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Controls */}
            <div className="px-6 py-2.5 flex items-center gap-6 overflow-x-auto scrollbar-hide">
              
              {/* Agent Select */}
              <div className="flex items-center gap-3 shrink-0">
                <label className="ui-label text-slate-500">Active Node</label>
                <div className="w-48 relative rounded-md p-[1px] overflow-hidden">
                  <div className={\`absolute inset-0 vibrant-rainbow-border \${selectedAgent ? 'animate-border-spin opacity-70' : 'opacity-25'}\`} />
                  <Select
                    value={selectedAgent}
                    onChange={(val) => {
                      setSelectedAgent(val);
                      if (currentSessionId) {
                        setSessions(s => {
                          const updated = s.map(session => session.id === currentSessionId ? { ...session, agentId: val } : session);
                          localStorage.setItem('agent-sessions', JSON.stringify(updated));
                          return updated;
                        });
                      }
                    }}
                    placeholder="Select an agent"
                    options={agents.map((agent) => ({ value: agent.agent_id, label: agent.agent_name }))}
                    className="relative z-10 !py-1 text-xs bg-white"
                    triggerClassName="rounded-[5px] border-transparent"
                  />
                </div>
                <button
                  onClick={() => {
                    if (selectedAgent) setIsInspectOpen(true);
                    else alert("Select an agent first!");
                  }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-md hover:bg-indigo-50"
                  title="Inspect Node"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Session Settings */}
              <div className="flex items-center gap-3 shrink-0">
                <label className="ui-label text-slate-500">Ref ID</label>
                <input
                  type="text"
                  placeholder="Tx UUID"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-32 px-3 py-1.5 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-indigo-400 transition-colors"
                />
              </div>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Telemetry */}
              <div className="flex items-center gap-4 shrink-0">
                <span className="ui-label text-slate-500">Telemetry <span className="text-[8px] text-white vibrant-rainbow-bg px-1 py-[1px] rounded ml-1">LIVE</span></span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-400">Init: <span key={\`a-\${agentInit}\`} className={\`text-slate-800 font-mono \${agentInit ? 'stream-in' : ''}\`}>{agentInit ?? '—'}</span></span>
                  <span className="text-slate-400">Resp: <span key={\`r-\${responseTime}\`} className={\`text-slate-800 font-mono \${responseTime ? 'stream-in' : ''}\`}>{responseTime ?? '—'}</span></span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto relative p-6 space-y-6 pt-4">
`;

// Note: the original messagesArea has `<div className="flex-1 overflow-y-auto pt-20 p-6 space-y-6">`
// which we need to replace so we don't nest overflow divs incorrectly.
let cleanMessages = withoutAside.replace(/<div className="flex-1 overflow-y-auto pt-20 p-6 space-y-6">/, '');
// It also has an extra closing div we need to remove.
cleanMessages = cleanMessages.replace(/(<\/div>\s*)(?:<!-- Chat Input Area -->|<div className="p-6 bg-white border-t border-slate-200 relative z-10 shrink-0">)/, '$1\n          </div>\n          {/* Chat Input Area */}\n          <div className="p-6 bg-white border-t border-slate-200 relative z-10 shrink-0">');

// We have an issue: `withoutAside` contains the Chat Input Area at the end, but the `flex-1 overflow-y-auto` div closes right before it. 
// Let's use a simpler string replacement.

const finalCode = beforeSplit + newMainSplit.replace('<div className="flex-1 overflow-y-auto relative p-6 space-y-6 pt-4">', '') + withoutAside.replace(/pt-20 p-6 space-y-6/, 'pt-6 p-6 space-y-6') + `
        </main>
        
        {/* Right Sidebar — UiPathLiveGraph */}
        <aside className="w-[340px] bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0 z-10">
          <UiPathLiveGraph sessionLabel={currentSessionId} apiUrl={apiUrl} robotKey={robotKey} />
        </aside>
      </div>
` + code.slice(endMainSplit + 6); // Add back the final closing tags

fs.writeFileSync('microservice/frontend/src/app/agent-invoke/page.tsx', finalCode);
console.log("Refactoring complete");
