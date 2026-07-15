# Prompt #14 — Amadeus: Magic Pen Autofill, Typing Indicator, Chat Recommendation, Real Chat Summaries

Four related chat-experience features, grouped together because they all reuse the
same lightweight pattern: a small, cheap LLM call through the existing `qwenChat()`
(Netra Runtime) client — none of these need a custom model. This is explicitly NOT a
port of the legacy Python VLM-based autofill (Gemma-2 2B + CLIP, `custom_vlm_model.py`)
— that model is too heavy for the 2GB RAM deploy target and is being left behind, not
reused.

## Context — read this before touching anything

1. `microservice/amadeus-core/src/orchestrator/executors/qwenClient.ts` — the
   existing, compliance-documented `qwenChat()` function (Prompt 11). Every new LLM
   call in this prompt goes through this, not a new client.
2. Legacy Python `agent_creator/tool_autofill.py` and
   `agent_field_autofill/agent_field_autofill.py` — study these for WHAT gets
   autofilled and the prompt shape used to generate suggestions, but not for HOW
   (the how — a local VLM — is exactly what's being replaced).
3. Legacy Python `others/prompts/recommendation_prompts.py` — the chat recommendation
   prompt shape (JSON array of 2-4 follow-up suggestions). This one ports over almost
   as-is, just translated to a TS prompt string and called via `qwenChat()`.
4. `microservice/frontend/src/app/(protected)/playground/page.tsx` line 78 —
   `generateTopicSummary()`, the current chat-title logic. It truncates the FIRST user
   message to ~5 words client-side — it never looks at the conversation as a whole.
   This is the bug Jandy is describing ("bukan dilihatin dialog pertamanya, tapi
   intisari chat").

## Part A — Magic Pen Autofill (lightweight, TS + Netra Runtime)

Scope: autofill suggestions for Agent Creator form fields (agent description, system
prompt hints, tool selection rationale — whatever fields `tool_autofill.py` covers),
using a normal text-in/text-out LLM call, no vision/image input.

1. Add `microservice/amadeus-core/src/orchestrator/executors/autofillClient.ts`:

```ts
import { qwenChat } from "./qwenClient.js";

export interface AutofillRequest {
  fieldName: string;          // e.g. "description", "system_prompt"
  fieldContext: Record<string, unknown>; // whatever the form already has filled in —
                                          // agent name, selected tools, etc. — used
                                          // as context, ported from what
                                          // tool_autofill.py already gathers
  currentValue?: string;      // partial text already typed, if any
}

export async function suggestFieldValue(req: AutofillRequest): Promise<string> {
  const prompt = buildAutofillPrompt(req); // port the prompting logic/shape from
                                            // tool_autofill.py's equivalent function —
                                            // reuse its structure, not its VLM call
  const result = await qwenChat({
    model: "qwen-plus", // or whatever model string Prompt 11's test script confirmed working
    messages: [
      { role: "system", content: "You suggest concise, professional field values for an agent-creation form. Respond with ONLY the suggested value, no preamble, no quotes." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_tokens: 200,
  });
  return result.content.trim();
}
```

2. Add `POST /orchestrator/autofill/suggest` in `routes.ts` wrapping
   `suggestFieldValue`.
3. Frontend: in `agent-creator/page.tsx`, add a small "✨" (magic pen) button next to
   the relevant fields. On click, call the endpoint, populate the field with the
   suggestion — don't auto-apply without the user seeing it first, always show it as
   an editable suggestion the user accepts or changes.

## Part B — Typing indicator while the agent composes

Right now there's no loading/typing state at all in `playground/page.tsx` — the UI
gives no feedback between "message sent" and "first token arrives." Add one.

1. Add a state flag around the existing send/stream logic:

```tsx
const [isAgentTyping, setIsAgentTyping] = useState(false);

// set true right when the request is sent, before any SSE token arrives
setIsAgentTyping(true);
// ...existing fetch/SSE setup...
// set false the moment the FIRST token/chunk arrives, not when the stream ends —
// once real content is rendering, the typing indicator's job is done
```

2. Render a simple animated indicator (three bouncing dots, or a "mengetik..." label)
   in the message list, in the agent's message slot, only while `isAgentTyping` is
   true and no content has streamed in yet:

```tsx
{isAgentTyping && (
  <div className="flex items-center gap-1 text-sm text-muted-foreground px-3 py-2">
    <span className="animate-bounce">●</span>
    <span className="animate-bounce [animation-delay:0.15s]">●</span>
    <span className="animate-bounce [animation-delay:0.3s]">●</span>
  </div>
)}
```

3. Make sure `isAgentTyping` gets set back to `false` on stream error too (not just on
   first token) — an indicator that never goes away on a failed request looks broken,
   not just unfinished.

## Part C — Chat Recommendation (port from Python, lightweight)

1. Add
   `microservice/amadeus-core/src/orchestrator/executors/recommendationClient.ts`:

```ts
import { qwenChat } from "./qwenClient.js";

export async function suggestFollowUps(conversationTail: { role: string; content: string }[]): Promise<string[]> {
  const prompt = buildRecommendationPrompt(conversationTail); // port the exact prompt
                                                               // shape/wording from
                                                               // recommendation_prompts.py
  const result = await qwenChat({
    model: "qwen-plus",
    messages: [
      { role: "system", content: "Return ONLY a JSON array of 2-4 short follow-up message suggestions, no other text." },
      { role: "user", content: prompt },
    ],
    temperature: 0.6,
    max_tokens: 150,
  });
  try {
    const parsed = JSON.parse(result.content.trim());
    return Array.isArray(parsed) ? parsed.slice(0, 4).map(String) : [];
  } catch {
    return []; // fail quietly — recommendations are a nice-to-have, never block chat on this
  }
}
```

2. Call `suggestFollowUps()` after each assistant turn completes (not before — needs
   the assistant's response as context), pass the last 4-6 messages as
   `conversationTail`. Cache/debounce so it's not re-called on every re-render.
3. Frontend: render the returned suggestions as tappable chips below the latest
   assistant message — tapping one sends it as the next user message, same as if
   typed. If the array is empty (parse failure or genuinely no good suggestions),
   render nothing — don't show an empty chip row.

## Part D — Real chat summaries instead of first-message truncation

Replace `generateTopicSummary()`'s client-side truncation with an actual LLM-generated
gist of the conversation, matching what Jandy described (like ChatGPT's 3-4 word chat
titles).

1. Add `suggestChatTitle()` alongside the other two clients:

```ts
export async function suggestChatTitle(messages: { role: string; content: string }[]): Promise<string> {
  const transcript = messages.slice(0, 6) // first few exchanges are usually enough to
                                            // capture the topic — don't send the whole
                                            // history for every title generation
    .map(m => `${m.role}: ${m.content}`).join("\n");
  const result = await qwenChat({
    model: "qwen-plus",
    messages: [
      { role: "system", content: "Ringkas topik percakapan ini jadi 3-4 kata singkat dalam Bahasa Indonesia, seperti judul chat. Jangan pakai tanda kutip. Balas HANYA judulnya." },
      { role: "user", content: transcript },
    ],
    temperature: 0.3,
    max_tokens: 20,
  });
  return result.content.trim().replace(/^["']|["']$/g, '');
}
```

2. Add `POST /orchestrator/chat/title` wrapping this.
3. Frontend: call this ONCE per session — right after the first assistant response
   completes (there's enough context by then, and it avoids re-summarizing on every
   message). Replace the `generateTopicSummary(baseText)` call at
   `playground/page.tsx` line ~403 with a call to this endpoint instead of the local
   truncation function. Keep the `"Chat "` placeholder as the title until the real
   summary comes back (a session shouldn't sit titleless while the request is in
   flight) — swap it in once resolved.
4. Delete `generateTopicSummary()` once nothing calls it anymore — don't leave dead
   code that looks like it's still doing something.
5. Persist the generated title with the session (wherever sessions are stored —
   currently `localStorage.setItem('agent-sessions', ...)` per the existing code; if
   sessions get moved to server-side storage in a future PR, this title field should
   move with them, but that's out of scope here).

## Acceptance criteria

- [ ] Magic Pen button on Agent Creator fields calls `qwenChat()` (Netra Runtime), not
      any VLM/torch dependency — grep confirms no new Python or torch involvement.
- [ ] A typing indicator appears immediately after sending a message and disappears
      the moment the first real token streams in, in both the success and error paths.
- [ ] Chat recommendation chips appear after an assistant response, are tappable, and
      render nothing (not an empty row) when the suggestion call fails or returns
      empty.
- [ ] A new chat's title is a genuine LLM-generated 3-4 word summary of the actual
      conversation topic, not a truncation of the first message — verify by starting
      a chat where the first message is generic ("halo") but the topic becomes clear
      by message 2-3; the title should reflect the real topic, not "Halo...".
- [ ] `generateTopicSummary()` is deleted, not just unused.

## Non-goals

- Do NOT reintroduce the custom VLM (Gemma-2 2B + CLIP) or any torch/transformers
  dependency for any of these four features — all four are text-only LLM calls.
- Do NOT regenerate the chat title on every message — once per session, after the
  first assistant response, is enough. Repeated regeneration wastes calls and can
  make the title flicker/change distractingly mid-conversation.
- Do NOT block message sending on the recommendation or title calls — both are
  fire-and-forget, best-effort enhancements that must never delay or fail the actual
  chat flow if the LLM call is slow or errors out.
