import { describe, it, expect } from 'vitest';
import {
  getFlow,
  isForwardTransition,
  isFinancialStep,
  stepExists,
  linearOrder,
  stepIndex,
  isKnownType,
} from '../src/config/stepFlows.js';

describe('stepFlows — data-driven state machine', () => {
  it('mengenali tipe transaksi yang valid', () => {
    expect(isKnownType('import_lc')).toBe(true);
    expect(isKnownType('skbdn')).toBe(true);
    expect(isKnownType('sblc')).toBe(true);
    expect(isKnownType('nasi_goreng')).toBe(false);
  });

  it('linear order import_lc sesuai alur settlement', () => {
    const flow = getFlow('import_lc')!;
    expect(linearOrder(flow)).toEqual([
      'submitted',
      'distributed_to_analyst',
      'doc_examined',
      'ee_ntf_created',
      'ee_ntf_approved',
      'mt_converted',
      'swift_released',
      'settled',
      'advised',
    ]);
  });

  it('transisi maju satu langkah = sah', () => {
    const flow = getFlow('import_lc')!;
    expect(isForwardTransition(flow, 'submitted', 'distributed_to_analyst')).toBe(true);
    expect(isForwardTransition(flow, 'mt_converted', 'swift_released')).toBe(true);
  });

  it('lompat/mundur BUKAN forward transition (kecuali dideklarasikan eksplisit)', () => {
    const flow = getFlow('import_lc')!;
    expect(isForwardTransition(flow, 'submitted', 'settled')).toBe(false); // lompat
    expect(isForwardTransition(flow, 'settled', 'submitted')).toBe(false); // mundur jauh
    
    // Eksplisit mundur (doc_examined -> distributed_to_analyst)
    expect(isForwardTransition(flow, 'doc_examined', 'distributed_to_analyst')).toBe(true);
  });

  it('step finansial ditandai benar (mt_converted, swift_released, settled)', () => {
    const flow = getFlow('import_lc')!;
    expect(isFinancialStep(flow, 'mt_converted')).toBe(true);
    expect(isFinancialStep(flow, 'swift_released')).toBe(true);
    expect(isFinancialStep(flow, 'settled')).toBe(true);
    expect(isFinancialStep(flow, 'doc_examined')).toBe(false);
    expect(isFinancialStep(flow, 'submitted')).toBe(false);
  });

  it('stepExists & stepIndex konsisten', () => {
    const flow = getFlow('import_lc')!;
    expect(stepExists(flow, 'doc_examined')).toBe(true);
    expect(stepExists(flow, 'ghost_step')).toBe(false);
    expect(stepIndex(flow, 'submitted')).toBe(0);
    expect(stepIndex(flow, 'advised')).toBe(8);
    expect(stepIndex(flow, 'ghost_step')).toBe(-1);
  });

  it('step terminal (advised) tidak punya next', () => {
    const flow = getFlow('import_lc')!;
    expect(flow.steps['advised']?.next).toEqual([]);
    expect(flow.steps['advised']?.terminal).toBe(true);
  });
});
