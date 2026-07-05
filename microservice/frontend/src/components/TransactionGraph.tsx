"use client";

import { useEffect, useMemo, useState } from 'react';
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

// Custom Node for Vibrant Rainbow Theme
const CustomNode = ({ data, isConnectable }: any) => {
  const isActive = data.status === 'active';
  const isCompleted = data.status === 'completed';
  
  return (
    <div className={`
      relative group rounded-lg overflow-hidden min-w-[200px]
      ${isActive ? 'scale-110 shadow-lg shadow-black/10 z-10' : 'scale-100 z-0'}
      transition-all duration-300
    `}>
      {/* Animated Border for Active Node */}
      {isActive && (
        <div className="absolute inset-0 vibrant-rainbow-border animate-border-spin opacity-100 z-0"></div>
      )}
      
      {/* Node Content */}
      <div className={`
        absolute inset-[2px] rounded-[6px] z-10 flex flex-col p-3
        ${isActive ? 'bg-white' : isCompleted ? 'bg-slate-50' : 'bg-slate-100 border border-slate-200'}
      `}>
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? 'text-blue-600 font-bold' : isCompleted ? 'text-slate-500' : 'text-slate-400'}`}>
            {data.actorHint}
          </span>
        </div>
        <div className={`font-mono text-sm uppercase ${isActive ? 'text-slate-900 font-bold' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}>
          {data.label}
        </div>
        {isActive && (
          <div className="mt-2 text-[9px] text-blue-500 uppercase tracking-widest animate-pulse font-bold">
            Processing...
          </div>
        )}
      </div>

      {/* Invisible spacer */}
      <div className="p-[2px] invisible">
        <div className="p-3">
          <div className="mb-2 text-[10px]">{data.actorHint}</div>
          <div className="text-sm">{data.label}</div>
          {isActive && <div className="mt-2 text-[9px]">Processing...</div>}
        </div>
      </div>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="opacity-0" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const importLcSteps = [
  { id: 'submitted', label: 'Submitted', actor: 'Contact Point' },
  { id: 'distributed_to_analyst', label: 'Distribute', actor: 'RPA Distributor' },
  { id: 'doc_examined', label: 'Doc Examination', actor: 'VisionOCR Agent' },
  { id: 'ee_ntf_created', label: 'Create EE/NTF', actor: 'Maker Agent' },
  { id: 'ee_ntf_approved', label: 'Approve EE/NTF', actor: 'Human Checker' },
  { id: 'mt_converted', label: 'MT Conversion', actor: 'RPA MT Converter' },
  { id: 'swift_released', label: 'SWIFT Release', actor: 'SAA Gateway' },
  { id: 'settled', label: 'Settlement', actor: 'Settlement Engine' },
  { id: 'advised', label: 'Advise Client', actor: 'Kopra Notify' }
];

export function TransactionGraph({ currentStep }: { currentStep: string | null }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    let currentFound = false;
    
    const newNodes: Node[] = importLcSteps.map((step, index) => {
      let status = 'pending';
      if (!currentStep) {
        status = 'pending';
      } else if (step.id === currentStep) {
        status = 'active';
        currentFound = true;
      } else if (!currentFound) {
        status = 'completed';
      }

      return {
        id: step.id,
        type: 'custom',
        position: { x: 50, y: index * 120 },
        data: { label: step.label, actorHint: step.actor, status }
      };
    });

    const newEdges: Edge[] = [];
    for (let i = 0; i < importLcSteps.length - 1; i++) {
      const source = importLcSteps[i].id;
      const target = importLcSteps[i+1].id;
      
      const sourceNodeIndex = newNodes.findIndex(n => n.id === source);
      const isCompletedOrActive = newNodes[sourceNodeIndex].data.status !== 'pending';
      
      newEdges.push({
        id: `e-${source}-${target}`,
        source,
        target,
        animated: newNodes[sourceNodeIndex].data.status === 'active' || (isCompletedOrActive && newNodes[sourceNodeIndex + 1].data.status === 'active'),
        style: { stroke: isCompletedOrActive ? '#3b82f6' : '#cbd5e1', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCompletedOrActive ? '#3b82f6' : '#cbd5e1',
        },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [currentStep, setNodes, setEdges]);

  return (
    <div className="w-full h-full bg-slate-50 border-none rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={16} size={1} />
        <Controls 
          className="bg-white border-slate-200 fill-slate-500 shadow-sm" 
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
