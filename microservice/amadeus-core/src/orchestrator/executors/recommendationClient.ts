/**
 * Chat Recommendation — 2-4 short follow-up suggestions shown as tappable
 * chips after an assistant turn. Ports the prompt wording/shape from legacy
 * Python `others/prompts/recommendation_prompts.py` almost as-is, translated
 * to a TS prompt string and called via `netraChat()` (Netra Runtime) instead
 * of the old langchain ChatOpenAI wrapper.
 *
 * Recommendations are a nice-to-have: on any failure (network, non-JSON
 * response, etc.) this fails quietly and returns [] rather than throwing —
 * it must never block or break the actual chat flow.
 */

import { netraChat } from './netraClient.js';
import { env } from '../../config/env.js';

export interface ConversationTailMessage {
  role: string;
  content: string;
}

const RECOMMENDATION_SYSTEM = `You are a helpful AI assistant. Based on the following conversation history, generate up to 4 relevant chat recommendations. You MUST format your response as a JSON array of strings, with no other text.
Each recommendation should be specific to the user's request, mentioning exact tools, commands, or techniques.

### Response Format ###
You must output ONLY a valid JSON array of strings.
Do not wrap the JSON in markdown code blocks.
Do not include any conversational text like "Here are the recommendations:" or "I hope this helps".
Your entire output should start with '[' and end with ']'.`;

function buildRecommendationPrompt(conversationTail: ConversationTailMessage[]): string {
  const historyText =
    conversationTail.length > 0
      ? conversationTail.map((m) => `${m.role}: ${m.content}`).join('\n')
      : 'No previous messages';

  return `Based on the following conversation history, generate 2-4 relevant follow-up suggestions.
Focus on providing specific, actionable next steps that directly address the user's needs.

Conversation History:
${historyText}

Provide recommendations that are:
1. Directly related to the current conversation
2. Helpful to move the conversation forward
3. Specific and actionable
4. Concise (1 sentence each)`;
}

export async function suggestFollowUps(conversationTail: ConversationTailMessage[]): Promise<string[]> {
  const prompt = buildRecommendationPrompt(conversationTail);
  try {
    const result = await netraChat({
      model: env.NETRA_LLM_MODEL,
      messages: [
        { role: 'system', content: RECOMMENDATION_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 150,
    });
    const parsed = JSON.parse(result.content.trim());
    return Array.isArray(parsed) ? parsed.slice(0, 4).map(String) : [];
  } catch {
    return []; // fail quietly — recommendations are a nice-to-have, never block chat on this
  }
}
