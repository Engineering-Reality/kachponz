import { describe, it, expect } from 'vitest';
import { buildAgentCard } from '../src/orchestrator/a2a/agentCard.js';
import { A2A_PROTOCOL_V1 } from '../src/orchestrator/a2a/protocol_v1.js';

describe('Agent Card Generator', () => {
  it('should generate valid agent card', () => {
    const card = buildAgentCard();
    expect(card.protocol).toBe(A2A_PROTOCOL_V1);
    expect(card.capabilities.length).toBeGreaterThan(0);
    
    // Check if mt_converted is financial
    const mt = card.capabilities.find(c => c.step === 'mt_converted');
    expect(mt).toBeTruthy();
    expect(mt!.financial).toBe(true);
    
    // Check if doc_examined exists
    const doc = card.capabilities.find(c => c.step === 'doc_examined');
    expect(doc).toBeTruthy();
    expect(doc!.financial).toBe(false);

    expect(card.supportedProtocols).toContain('amadeus.a2a/0');
    expect(card.supportedProtocols).toContain('amadeus.a2a/1');
  });
});
