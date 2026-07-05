import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutorRegistry, executorRegistry, type Executor } from '../src/orchestrator/executors/base.js';
import { chooseExecutor } from '../src/orchestrator/executors/router.js';

function mkExec(id: string, kind: 'llm' | 'uipath' | 'pad', costUnit: number, step: string): Executor {
  return {
    descriptor: {
      id,
      displayName: id,
      kind,
      costUnit,
      capabilities: [{ step, types: ['import_lc'], financial: false }],
    },
    async run() {
      return { kind: 'completed' as const };
    },
  };
}

describe('executor router', () => {
  beforeEach(() => {
    // reset registry global
    for (const e of executorRegistry.all()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (executorRegistry as any).byId.delete(e.descriptor.id);
    }
  });

  it('mengembalikan null bila tidak ada executor cocok', () => {
    expect(chooseExecutor('missing_step', 'import_lc')).toBeNull();
  });

  it('memilih satu-satunya kandidat dengan reason=only_option', () => {
    executorRegistry.register(mkExec('e.one', 'llm', 3, 'doc_examined'));
    const d = chooseExecutor('doc_examined', 'import_lc');
    expect(d).not.toBeNull();
    expect(d!.executor.descriptor.id).toBe('e.one');
    expect(d!.reason).toBe('only_option');
  });

  it('memilih costUnit terkecil bila multiple kandidat', () => {
    executorRegistry.register(mkExec('e.uipath', 'uipath', 100, 'ee_ntf_created'));
    executorRegistry.register(mkExec('e.pad', 'pad', 10, 'ee_ntf_created'));
    executorRegistry.register(mkExec('e.llm', 'llm', 3, 'ee_ntf_created'));
    const d = chooseExecutor('ee_ntf_created', 'import_lc');
    expect(d!.executor.descriptor.id).toBe('e.llm');
    expect(d!.reason).toBe('lowest_cost');
    expect(d!.alternatives).toHaveLength(2);
  });
});

describe('ExecutorRegistry', () => {
  it('mencegah dobel registrasi', () => {
    const r = new ExecutorRegistry();
    const e = mkExec('e.dup', 'llm', 1, 'x');
    r.register(e);
    expect(() => r.register(e)).toThrow(/sudah terdaftar/);
  });

  it('findForStep memfilter berdasar step+type', () => {
    const r = new ExecutorRegistry();
    r.register(mkExec('e.lc', 'llm', 1, 'doc_examined'));
    // executor hanya untuk import_lc — cari untuk type lain harus kosong
    const forLc = r.findForStep('doc_examined', 'import_lc');
    const forOther = r.findForStep('doc_examined', 'unknown_type');
    expect(forLc).toHaveLength(1);
    expect(forOther).toHaveLength(0);
  });
});
