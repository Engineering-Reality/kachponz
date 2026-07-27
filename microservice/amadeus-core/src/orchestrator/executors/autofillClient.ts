/**
 * Magic Pen Autofill — suggests a value for a single Agent Creator form
 * field, given whatever other fields are already filled in as context.
 *
 * Uses openrouterChat() for text-in/text-out LLM calls.
 */

import { openrouterChat } from './openrouterClient.js';
import { env } from '../../config/env.js';

export interface AutofillRequest {
  /** e.g. "description", "system_prompt" */
  fieldName: string;
  /** Whatever the form already has filled in (agent name, selected tools, etc.) */
  fieldContext: Record<string, unknown>;
  /** Partial text already typed, if any — treated as a continuation, not overwritten */
  currentValue?: string;
}

const AUTOFILL_SYSTEM =
  'You suggest concise, professional field values for an agent-creation form. Respond with ONLY the suggested value, no preamble, no quotes.';

function buildAutofillPrompt(req: AutofillRequest): string {
  const { fieldName, fieldContext, currentValue } = req;

  let prompt = `Fill in the field: **${fieldName}**.\n`;
  if (currentValue?.trim()) {
    prompt += `- Existing value (continue/refine this, don't start over): ${currentValue}\n`;
  }

  prompt += '\n### Context (other fields already filled in) ###\n';
  const entries = Object.entries(fieldContext);
  if (entries.length === 0) {
    prompt += '(none provided)\n';
  } else {
    for (const [key, value] of entries) {
      prompt += `- ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}\n`;
    }
  }

  prompt += '\n### Instructions ###\n';
  prompt += `- Analyze the context above (especially agent name/description) to determine an appropriate suggestion for "${fieldName}".\n`;
  prompt += '- Output ONLY the completed field value as plain text — no JSON/markdown wrapping, no explanation.\n';

  return prompt;
}

export async function suggestFieldValue(req: AutofillRequest): Promise<string> {
  const prompt = buildAutofillPrompt(req);
  const result = await openrouterChat({
    model: env.OPENROUTER_LLM_MODEL,
    messages: [
      { role: 'system', content: AUTOFILL_SYSTEM },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 200,
    callSite: 'autofill',
  });
  return result.content.trim();
}
