/**
 * Image text extraction for knowledge-base document ingestion (apu.md
 * Task 2). No OCR library exists anywhere in this repo — reuses the
 * vision-capable chat model already wired up for playground image
 * attachments (env.OPENROUTER_VL_MODEL via OpenRouter API).
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { env } from '../../config/env.js';
import { logLlmUsageEvent, measurementBodyOverrides } from '../../telemetry/llmUsage.js';

export async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const telemetryFetch: typeof fetch = async (input, init) => {
    const res = await fetch(input, init);
    if (env.LLM_USAGE_TELEMETRY) {
      res
        .clone()
        .json()
        .then((json: any) => {
          void logLlmUsageEvent({
            callSite: 'visionExtract',
            modelSlug: json?.model ?? env.OPENROUTER_VL_MODEL,
            modelKind: 'vision',
            provider: json?.provider,
            imageCount: 1,
            promptTokens: json?.usage?.prompt_tokens,
            completionTokens: json?.usage?.completion_tokens,
            totalTokens: json?.usage?.total_tokens,
            reasoningTokens: json?.usage?.completion_tokens_details?.reasoning_tokens,
            finishReason: json?.choices?.[0]?.finish_reason,
            stream: false,
          });
        })
        .catch(() => {
          /* best-effort telemetry only */
        });
    }
    return res;
  };

  const llm = new ChatOpenAI({
    modelName: env.OPENROUTER_VL_MODEL,
    temperature: 0,
    modelKwargs: { ...measurementBodyOverrides() },
    apiKey: env.OPENROUTER_API_KEY ?? '',
    configuration: {
      baseURL: env.OPENROUTER_BASE_URL,
      fetch: env.LLM_USAGE_TELEMETRY ? telemetryFetch : undefined,
    },
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
