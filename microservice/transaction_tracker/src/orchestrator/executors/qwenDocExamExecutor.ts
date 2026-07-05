/**
 * Qwen VL Executor — menyelesaikan step `doc_examined` (LC/SKBDN/SBLC).
 *
 * Alur:
 *   1. Terima referensi image LC di ctx.data.imageRef (URL / data URI /
 *      base64 sesuai kesepakatan sumber).
 *   2. Kirim ke Qwen VL (qwen-vl-max default) dengan prompt struktur ekstraksi
 *      field-field kunci LC (nomor, applicant, beneficiary, amount, currency,
 *      expiry, incoterm, port of loading/discharge, dokumen wajib).
 *   3. Parse JSON hasil ekstraksi.
 *   4. Kirim hasil ekstraksi ke Qwen text untuk assessment compliance ringan
 *      (misal: field wajib lengkap? tanggal expiry masih valid? amount masuk
 *      akal?). Ini SEBELUM langkah maker/checker manusia — bukan pengganti,
 *      hanya screening awal.
 *   5. Return outcome `completed` dengan resultData berisi ekstraksi + assessment.
 *
 * Keputusan reject/rework akan dilakukan di step berikutnya oleh maker/checker
 * manusia. Executor ini TIDAK memblokir alur; ia hanya menyajikan hasil
 * screening untuk mempercepat maker.
 */

import { z } from 'zod';
import { qwenChat, parseJsonLoose } from './qwenClient.js';
import type { Executor, ExecutorContext, ExecutorOutcome } from './base.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

const ExtractedLcSchema = z
  .object({
    lcNumber: z.string().nullable(),
    issueDate: z.string().nullable(),
    expiryDate: z.string().nullable(),
    applicant: z.string().nullable(),
    beneficiary: z.string().nullable(),
    currency: z.string().nullable(),
    amount: z.union([z.number(), z.string()]).nullable(),
    incoterm: z.string().nullable(),
    portOfLoading: z.string().nullable(),
    portOfDischarge: z.string().nullable(),
    requiredDocuments: z.array(z.string()).default([]),
    partialShipmentAllowed: z.boolean().nullable(),
    transshipmentAllowed: z.boolean().nullable(),
    notes: z.string().nullable(),
  })
  .partial()
  .passthrough();

type ExtractedLc = z.infer<typeof ExtractedLcSchema>;

const AssessmentSchema = z
  .object({
    complete: z.boolean(),
    missingFields: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([]),
    recommendation: z.enum(['proceed', 'review', 'reject']),
    rationale: z.string(),
  })
  .passthrough();

type Assessment = z.infer<typeof AssessmentSchema>;

const EXTRACTION_SYSTEM = `Kamu adalah asisten yang mengekstrak field dari dokumen Letter of Credit (LC/SKBDN/SBLC) untuk keperluan settlement bank.
Kembalikan HANYA JSON valid tanpa penjelasan tambahan. Gunakan null bila field tidak terbaca. Tanggal dalam format ISO 8601 (YYYY-MM-DD).`;

const EXTRACTION_USER_TEXT = `Ekstrak field berikut dari dokumen LC pada gambar. Kembalikan JSON dengan struktur:
{
  "lcNumber": string|null,
  "issueDate": "YYYY-MM-DD"|null,
  "expiryDate": "YYYY-MM-DD"|null,
  "applicant": string|null,
  "beneficiary": string|null,
  "currency": "USD"|"EUR"|"JPY"|"IDR"|... ,
  "amount": number|null,
  "incoterm": "FOB"|"CIF"|"CFR"|... |null,
  "portOfLoading": string|null,
  "portOfDischarge": string|null,
  "requiredDocuments": string[],
  "partialShipmentAllowed": boolean|null,
  "transshipmentAllowed": boolean|null,
  "notes": string|null
}`;

