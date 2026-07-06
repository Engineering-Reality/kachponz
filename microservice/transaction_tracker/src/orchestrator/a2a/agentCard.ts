import { A2A_PROTOCOL_V1 } from './protocol_v1.js';
import type { AgentCard } from './protocol_v1.js';
import { STEP_FLOWS } from '../../config/stepFlows.js';

const stepDescriptions: Record<string, string> = {
  submitted: 'Initial submission of LC application',
  distributed_to_analyst: 'Routing to document analyst for examination',
  doc_examined: 'AI-assisted document examination',
  ee_ntf_created: 'Early Warning Notification Draft Creation',
  ee_ntf_approved: 'Early Warning Notification Approval',
  mt_converted: 'Conversion to SWIFT MT 700 format',
  swift_released: 'Release of SWIFT MT message to SAA gateway',
  settled: 'Core banking settlement entry',
  advised: 'Notification back to client (KOPRA)',
};

export function buildAgentCard(): AgentCard {
  const capabilities: AgentCard['capabilities'] = [];
  
  // Collect capabilities from all defined flows
  const allSteps = new Set<string>();
  const stepToTypes: Record<string, Set<string>> = {};
  const stepFinancial: Record<string, boolean> = {};

  for (const [type, flow] of Object.entries(STEP_FLOWS)) {
    for (const [step, def] of Object.entries(flow.steps)) {
      allSteps.add(step);
      if (!stepToTypes[step]) stepToTypes[step] = new Set();
      stepToTypes[step].add(type);
      if (def.financial) stepFinancial[step] = true;
    }
  }

  for (const step of allSteps) {
    capabilities.push({
      step,
      types: Array.from(stepToTypes[step]!),
      financial: stepFinancial[step] || false,
      description: stepDescriptions[step] || 'Standard workflow step',
      inputSchema: { type: 'object', additionalProperties: true }, // To be refined per step later
      outputSchema: { type: 'object', additionalProperties: true }
    });
  }

  return {
    name: 'Amadeus Orchestrator',
    version: '1.0.0', // from package.json conceptually
    protocol: A2A_PROTOCOL_V1,
    description: 'Central orchestrator for Trade Finance settlement flows (Import LC/SKBDN/SBLC)',
    capabilities,
    authentication: {
      schemes: ['robot_key', 'hmac_signature'],
    },
    endpoints: {
      rpc: '/a2a/rpc',
      stream: '/a2a/tasks/{taskId}/stream',
      card: '/.well-known/amadeus-agent-card.json',
    },
    supportedProtocols: ['amadeus.a2a/0', 'amadeus.a2a/1'],
  };
}
