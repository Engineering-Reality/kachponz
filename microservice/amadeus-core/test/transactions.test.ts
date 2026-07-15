import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  createTransaction,
  completeStep,
  getTransactionWithEvents,
  listTransactions,
  failStep,
} from '../src/services/transactions.js';
import { query } from '../src/db/pool.js';
import { DomainError } from '../src/types/domain.js';
import { truncateAll, seedRobot, closeTestPool } from './helpers.js';

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeTestPool();
});

describe('transactions service (DB-backed)', () => {
  it('create → complete step maju berturut menambah event & memajukan current_step', async () => {
    const { auth } = await seedRobot();
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'idem-create-001' });
    expect(tx.current_step).toBe('submitted');
    expect(tx.version).toBe(1);

    const r1 = await completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'idem-step-001' });
    expect(r1.transaction.current_step).toBe('distributed_to_analyst');
    expect(r1.transaction.version).toBe(2);
    expect(r1.idempotentReplay).toBe(false);

    const detail = await getTransactionWithEvents(tx.id);
    // created + 1 completed
    expect(detail.events).toHaveLength(2);
  });

  it('idempotency: request duplikat (key sama) TIDAK dobel insert', async () => {
    const { auth } = await seedRobot();
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'idem-c' });
    const first = await completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'dup-key' });
    const second = await completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'dup-key' });

    expect(first.idempotentReplay).toBe(false);
    expect(second.idempotentReplay).toBe(true);
    expect(second.event.id).toBe(first.event.id);

    const cnt = await query<{ c: string }>(
      'SELECT count(*)::text AS c FROM transaction_events WHERE transaction_id = $1',
      [tx.id],
    );
    // created + 1 completed (bukan 2 completed)
    expect(cnt.rows[0]!.c).toBe('2');
  });

  it('optimistic lock: update konkuren, salah satu ditolak 409', async () => {
    const { auth } = await seedRobot();
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'idem-c2' });

    // Dua complete step BEDA idempotency key, dijalankan paralel. Keduanya
    // menyelesaikan 'submitted'; hanya satu boleh menang (versi berubah).
    const results = await Promise.allSettled([
      completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'race-a' }),
      completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'race-b' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    // Yang kalah: STEP_MISMATCH (step sudah maju) atau VERSION_CONFLICT — dua-duanya sah.
    const err = (rejected[0] as PromiseRejectedResult).reason;
    expect(err).toBeInstanceOf(DomainError);
    expect(['VERSION_CONFLICT', 'STEP_MISMATCH']).toContain((err as DomainError).code);
  });

  it('menolak menyelesaikan step yang bukan current_step (anti lompat)', async () => {
    const { auth } = await seedRobot();
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'idem-c3' });
    // current = submitted; coba selesaikan 'settled' (lompat) → STEP_MISMATCH
    await expect(
      completeStep(auth, tx.id, { step: 'settled', idempotencyKey: 'jump-1' }),
    ).rejects.toMatchObject({ code: 'STEP_MISMATCH' });
  });

  it('financial gate: step finansial tanpa signature → SIGNATURE_REQUIRED', async () => {
    // robot TIDAK financiallySigned
    const { auth } = await seedRobot({ financial: false });
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'idem-c4' });

    // Maju sampai mt_converted (step finansial pertama).
    const order = ['submitted', 'distributed_to_analyst', 'doc_examined', 'ee_ntf_created', 'ee_ntf_approved'];
    for (let i = 0; i < order.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await completeStep(auth, tx.id, { step: order[i]!, idempotencyKey: `f-${i}` });
    }
    const mid = await getTransactionWithEvents(tx.id);
    expect(mid.transaction.current_step).toBe('mt_converted');

    // Sekarang mt_converted finansial → tanpa signature harus ditolak.
    await expect(
      completeStep(auth, tx.id, { step: 'mt_converted', idempotencyKey: 'fin-nosig' }),
    ).rejects.toMatchObject({ code: 'SIGNATURE_REQUIRED' });

    // Dengan signature (auth.financiallySigned=true) → lolos.
    const signedAuth = { ...auth, financiallySigned: true };
    const ok = await completeStep(signedAuth, tx.id, { step: 'mt_converted', idempotencyKey: 'fin-sig' });
    expect(ok.transaction.current_step).toBe('swift_released');
    expect(ok.event.signed).toBe(true);
  });

  it('event trail immutable: UPDATE/DELETE ditolak trigger DB', async () => {
    const { auth } = await seedRobot();
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'idem-c5' });
    await expect(
      query('UPDATE transaction_events SET reason = $1 WHERE transaction_id = $2', ['x', tx.id]),
    ).rejects.toThrow(/append-only|immutable/i);
    await expect(
      query('DELETE FROM transaction_events WHERE transaction_id = $1', [tx.id]),
    ).rejects.toThrow(/append-only|immutable/i);
  });

  it('list dengan filter status/type & company isolation', async () => {
    const { auth } = await seedRobot();
    await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'l1' });
    await createTransaction(auth, { type: 'skbdn', idempotencyKey: 'l2' });

    const all = await listTransactions({ companyId: auth.companyId, limit: 50 });
    expect(all).toHaveLength(2);
    const onlyLc = await listTransactions({ companyId: auth.companyId, type: 'import_lc', limit: 50 });
    expect(onlyLc).toHaveLength(1);
    expect(onlyLc[0]!.type).toBe('import_lc');

    // company lain tak melihat apa-apa
    const other = await listTransactions({ companyId: '22222222-2222-2222-2222-222222222222', limit: 50 });
    expect(other).toHaveLength(0);
  });

  it('transisi mundur eksplisit (contoh: doc_examined -> distributed_to_analyst)', async () => {
    const { auth } = await seedRobot();
    const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'bwd-c' });
    
    // Maju ke doc_examined
    await completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'bwd-s1' });
    await completeStep(auth, tx.id, { step: 'distributed_to_analyst', idempotencyKey: 'bwd-s2' });
    const mid = await getTransactionWithEvents(tx.id);
    expect(mid.transaction.current_step).toBe('doc_examined');

    // Mundur ke distributed_to_analyst TANPA reason -> DITOLAK
    await expect(
      completeStep(auth, tx.id, { 
        step: 'doc_examined', 
        targetStep: 'distributed_to_analyst', 
        idempotencyKey: 'bwd-no-reason' 
      })
    ).rejects.toMatchObject({ code: 'REASON_REQUIRED' });

    // Mundur DENGAN reason -> SAH
    const result = await completeStep(auth, tx.id, { 
      step: 'doc_examined', 
      targetStep: 'distributed_to_analyst', 
      reason: 'dokumen salah, revisi manual',
      idempotencyKey: 'bwd-reason-ok' 
    });
    
    expect(result.transaction.current_step).toBe('distributed_to_analyst');
    expect(result.event.reason).toBe('dokumen salah, revisi manual');
    expect(result.transaction.version).toBe(4);
  });

  describe('failStep', () => {
    it('mencatat kegagalan tanpa memajukan step, wajib reason, dan mendukung retry', async () => {
      const { auth } = await seedRobot();
      const tx = await createTransaction(auth, { type: 'import_lc', idempotencyKey: 'fs-1' });
      expect(tx.current_step).toBe('submitted');

      // Gagal tanpa reason -> error
      // @ts-expect-error test
      await expect(failStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'fs-fail-no-reason' }))
        .rejects.toMatchObject({ code: 'REASON_REQUIRED' });

      // Gagal step mismatch -> error
      await expect(failStep(auth, tx.id, { step: 'doc_examined', idempotencyKey: 'fs-fail-mismatch', reason: 'salah' }))
        .rejects.toMatchObject({ code: 'STEP_MISMATCH' });

      // Gagal normal
      const f1 = await failStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'fs-fail-1', reason: 'dokumen tidak terbaca' });
      expect(f1.idempotentReplay).toBe(false);
      expect(f1.transaction.current_step).toBe('submitted'); // tidak berubah
      expect(f1.event.status).toBe('failed');
      expect(f1.event.reason).toBe('dokumen tidak terbaca');

      // Replay failure
      const f2 = await failStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'fs-fail-1', reason: 'dokumen tidak terbaca' });
      expect(f2.idempotentReplay).toBe(true);
      expect(f2.transaction.current_step).toBe('submitted');
      
      // Cek jejak audit
      const { events } = await getTransactionWithEvents(tx.id);
      const fails = events.filter(e => e.status === 'failed');
      expect(fails).toHaveLength(1);

      // Retry (berhasil kompensasi)
      const success = await completeStep(auth, tx.id, { step: 'submitted', idempotencyKey: 'fs-succ-1' });
      expect(success.transaction.current_step).toBe('distributed_to_analyst');
      expect(success.event.status).toBe('completed');
    });
  });
});