const ASSESSMENT_SYSTEM = `Kamu adalah analis LC bank. Diberikan JSON hasil ekstraksi LC, lakukan screening awal (bukan keputusan final — keputusan tetap oleh maker/checker manusia).
Kembalikan HANYA JSON valid dengan struktur:
{
  "complete": boolean,
  "missingFields": string[],
  "warnings": string[],
  "recommendation": "proceed"|"review"|"reject",
  "rationale": string
}
"proceed" bila lengkap dan tidak ada red flag; "review" bila ada hal yang perlu perhatian tapi tidak fatal; "reject" hanya bila jelas invalid (mis. expired, amount 0, applicant kosong).`;

export const qwenDocExamExecutor: Executor = {
  descriptor: {
    id: 'executor.qwen_vl.doc_exam',
    displayName: 'Qwen VL — LC Document Examination',
    kind: 'llm',
    costUnit: 3,
    capabilities: [
      { step: 'doc_examined', types: ['import_lc', 'skbdn', 'sblc'], financial: false },
    ],
  },

  async run(ctx: ExecutorContext): Promise<ExecutorOutcome> {
    const log = logger.child({
      executor: 'qwen_vl.doc_exam',
      transaction_id: ctx.transactionId,
    });

    const imageRef = ctx.data?.imageRef;
    if (typeof imageRef !== 'string' || imageRef.length === 0) {
      return {
        kind: 'failed',
        reason: 'imageRef dokumen tidak tersedia untuk pemeriksaan',
      };
    }

    // === Langkah 1: ekstraksi field dari image via Qwen VL ===
    let extracted: ExtractedLc;
    let extractionRaw: string;
    try {
      const vlRes = await qwenChat({
        model: env.QWEN_VL_MODEL,
        temperature: 0.1,
        max_tokens: 1024,
        responseJson: true,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_USER_TEXT },
              { type: 'image_url', image_url: { url: imageRef } },
            ],
          },
        ],
      });
      extractionRaw = vlRes.content;
      const parsed = parseJsonLoose(vlRes.content);
      extracted = ExtractedLcSchema.parse(parsed);
    } catch (e) {
      log.error({ err: e }, 'ekstraksi VL gagal');
      return {
        kind: 'failed',
        reason: `Ekstraksi dokumen gagal: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    // === Langkah 2: assessment compliance ringan via Qwen text ===
    let assessment: Assessment;
    try {
      const llmRes = await qwenChat({
        model: env.QWEN_LLM_MODEL,
        temperature: 0.1,
        max_tokens: 512,
        responseJson: true,
        messages: [
          { role: 'system', content: ASSESSMENT_SYSTEM },
          {
            role: 'user',
            content: `Ekstraksi LC:\n${JSON.stringify(extracted, null, 2)}\n\nTanggal hari ini: ${new Date()
              .toISOString()
              .slice(0, 10)}`,
          },
        ],
      });
      const parsed = parseJsonLoose(llmRes.content);
      assessment = AssessmentSchema.parse(parsed);
    } catch (e) {
      log.error({ err: e }, 'assessment gagal');
      // Ekstraksi berhasil tapi assessment gagal — tetap selesaikan step
      // dengan hasil ekstraksi saja + warning; maker manusia akan menilai.
      assessment = {
        complete: false,
        missingFields: [],
        warnings: [
          `Assessment agent gagal (${e instanceof Error ? e.message : 'unknown'}); maker perlu review manual.`,
        ],
        recommendation: 'review',
        rationale: 'Assessment automasi tidak tersedia',
      };
    }

    log.info(
      {
        recommendation: assessment.recommendation,
        missing: assessment.missingFields.length,
        warnings: assessment.warnings.length,
      },
      'doc_exam selesai',
    );

    return {
      kind: 'completed',
      resultData: {
        examinedBy: 'executor.qwen_vl.doc_exam',
        mode: env.QWEN_MODE, // cloud|on_prem — jejak audit
        vlModel: env.QWEN_VL_MODEL,
        llmModel: env.QWEN_LLM_MODEL,
        extracted,
        assessment,
        // JANGAN masukkan extractionRaw ke payload untuk mengurangi surface;
        // kalau perlu untuk debug, simpan hash saja.
        extractionHash: hashString(extractionRaw),
      },
    };
  },
};

function hashString(s: string): string {
  // Ringan; hanya untuk fingerprint jejak audit — bukan kripto.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `sh${(h >>> 0).toString(16)}`;
}
