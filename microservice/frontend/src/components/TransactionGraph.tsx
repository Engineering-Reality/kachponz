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
import { X, CheckCircle, Clock, Shield, AlertTriangle } from 'lucide-react';

const CustomNode = ({ data, isConnectable }: any) => {
  const isActive = data.status === 'active';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  
  let nodeStyle = '';
  let textColor = '';
  
  if (isActive) {
    nodeStyle = 'backdrop-blur-md bg-white/90 border-transparent shadow-[0_15px_35px_rgba(99,102,241,0.25)]';
    textColor = 'text-indigo-600';
  } else if (isCompleted) {
    nodeStyle = 'backdrop-blur-md bg-emerald-50/80 border-emerald-200/60 shadow-[0_8px_20px_rgba(16,185,129,0.05)]';
    textColor = 'text-emerald-700';
  } else if (isFailed) {
    nodeStyle = 'backdrop-blur-md bg-red-50/80 border-red-200/60 shadow-[0_8px_20px_rgba(239,68,68,0.05)]';
    textColor = 'text-red-700';
  } else {
    nodeStyle = 'backdrop-blur-sm bg-slate-50/60 border-slate-200/40 shadow-sm opacity-75';
    textColor = 'text-slate-400';
  }

  return (
    <div className={`relative group rounded-xl overflow-hidden min-w-[200px] cursor-pointer transition-all duration-500 ${isActive ? 'scale-105 z-20' : 'scale-100 z-10'} ${data.selected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}>
      {isActive && (
        <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-100 z-0 pointer-events-none"></div>
      )}
      <div className={`relative z-10 flex flex-col p-4 border-[1.5px] rounded-xl ${nodeStyle} hover:brightness-[0.98] transition-all duration-300`}>
        <div className="flex justify-between items-center mb-2">
          <span className={`text-[9px] font-mono ${textColor} font-medium flex items-center gap-1.5`}>
            {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
            {isFailed && <AlertTriangle className="w-3.5 h-3.5" />}
            {data.actorHint}
          </span>
        </div>
        <div className={`font-semibold text-xs ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
          {data.label}
        </div>
        {isActive && (
          <div className="mt-2.5 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
             <div className="w-2 h-2 rounded-full bg-indigo-500 absolute" />
             <span className="text-[9px] text-indigo-600 font-medium animate-pulse">Running Agent Protocol...</span>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-2.5 h-2.5 !bg-indigo-400 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-2.5 h-2.5 !bg-indigo-400 border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// Based on the provided Trade Finance LC diagram
const graphNodesData = [
  { id: 'applicant', label: 'Pembeli / Applicant', actor: 'Client', pos: { x: 0, y: 150 } },
  { id: 'submitted', label: 'Input Aplikasi LC via KOPRA', actor: 'Portal KOPRA', pos: { x: 280, y: 250 } },
  { id: 'tsc', label: 'Register di EE', actor: 'TSC', pos: { x: 280, y: 50 } },
  { id: 'distributed_to_analyst', label: 'CTO / TOI', actor: 'RPA 1 Distribusi', pos: { x: 560, y: 150 } },
  { id: 'doc_examined', label: 'New RPA > Agentic AI', actor: 'AI Document Scanner', pos: { x: 840, y: 250 } },
  { id: 'ee_ntf_created', label: 'Maker Modify Transaction', actor: 'Eximbills Maker', pos: { x: 1120, y: 100 } },
  { id: 'ee_ntf_approved', label: 'Checker Verifikasi Otorisasi', actor: 'Human Checker', pos: { x: 1120, y: 200 } },
  { id: 'mt_converted', label: 'Completion Template', actor: 'RPA 2', pos: { x: 1400, y: 150 } },
  { id: 'swift_released', label: 'Release SWIFT', actor: 'Gateway', pos: { x: 1680, y: 150 } },
  { id: 'settled', label: 'Terbit LC', actor: 'Settlement Engine', pos: { x: 1960, y: 150 } }
];

const graphEdgesData = [
  { source: 'applicant', target: 'tsc', label: 'Kirim Email' },
  { source: 'applicant', target: 'submitted', label: 'Input' },
  { source: 'tsc', target: 'distributed_to_analyst' },
  { source: 'submitted', target: 'distributed_to_analyst', label: 'STP' },
  { source: 'distributed_to_analyst', target: 'doc_examined', label: 'RPA 2 / AI' },
  { source: 'doc_examined', target: 'ee_ntf_created' },
  { source: 'ee_ntf_created', target: 'ee_ntf_approved' },
  { source: 'ee_ntf_approved', target: 'mt_converted' },
  { source: 'mt_converted', target: 'swift_released' },
  { source: 'swift_released', target: 'settled' }
];

// Linear sequence used just to determine if a node is past or future for coloring
const sequence = [
  ['applicant'],
  ['submitted', 'tsc'],
  ['distributed_to_analyst'],
  ['doc_examined'],
  ['ee_ntf_created'],
  ['ee_ntf_approved'],
  ['mt_converted'],
  ['swift_released'],
  ['settled']
];

export function TransactionGraph({ tx, events }: { tx: any, events: any[] }) {
  const currentStep = tx?.current_step || null;
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    let currentIdx = -1;
    if (currentStep) {
      currentIdx = sequence.findIndex(group => group.includes(currentStep));
    }

    const completedSteps = new Set((events || []).filter(e => e.event_type === 'step_completed').map(e => e.step));
    
    // Explicit overrides for the mock nodes (applicant, tsc)
    if (currentIdx >= 1) completedSteps.add('applicant');
    if (currentIdx >= 2) completedSteps.add('tsc');

    const newNodes: Node[] = graphNodesData.map((nodeData) => {
      let status = 'pending';
      if (tx?.status === 'completed' || completedSteps.has(nodeData.id)) {
        status = 'completed';
      } else if (currentStep === nodeData.id && tx?.status !== 'failed') {
        status = 'active';
      } else if (currentStep === nodeData.id && tx?.status === 'failed') {
        status = 'failed';
      } else if (currentIdx !== -1) {
        const nodeIdx = sequence.findIndex(group => group.includes(nodeData.id));
        if (nodeIdx < currentIdx) status = 'completed'; // Fallback auto-complete
      }

      return {
        id: nodeData.id,
        type: 'custom',
        position: nodeData.pos,
        data: { 
          label: nodeData.label, 
          actorHint: nodeData.actor, 
          status,
          selected: selectedNode?.id === nodeData.id 
        }
      };
    });

    const newEdges: Edge[] = graphEdgesData.map((edgeData) => {
      const sourceNode = newNodes.find(n => n.id === edgeData.source);
      const targetNode = newNodes.find(n => n.id === edgeData.target);
      const isCompletedOrActive = sourceNode?.data.status !== 'pending' && sourceNode?.data.status !== 'failed';
      const isAnimated = sourceNode?.data.status === 'active' || (isCompletedOrActive && targetNode?.data.status === 'active');
      
      return {
        id: `e-${edgeData.source}-${edgeData.target}`,
        source: edgeData.source,
        target: edgeData.target,
        animated: isAnimated,
        label: edgeData.label,
        labelStyle: { fill: '#4f46e5', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.95 },
        style: isAnimated 
          ? { stroke: 'url(#rainbow-gradient)', strokeWidth: 4, strokeDasharray: '8, 8', animation: 'rainbow-dash 2s linear infinite' }
          : { stroke: isCompletedOrActive ? '#6366f1' : '#cbd5e1', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isAnimated ? '#a855f7' : (isCompletedOrActive ? '#6366f1' : '#cbd5e1'),
        },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [tx, events, selectedNode, setNodes, setEdges]);

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
  };

  const selectedNodeEvents = useMemo(() => {
    if (!selectedNode || !events) return [];
    return events.filter(e => e.step === selectedNode.id).reverse();
  }, [selectedNode, events]);

  return (
    <div className="w-full h-full bg-slate-50 border-none rounded-lg overflow-hidden relative flex">
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <linearGradient id="rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="25%" stopColor="#ec4899" />
            <stop offset="50%" stopColor="#f43f5e" />
            <stop offset="75%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
        >
          <Background color="#cbd5e1" gap={16} size={1} />
          <Controls 
            className="bg-white border-slate-200 fill-slate-500 shadow-sm" 
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {/* Side Panel Drawer */}
      <div className={`absolute right-0 top-0 bottom-0 w-80 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200 transition-transform duration-300 ease-in-out z-30 flex flex-col ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedNode && (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="text-[10px] font-medium text-blue-600 mb-1">{selectedNode.data.actorHint}</div>
                <h3 className="text-sm font-medium text-slate-800">{selectedNode.data.label}</h3>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="mb-6">
                <h4 className="text-[10px] font-medium text-slate-500 mb-2">Agent Context</h4>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Environment</span>
                    <span className="font-mono">Air-gapped (On-Prem)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-400">Step ID</span>
                    <span className="font-mono">{selectedNode.id}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Status</span>
                    <span className="font-medium capitalize">{selectedNode.data.status}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-medium text-slate-500 mb-2">Execution Logs</h4>
                {selectedNodeEvents.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    <Clock className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    No logs available for this step yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedNodeEvents.map((evt, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 text-[11px] shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${evt.event_type === 'step_completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {evt.event_type}
                          </span>
                          <span className="text-slate-400 font-mono">{new Date(evt.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="mb-1">
                          <span className="text-slate-400">Actor:</span> <span className="font-medium text-slate-700">{evt.actor}</span>
                        </div>
                        {evt.reason && (
                          <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 italic">
                            "{evt.reason}"
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>{evt.idempotency_key?.substring(0,16)}...</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
