/**
 * Image text extraction for knowledge-base document ingestion (apu.md
 * Task 2). No OCR library exists anywhere in this repo (checked before
 * adding a dependency, per apu.md's instruction) — reuses the vision-capable
 * chat model already wired up for playground image attachments
 * (env.NETRA_VL_MODEL / Netra Runtime's on-prem VLM, same
 * ChatOpenAI-over-baseURL branch as engine.ts's runAgenticStep) instead of
 * adding tesseract.js or similar. This also means image ingestion, unlike
 * embedding, stays on-prem-capable when NETRA_MODE=on_prem.
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { env } from '../../config/env.js';

export async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const runtime = env.NETRA_MODE;
  const apiKey = runtime === 'on_prem'
    ? (process.env.NETRA_API_KEY || '')
    : env.NETRA_API_KEY;
  const baseURL = runtime === 'on_prem'
    ? 'https://api.netraruntime.com/v1'
    : env.NETRA_BASE_URL;
  const modelName = runtime === 'on_prem' ? env.NETRA_VL_MODEL : env.NETRA_VL_MODEL;

  const llm = new ChatOpenAI({
    modelName,
    temperature: 0,
    apiKey,
    configuration: { baseURL },
  });

  const base64 = buffer.toString('base64');
  const result = await llm.invoke([
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: 'Extract all readable text verbatim from this image. Preserve line breaks/structure. Output only the extracted text, no commentary.',
        },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    }),
  ]);

  return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
}
