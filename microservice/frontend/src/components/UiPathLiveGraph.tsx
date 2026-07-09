"use client";

import { useEffect, useState, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RefreshCw, Terminal, AlertTriangle, CheckCircle, Clock, Play } from 'lucide-react';

const VerticalCustomNode = ({ data, isConnectable }: any) => {
  const isActive = data.status === 'active';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  
  let wrapperStyle = '';
  let nodeStyle = '';
  let titleColor = '';
  let labelColor = '';
  
  if (isActive) {
    wrapperStyle = 'vibrant-rainbow-border animate-border-spin p-[2px] shadow-[0_15px_35px_rgba(99,102,241,0.4)]';
    nodeStyle = 'bg-black/20 backdrop-blur-md'; // Rainbow shines through inside!
    titleColor = 'text-white drop-shadow-md';
    labelColor = 'text-white drop-shadow-md';
  } else {
    // Lagi ga kerja (Completed, Pending, Failed)
    wrapperStyle = 'vibrant-rainbow-border p-[1.5px] transition-all duration-300 group-hover:p-[2px] group-hover:shadow-[0_8px_20px_rgba(99,102,241,0.2)]';
    nodeStyle = 'bg-white';
    titleColor = isFailed ? 'text-red-500' : 'text-slate-500';
    labelColor = 'text-slate-700';
  }

  return (
    <div className={`relative group rounded-xl w-[260px] cursor-pointer transition-all duration-500 ${isActive ? 'scale-105 z-20' : 'scale-100 z-10 hover:scale-[1.02]'}`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-2.5 h-2.5 !bg-indigo-400 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className={`relative w-full rounded-xl overflow-hidden ${wrapperStyle}`}>
        <div className={`relative z-10 flex flex-col p-4 rounded-[10px] ${nodeStyle} transition-all duration-300`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-[10px] font-mono uppercase tracking-widest ${titleColor} font-bold flex items-center gap-1.5`}>
              {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
              {isFailed && <AlertTriangle className="w-3.5 h-3.5" />}
              {!isCompleted && !isFailed && !isActive && <Clock className="w-3.5 h-3.5" />}
              {data.actorHint}
            </span>
          </div>
          <div className={`font-semibold text-sm ${labelColor}`}>
            {data.label}
          </div>
          {isActive && (
            <div className="mt-3 flex items-center gap-2 bg-black/30 p-2 rounded-lg">
               <div className="w-2 h-2 rounded-full bg-white animate-ping" />
               <div className="w-2 h-2 rounded-full bg-white absolute" />
               <span className="text-[9px] text-white uppercase tracking-widest font-bold animate-pulse">Running...</span>
            </div>
          )}
          {data.selected && (
            <div className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 bg-indigo-100 rounded-full">
              <div className="w-2 h-2 bg-indigo-600 rounded-full" />
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-2.5 h-2.5 !bg-indigo-400 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
};

const nodeTypes = {
  custom: VerticalCustomNode,
};

type UiPathJob = { id: string; key: string; processName: string; state: string; createdAt: string; info?: string };

export function UiPathLiveGraph({ 
  sessionLabel,
  agentId,
  apiUrl, 
  robotKey 
}: { 
  sessionLabel: string | null; 
  agentId: string | null;
  apiUrl: string; 
  robotKey: string; 
}) {
  const [contextData, setContextData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedProcessName, setSelectedProcessName] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!agentId) {
      setContextData(null);
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    const fetchContext = async () => {
      try {
        const res = await fetch(`${apiUrl}/orchestrator/agents/${agentId}/uipath-context`, {
          headers: { 'X-Robot-Key': robotKey }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setContextData(data);
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed fetching live trace", e);
      }
    };

    fetchContext();
    const interval = setInterval(fetchContext, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [agentId, apiUrl, robotKey]);

  useEffect(() => {
    if (!contextData || !contextData.tools) return;
    
    const allProcesses: string[] = [];
    const recentJobs: UiPathJob[] = [];
    
    contextData.tools.forEach((t: any) => {
      if (t.processes) allProcesses.push(...t.processes);
      if (t.recentJobs) recentJobs.push(...t.recentJobs);
    });

    if (allProcesses.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (!selectedProcessName && allProcesses.length > 0) {
      setSelectedProcessName(allProcesses[0]);
    }

    const stepsData = allProcesses.map((processName, index) => {
      // Find the latest job for this process
      const job = recentJobs.find(j => j.processName === processName);
      
      let status = 'pending';
      let stateLabel = 'Idle';
      if (job) {
        stateLabel = job.state;
        if (job.state === 'Running' || job.state === 'Pending') status = 'active';
        else if (job.state === 'Successful') status = 'completed';
        else if (job.state === 'Faulted' || job.state === 'Stopped') status = 'failed';
      }

      return {
        id: `process-${index}`,
        processName,
        label: processName,
        actor: stateLabel,
        status,
        job,
        pos: { x: 40, y: index * 140 }
      };
    });

    const newNodes: Node[] = stepsData.map(node => ({
      id: node.id,
      type: 'custom',
      position: node.pos,
      data: {
        label: node.label,
        actorHint: node.actor,
        status: node.status,
        selected: selectedProcessName === node.processName
      }
    }));

    // Connect them sequentially just for visual flow
    const newEdges: Edge[] = [];
    for (let i = 0; i < stepsData.length - 1; i++) {
      const sourceNode = stepsData[i];
      const targetNode = stepsData[i+1];
      const isAnimated = sourceNode.status === 'active' || targetNode.status === 'active';
      
      newEdges.push({
        id: `e-${sourceNode.id}-${targetNode.id}`,
        source: sourceNode.id,
        target: targetNode.id,
        animated: isAnimated,
        style: isAnimated 
          ? { stroke: 'url(#rainbow-gradient)', strokeWidth: 3, strokeDasharray: '8, 8', animation: 'rainbow-dash 2s linear infinite' }
          : { stroke: '#cbd5e1', strokeWidth: 1.5, opacity: 0.5 },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [contextData, selectedProcessName, setNodes, setEdges]);

  if (!agentId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs p-6 text-center">
        Select an Active Node (Agent) first.
      </div>
    );
  }

  if (loading && !contextData) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const allProcesses: string[] = [];
  const recentJobs: UiPathJob[] = [];
  if (contextData?.tools) {
    contextData.tools.forEach((t: any) => {
      if (t.processes) allProcesses.push(...t.processes);
      if (t.recentJobs) recentJobs.push(...t.recentJobs);
    });
  }

  if (allProcesses.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-60">
        <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 border-dashed flex items-center justify-center mb-4">
          <Terminal className="w-6 h-6 text-slate-300" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">No Processes Found</h3>
        <p className="text-xs text-slate-500 max-w-[200px]">
          This agent doesn't have any UiPath processes available in its folder.
        </p>
      </div>
    );
  }

  const selectedJob = selectedProcessName ? recentJobs.find(j => j.processName === selectedProcessName) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10 flex justify-between items-center shrink-0 shadow-sm">
        <div>
          <h2 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Orchestrator Map
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 font-mono truncate max-w-[150px]">Processes: {allProcesses.length}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col relative">
        
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="25%" stopColor="#ec4899" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="75%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes rainbow-dash {
            0% { stroke-dashoffset: 100; }
            100% { stroke-dashoffset: 0; }
          }
        `}} />

        {/* ReactFlow Canvas */}
        <div className="h-[380px] shrink-0 border-b border-slate-200 bg-slate-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, node) => {
              const processName = (node.data as any).label;
              if (processName) setSelectedProcessName(processName);
            }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background color="#cbd5e1" gap={16} size={1} />
            <Controls className="bg-white border-slate-200 fill-slate-500 shadow-sm" showInteractive={false} />
          </ReactFlow>
        </div>

        {/* Info Area below canvas */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Selected Process</h3>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-xs space-y-2 shadow-sm">
               <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Name</span>
                  <span className="font-semibold text-slate-700">{selectedProcessName || '-'}</span>
               </div>
               <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-slate-400">Latest Job ID</span>
                  <span className="font-mono text-slate-600 truncate max-w-[120px] text-right">{selectedJob ? selectedJob.id : 'No history'}</span>
               </div>
               <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400">State</span>
                  <span className={`font-bold ${
                    selectedJob?.state === 'Successful' ? 'text-emerald-600' :
                    selectedJob?.state === 'Faulted' ? 'text-red-600' :
                    selectedJob?.state === 'Running' ? 'text-indigo-600' :
                    'text-slate-500'
                  }`}>{selectedJob ? selectedJob.state : 'Idle'}</span>
               </div>
            </div>
          </div>

          <div className="space-y-2 pb-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Execution Status & Logs</h3>
            <div className="bg-[#0f172a] rounded-xl p-3 shadow-inner font-mono text-[11px] leading-relaxed relative overflow-hidden min-h-[120px]">
               {selectedJob?.state === 'Running' && (
                 <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />
               )}
               {selectedJob ? (
                  <div className={`${selectedJob.state === 'Faulted' ? 'text-red-400' : 'text-emerald-400'} whitespace-pre-wrap`}>
                    <div className="text-slate-400 mb-2 border-b border-slate-700/50 pb-2">
                      Process started at: {selectedJob.createdAt} <br/>
                      Status: {selectedJob.state}
                    </div>
                    {selectedJob.logs ? (
                      <div className="text-xs">{selectedJob.logs}</div>
                    ) : (
                      <div className="text-slate-500 italic">No logs available.</div>
                    )}
                  </div>
               ) : (
                  <div className="text-slate-500 italic">No job execution history found for this process.</div>
               )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
