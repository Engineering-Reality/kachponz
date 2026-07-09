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
import { RefreshCw, Terminal, AlertTriangle, CheckCircle, Clock, Play, Bot, Layers, Zap } from 'lucide-react';

const VerticalCustomNode = ({ data, isConnectable }: any) => {
  const isActive = data.status === 'active';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const theme = data.theme || 'rainbow';
  
  let wrapperStyle = '';
  let nodeStyle = '';
  let titleColor = '';
  let labelColor = '';
  
  if (theme === 'blue') {
     wrapperStyle = 'bg-blue-400 p-[1.5px] transition-all duration-300 group-hover:p-[2px] group-hover:shadow-[0_8px_20px_rgba(59,130,246,0.3)]';
     nodeStyle = 'bg-blue-50';
     titleColor = 'text-blue-600';
     labelColor = 'text-slate-800';
  } else if (theme === 'yellow') {
     wrapperStyle = 'bg-amber-400 p-[1.5px] transition-all duration-300 group-hover:p-[2px] group-hover:shadow-[0_8px_20px_rgba(251,191,36,0.3)]';
     nodeStyle = 'bg-amber-50';
     titleColor = 'text-amber-700';
     labelColor = 'text-slate-800';
  } else {
    if (isActive) {
      wrapperStyle = 'vibrant-rainbow-border animate-border-spin p-[2px] shadow-[0_15px_35px_rgba(99,102,241,0.4)]';
      nodeStyle = 'bg-black/20 backdrop-blur-md';
      titleColor = 'text-white drop-shadow-md';
      labelColor = 'text-white drop-shadow-md';
    } else {
      wrapperStyle = 'vibrant-rainbow-border p-[1.5px] transition-all duration-300 group-hover:p-[2px] group-hover:shadow-[0_8px_20px_rgba(99,102,241,0.2)]';
      nodeStyle = 'bg-white';
      titleColor = isFailed ? 'text-red-500' : 'text-slate-500';
      labelColor = 'text-slate-700';
    }
  }

  const showTopHandle = theme !== 'blue';
  const showBottomHandle = theme !== 'blue';
  const handleColor = theme === 'yellow' ? '!bg-amber-400' : '!bg-indigo-400';

  return (
    <div className={`relative group rounded-xl w-[260px] cursor-pointer transition-all duration-500 ${isActive ? 'scale-105 z-20' : 'scale-100 z-10 hover:scale-[1.02]'}`}>
      {showTopHandle && (
        <Handle type="target" position={Position.Top} isConnectable={isConnectable} className={`w-2.5 h-2.5 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${handleColor}`} />
      )}
      
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
          <div className={`font-semibold text-sm ${labelColor} flex items-center gap-2 mt-1`}>
            {theme === 'blue' && <Bot className="w-4 h-4 opacity-75" />}
            {theme === 'yellow' && <Layers className="w-4 h-4 opacity-75" />}
            {theme === 'rainbow' && <Zap className="w-4 h-4 opacity-75" />}
            <span className="truncate">{data.label}</span>
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

      {showBottomHandle && (
        <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className={`w-2.5 h-2.5 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${handleColor}`} />
      )}
    </div>
  );
};

const nodeTypes = {
  custom: VerticalCustomNode,
};

