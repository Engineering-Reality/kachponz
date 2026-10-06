import { env } from '../config/env.js';
import { query } from '../db/pool.js';

/**
 * Passive token/usage telemetry (owo.md LANJUTAN C / tok.md Fase 2).
 * Numeric + hash-safe columns only — never prompt content, message content,
 * or tool results. Gated by LLM_USAGE_TELEMETRY=on (default off); any error
 * here is swallowed so instrumentation can never affect agent behavior.
 */
export interface LlmUsageEvent {
  requestId?: string;
  agentId?: string;
  threadId?: string;
  stepIndex?: number;
  callSite: string;
  modelSlug: string;
  modelKind: 'text' | 'vision';
  provider?: string;
  quantization?: string;
  runtimeMode?: 'openrouter' | 'netra_onprem' | 'netra';
  thinkingEnabled?: boolean;
  scenario?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  imageCount?: number;
  imageTokens?: number;
  toolCallsCount?: number;
  toolsAttachedCount?: number;
  toolResultTokens?: number;
  latencyMs?: number;
  finishReason?: string;
  stream?: boolean;
  estimated?: boolean;
}

export async function logLlmUsageEvent(ev: LlmUsageEvent): Promise<void> {
  if (!env.LLM_USAGE_TELEMETRY) return;
  try {
    await query(
      `INSERT INTO llm_usage_events (
        request_id, agent_id, thread_id, step_index, call_site, model_slug, model_kind,
        provider, quantization, runtime_mode, thinking_enabled, scenario,
        prompt_tokens, completion_tokens, total_tokens, reasoning_tokens,
        image_count, image_tokens, tool_calls_count, tools_attached_count, tool_result_tokens,
        latency_ms, finish_reason, stream, estimated
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [
        ev.requestId ?? null,
        ev.agentId ?? null,
        ev.threadId ?? null,
        ev.stepIndex ?? null,
        ev.callSite,
        ev.modelSlug,
        ev.modelKind,
        ev.provider ?? null,
        ev.quantization ?? null,
        ev.runtimeMode ?? 'netra',
        ev.thinkingEnabled ?? null,
        ev.scenario ?? env.LLM_MEASUREMENT_SCENARIO ?? null,
        ev.promptTokens ?? null,
        ev.completionTokens ?? null,
        ev.totalTokens ?? null,
        ev.reasoningTokens ?? null,
        ev.imageCount ?? null,
        ev.imageTokens ?? null,
        ev.toolCallsCount ?? null,
        ev.toolsAttachedCount ?? null,
        ev.toolResultTokens ?? null,
        ev.latencyMs ?? null,
        ev.finishReason ?? null,
        ev.stream ?? null,
        ev.estimated ?? false,
      ],
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[llmUsage] failed to log usage event (non-fatal):', err instanceof Error ? err.message : err);
  }
}

/**
 * LEGACY / measurement-only OpenRouter body overrides (provider pin, reasoning
 * toggle). OpenRouter-shaped — Netra may not honor these; the normal Netra
 * request path uses netraSamplingParams() below. Kept only for the sizing harness.
 */
export function measurementBodyOverrides(): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  if (env.LLM_MEASUREMENT_PROVIDER) {
    overrides.provider = { order: [env.LLM_MEASUREMENT_PROVIDER], allow_fallbacks: false };
  }
  if (env.LLM_MEASUREMENT_REASONING) {
    overrides.reasoning = { enabled: env.LLM_MEASUREMENT_REASONING === 'on' };
  }
  return overrides;
}

/**
 * Netra request-body sampling params the OpenAI SDK types don't declare.
 * Spread into the chat body / ChatOpenAI modelKwargs at every Netra call site.
 * reasoning.effort is the shape Netra accepts (confirmed working live).
 */
export function netraSamplingParams(): Record<string, unknown> {
  return {
    top_k: env.NETRA_TOP_K,
    min_p: env.NETRA_MIN_P,
    reasoning: { effort: env.NETRA_REASONING_EFFORT },
  };
}

/**
 * Normalizes the 3 shapes Netra emits reasoning in into a single string.
 * Reasoning MUST stay on its own channel — never concatenate the return value
 * into user-visible assistant content. Accepts a streaming delta OR a message
 * object; returns '' when no reasoning is present.
 *   1. delta.reasoning_details[]  (type 'reasoning.text' | 'reasoning.summary')
 *   2. delta.reasoning            (string)
 *   3. delta.reasoning_content    (string)
 */
export function extractReasoning(delta: unknown): string {
  if (!delta || typeof delta !== 'object') return '';
  const d = delta as Record<string, unknown>;

  const details = d.reasoning_details;
  if (Array.isArray(details)) {
    const parts: string[] = [];
    for (const item of details) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      if (rec.type === 'reasoning.text' || rec.type === 'reasoning.summary') {
        const txt = rec.text ?? rec.summary;
        if (typeof txt === 'string') parts.push(txt);
      }
    }
    if (parts.length) return parts.join('');
  }

  if (typeof d.reasoning === 'string') return d.reasoning;
  if (typeof d.reasoning_content === 'string') return d.reasoning_content;
  return '';
}
