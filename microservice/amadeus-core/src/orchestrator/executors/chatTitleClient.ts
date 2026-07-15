/**
 * Real chat summaries — an LLM-generated 3-4 word gist of the conversation
 * topic, replacing the frontend's old `generateTopicSummary()` which just
 * truncated the FIRST user message client-side and never looked at the
 * conversation as a whole.
 *
 * Called once per session, right after the first assistant response
 * completes — never re-called on every message (that would waste calls and
 * make the title flicker mid-conversation).
 */

import { qwenChat } from './qwenClient.js';
import { env } from '../../config/env.js';

export interface ChatTitleMessage {
  role: string;
  content: string;
}

const CHAT_TITLE_SYSTEM =
  'Ringkas topik percakapan ini jadi 3-4 kata singkat dalam Bahasa Indonesia, seperti judul chat. Jangan pakai tanda kutip. Balas HANYA judulnya.';

export async function suggestChatTitle(messages: ChatTitleMessage[]): Promise<string> {
  // First few exchanges are usually enough to capture the topic — don't
  // send the whole history for every title generation.
  const transcript = messages
    .slice(0, 6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const result = await qwenChat({
    model: env.QWEN_LLM_MODEL,
    messages: [
      { role: 'system', content: CHAT_TITLE_SYSTEM },
      { role: 'user', content: transcript },
    ],
    temperature: 0.3,
    max_tokens: 20,
  });
  return result.content.trim().replace(/^["']|["']$/g, '');
}