type UiPathJob = { id: string; key: string; processName: string; state: string; createdAt: string; info?: string; logs?: string; };

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
  
  const [selectedNode, setSelectedNode] = useState<{ id: string; type: 'Agent' | 'Queue' | 'Process'; name: string } | null>(null);

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
    const allQueues: { name: string; pendingCount: number | null }[] = [];
    const recentJobs: UiPathJob[] = [];
    
    contextData.tools.forEach((t: any) => {
      if (t.processes) allProcesses.push(...t.processes);
      if (t.queues) allQueues.push(...t.queues);
      if (t.recentJobs) recentJobs.push(...t.recentJobs);
    });

    if (allProcesses.length === 0 && allQueues.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    if (!selectedNode && allProcesses.length > 0) {
      setSelectedNode({ id: 'process-0', type: 'Process', name: allProcesses[0] });
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let currentY = 0;

    // 1. Agent Node (Observer)
    newNodes.push({
      id: 'agent-node',
      type: 'custom',
      position: { x: 40, y: currentY },
      data: {
        label: `Agent ${agentId ? agentId.slice(0, 8) : 'Unknown'}`,
        nodeType: 'Agent',
        actorHint: 'OBSERVER',
        status: 'pending',
        theme: 'blue',
      }
    });
    currentY += 140;

    // 2. Queue Nodes
    const queueNodeIds: string[] = [];
    allQueues.forEach((q, i) => {
      const qId = `queue-${i}`;
      queueNodeIds.push(qId);
      newNodes.push({
        id: qId,
        type: 'custom',
        position: { x: 40, y: currentY },
        data: {
          label: q.name,
          nodeType: 'Queue',
          actorHint: `QUEUE: ${q.pendingCount !== null ? q.pendingCount : '?'} pending`,
          status: 'pending',
          theme: 'yellow',
        }
      });
      currentY += 140;
    });

    // 3. Process Nodes
    const processNodeIds: string[] = [];
    allProcesses.forEach((processName, i) => {
      const pId = `process-${i}`;
      processNodeIds.push(pId);
      
      const job = recentJobs.find(j => j.processName === processName);
      let status = 'pending';
      let stateLabel = 'Idle';
      if (job) {
        stateLabel = job.state;
        if (job.state === 'Running' || job.state === 'Pending') status = 'active';
        else if (job.state === 'Successful') status = 'completed';
        else if (job.state === 'Faulted' || job.state === 'Stopped') status = 'failed';
      }

      newNodes.push({
        id: pId,
        type: 'custom',
        position: { x: 40, y: currentY },
        data: {
          label: processName,
          nodeType: 'Process',
          actorHint: stateLabel,
          status,
          job,
          theme: 'rainbow',
          selected: selectedNode?.name === processName
        }
      });
      currentY += 140;
    });

    // 4. Edges Construction
    if (queueNodeIds.length > 0 && processNodeIds.length > 0) {
      // Connect all queues to all processes (M:N mapping visual representation)
      queueNodeIds.forEach(qId => {
        processNodeIds.forEach(pId => {
          newEdges.push({
            id: `e-${qId}-${pId}`,
            source: qId,
            target: pId,
            animated: true,
            style: { stroke: '#fbbf24', strokeWidth: 2, opacity: 0.7 },
          });
        });
      });
    } else if (processNodeIds.length > 1) {
      // If no queues, just connect processes sequentially for a nice flow
      for (let i = 0; i < processNodeIds.length - 1; i++) {
        const sourceNode = newNodes.find(n => n.id === processNodeIds[i]);
        const targetNode = newNodes.find(n => n.id === processNodeIds[i+1]);
        const isAnimated = sourceNode?.data.status === 'active' || targetNode?.data.status === 'active';
        
        newEdges.push({
          id: `e-${processNodeIds[i]}-${processNodeIds[i+1]}`,
          source: processNodeIds[i],
          target: processNodeIds[i+1],
          animated: isAnimated,
          style: isAnimated 
            ? { stroke: 'url(#rainbow-gradient)', strokeWidth: 3, strokeDasharray: '8, 8', animation: 'rainbow-dash 2s linear infinite' }
            : { stroke: '#cbd5e1', strokeWidth: 1.5, opacity: 0.5 },
        });
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [contextData, selectedNode, agentId, setNodes, setEdges]);

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
  const allQueues: { name: string; pendingCount: number | null; logs?: string }[] = [];
  const recentJobs: UiPathJob[] = [];
  if (contextData?.tools) {
    contextData.tools.forEach((t: any) => {
      if (t.processes) allProcesses.push(...t.processes);
      if (t.queues) allQueues.push(...t.queues);
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
              const label = (node.data as any).label;
              const nodeType = (node.data as any).nodeType || 'Process';
              if (label) setSelectedNode({ id: node.id, type: nodeType, name: label });
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
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
               {selectedNode?.type === 'Agent' ? 'Agent Details' : selectedNode?.type === 'Queue' ? 'Queue Details' : 'Process Details'}
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-xs space-y-2 shadow-sm">
               {selectedNode?.type === 'Agent' && (
                 <>
                   <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-slate-400">Type</span>
                      <span className="font-semibold text-blue-600">Amadeus MCP Agent</span>
                   </div>
                   <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-400">Status</span>
                      <span className="font-bold text-emerald-600">Online & Polling</span>
                   </div>
                 </>
               )}
               {selectedNode?.type === 'Queue' && (() => {
                 const qData = allQueues.find(q => q.name === selectedNode.name);
                 return (
                   <>
                     <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <span className="text-slate-400">Name</span>
                        <span className="font-semibold text-slate-700">{selectedNode.name}</span>
                     </div>
                     <div className="flex justify-between items-center pt-1">
                        <span className="text-slate-400">Pending Items</span>
                        <span className="font-bold text-amber-600">{qData?.pendingCount ?? '?'}</span>
                     </div>
                   </>
                 );
               })()}
               {(!selectedNode || selectedNode.type === 'Process') && (() => {
                 const pName = selectedNode?.name || allProcesses[0];
                 const selectedJob = recentJobs.find(j => j.processName === pName);
                 return (
                   <>
                     <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                        <span className="text-slate-400">Name</span>
                        <span className="font-semibold text-slate-700">{pName || '-'}</span>
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
                   </>
                 );
               })()}
            </div>
          </div>

          <div className="space-y-2 pb-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">
               {selectedNode?.type === 'Agent' ? 'Agent MCP Logs' : selectedNode?.type === 'Queue' ? 'Queue Transactions Logs' : 'Execution Status & Logs'}
            </h3>
            <div className="bg-[#0f172a] rounded-xl p-3 shadow-inner font-mono text-[11px] leading-relaxed relative overflow-hidden min-h-[120px]">
               {selectedNode?.type === 'Agent' && (() => {
                 let agentLogsText = '';
                 if (contextData?.tools) {
                   contextData.tools.forEach((t: any) => { if (t.agentLogs) agentLogsText += t.agentLogs + '\n'; });
                 }
                 return <div className="text-blue-300 whitespace-pre-wrap">{agentLogsText || 'No logs available.'}</div>;
               })()}
               {selectedNode?.type === 'Queue' && (() => {
                 const qData = allQueues.find(q => q.name === selectedNode.name);
                 return <div className="text-amber-300 whitespace-pre-wrap text-xs">{qData?.logs || 'No logs available.'}</div>;
               })()}
               {(!selectedNode || selectedNode.type === 'Process') && (() => {
                 const pName = selectedNode?.name || allProcesses[0];
                 const selectedJob = recentJobs.find(j => j.processName === pName);
                 return (
                   <>
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
                   </>
                 );
               })()}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
