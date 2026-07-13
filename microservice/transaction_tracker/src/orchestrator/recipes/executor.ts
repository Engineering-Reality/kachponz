/**
 * Recipe Executor — a deterministic state machine for running the Danantara
 * disposable-email/login/OTP/survey loop. See loop.md for the full
 * rationale. The mechanical parts (trigger -> wait -> verify -> advance) run
 * with NO LLM call at all; every jobId/releaseKey used here comes from a
 * tool result or from `resolvedReleaseKeys`, never from LLM-generated text.
 * The only model call is `classifyFault`, a single bounded string-in/word-out
 * classification — it never sees activeJobId, resolvedReleaseKeys, or any
 * other recipe state.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { query } from '../../db/pool.js';
import { callFn } from '../../db/rpc.js';
import { DomainError } from '../../types/domain.js';
import { txLogger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { resolveCorsOrigin } from '../../config/cors.js';
import { connectToMcpToolById } from '../engine.js';
import type { RecipeDef, RecipeRunState, RecipeStepDef, StepOutcome } from './types.js';

type Logger = ReturnType<typeof txLogger>;

// ── MCP tool call helper ────────────────────────────────────────────────────

/**
 * mcp-uipath's tools return their machine-readable data (jobId, state, asset
 * value, etc.) in `_meta`, never in `content` — `content` is free text meant
 * for an LLM. Reading only `_meta` here is what makes every ID in this file
 * code-derived instead of parsed out of prose.
 */
async function callUipathTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; meta: Record<string, unknown> | undefined }> {
  const res = await client.callTool({ name, arguments: args });
  const text = ((res as any).content ?? [])
    .map((c: any) => (c.type === 'text' ? c.text : JSON.stringify(c)))
    .join('\n');
  return { text, meta: (res as any)._meta as Record<string, unknown> | undefined };
}

/** Parses list_uipath_processes' text output ("• Name (key: Key)" per line) — the
 * MCP tool has no structured return for this call, so this is the one place
 * free text is parsed, and only into a lookup table built once at run start. */
function parseProcessListText(text: string): Array<{ name: string; key: string }> {
  const out: Array<{ name: string; key: string }> = [];
  const re = /^•\s*(.+?)\s*\(key:\s*([^)]+)\)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const [, name, key] = m;
    if (name && key) out.push({ name: name.trim(), key: key.trim() });
  }
  return out;
}

// ── Step 2: resolve releaseKeys ONCE, programmatically, at recipe start ────

async function resolveReleaseKeys(
  recipe: RecipeDef,
  folderId: string,
  client: Client,
  log: Logger,
): Promise<Record<string, string>> {
  const { text } = await callUipathTool(client, 'list_uipath_processes', { folderId });
  const processes = parseProcessListText(text);
  const resolved: Record<string, string> = {};
  const missing: string[] = [];

  for (const step of recipe.steps) {
    if (step.variantParam) {
      for (let variant = 1; variant <= recipe.maxVariants; variant++) {
        const expectedName = `${step.releaseName}_${variant}`;
        const match = processes.find((p) => p.name === expectedName);
        if (match) resolved[expectedName] = match.key;
        else missing.push(expectedName);
      }
    } else {
      const match = processes.find((p) => p.name === step.releaseName);
      if (match) resolved[step.releaseName] = match.key;
      else missing.push(step.releaseName);
    }
  }

  if (missing.length > 0) {
    // Surfaced as a KNOWN LIMIT before the recipe even starts, instead of
    // discovering it mid-loop after a failed trigger_uipath_job call.
    log.warn({ missing }, 'Some recipe releases not found in UiPath folder — those variants/steps will fault immediately if reached');
  }

  return resolved;
}

/** Counts how many contiguous `${releaseName}_N` variants (starting at 1) were
 * actually resolved — the real rotation ceiling, per Step 2's requirement to
 * trust the live process list over any hardcoded maxVariants assumption. */
function resolvedVariantCount(resolvedReleaseKeys: Record<string, string>, releaseName: string, upTo: number): number {
  let count = 0;
  for (let variant = 1; variant <= upTo; variant++) {
    if (!resolvedReleaseKeys[`${releaseName}_${variant}`]) break;
    count = variant;
  }
  return count;
}

// ── Step 3: poll get_uipath_job_status from the executor's own loop, instead
// of relying on one long-lived wait_for_uipath_job MCP call, which can hit
// the MCP client's transport-level request timeout (-32001) before the job
// itself finishes. Each individual call here is fast; Node's setTimeout owns
// the waiting between polls. ─────────────────────────────────────────────
async function pollJobToTerminal(
  client: Client,
  jobId: string,
  timeoutSeconds: number,
  log: Logger,
): Promise<{ state: string; info: string | null; timedOut: boolean }> {
  const TERMINAL_STATES = new Set(['Successful', 'Faulted', 'Stopped']);
  const pollIntervalMs = 5000; // well under any MCP transport's request timeout
  const deadline = Date.now() + timeoutSeconds * 1000;

  let lastState = 'Unknown';
  let lastInfo: string | null = null;

  while (Date.now() < deadline) {
    try {
      const status = await callUipathTool(client, 'get_uipath_job_status', { jobId });
      lastState = (status.meta?.state as string | undefined) ?? lastState;
      lastInfo = (status.meta?.info as string | undefined) ?? null;
      if (TERMINAL_STATES.has(lastState)) {
        return { state: lastState, info: lastInfo, timedOut: false };
      }
    } catch (err) {
      // A single flaky call mid-poll shouldn't abort the whole wait — log it
      // and keep polling until the deadline.
      log.warn({ jobId, err: String(err) }, 'get_uipath_job_status call failed mid-poll, retrying');
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { state: lastState, info: lastInfo, timedOut: true };
}

// ── Step 3: the deterministic step executor (no LLM involved) ──────────────

async function writeJobTrace(
  state: RecipeRunState,
  trace: { jobId: string; jobKey?: string | null; releaseKey: string; processName: string; jobState: string; info: string | null },
  log: Logger,
): Promise<void> {
  try {
    await callFn('fn_upsert_uipath_job_trace', [
      state.agentId,
      state.toolId,
      state.runId,
      trace.jobId,
      trace.jobKey ?? null,
      trace.releaseKey,
      trace.processName,
      state.folderId,
      null, // queue_name — not applicable to job-trigger tools
      trace.jobState,
      trace.info,
    ]);
  } catch (e) {
    log.warn({ err: e, jobId: trace.jobId }, 'Failed to persist uipath_job_trace for recipe run');
  }
}

async function executeStep(
  step: RecipeStepDef,
  state: RecipeRunState,
  client: Client,
  log: Logger,
): Promise<StepOutcome> {
  // Hard concurrency invariant, enforced in code, not requested of the model.
  if (state.activeJobId !== null) {
    throw new Error(
      `Recipe invariant violated: attempted to trigger a new job while ${state.activeJobId} is still active. This should never happen — it's a bug in the executor, not something to work around.`,
    );
  }

  const variantKey = step.variantParam ? `${step.releaseName}_${state.currentVariant}` : step.releaseName;
  const releaseKey = state.resolvedReleaseKeys[variantKey];
  if (!releaseKey) {
    return { outcome: 'fault', detail: `No resolved releaseKey for ${variantKey} — this release does not exist in UiPath folder ${state.folderId}.` };
  }

  const triggerRes = await callUipathTool(client, 'trigger_uipath_job', { releaseKey, folderId: state.folderId });
  const jobId = triggerRes.meta?.jobId as string | undefined;
  if (!jobId) {
    return { outcome: 'fault', detail: `trigger_uipath_job did not return a job for ${variantKey}: ${triggerRes.text}` };
  }
  state.activeJobId = jobId; // code owns this now — the LLM is never asked to recall it
  await writeJobTrace(state, {
    jobId,
    jobKey: triggerRes.meta?.jobKey as string | undefined,
    releaseKey,
    processName: variantKey,
    jobState: (triggerRes.meta?.state as string | undefined) ?? 'Pending',
    info: null,
  }, log);

  const waitRes = await pollJobToTerminal(client, jobId, step.waitTimeoutSeconds, log);
  state.activeJobId = null; // freed as soon as the job reaches a terminal state OR times out
  const finalState = waitRes.state;
  const timedOut = waitRes.timedOut;
  const info = waitRes.info;
  await writeJobTrace(state, { jobId, releaseKey, processName: variantKey, jobState: finalState ?? 'Unknown', info }, log);

  if (timedOut) {
    return { outcome: 'timeout', detail: `Job ${jobId} did not finish within ${step.waitTimeoutSeconds}s (last known state: ${finalState ?? 'Unknown'})`, jobId };
  }
  if (finalState !== 'Successful') {
    return { outcome: 'fault', detail: info || `Job ${jobId} ended with state ${finalState ?? 'Unknown'}`, jobId };
  }

  if (step.verifyAsset) {
    const assetRes = await callUipathTool(client, 'get_uipath_asset', { assetName: step.verifyAsset.assetName, folderId: state.folderId });
    const value = assetRes.meta?.value;
    if (step.verifyAsset.mustBeNonEmpty && !value) {
      return { outcome: 'fault', detail: `Asset ${step.verifyAsset.assetName} is empty after a Successful job — treating as a fault.`, jobId };
    }
  }

  return { outcome: 'success', detail: `Job ${jobId} completed successfully`, jobId };
}

// ── Step 4: LLM decision point — only for genuinely unfamiliar faults ──────

const KNOWN_RETRYABLE = ['not authorized', 'rate limit', 'quota'];

async function classifyFault(detail: string): Promise<'retry' | 'abort'> {
  const lower = detail.toLowerCase();
  if (KNOWN_RETRYABLE.some((k) => lower.includes(k))) return 'retry'; // no LLM call needed for known patterns

  const llm = new ChatOpenAI({
    modelName: env.QWEN_LLM_MODEL || 'qwen-max',
    temperature: 0,
    apiKey: env.QWEN_API_KEY,
    configuration: { baseURL: env.QWEN_BASE_URL },
  });

  // A single, narrow, stateless call — it gets a short string in, returns one
  // word out. It cannot hallucinate a job ID because it never sees one.
  const response = await llm.invoke([
    { role: 'system', content: "You classify UiPath job fault reasons as either 'retry' (transient, worth trying the next email variant) or 'abort' (permanent, retrying won't help). Respond with exactly one word: retry or abort." },
    { role: 'user', content: detail },
  ]);
  const word = String(response.content).trim().toLowerCase();
  return word.startsWith('retry') ? 'retry' : 'abort';
}

// ── MCP client resolution for a given agent ─────────────────────────────────

async function connectRecipeMcpClient(agentId: string): Promise<{ client: Client; toolId: string }> {
  const agentRes = await query<{ tools: string[] | null }>('SELECT tools FROM agents WHERE agent_id = $1', [agentId]);
  const agentRow = agentRes.rows[0];
  if (!agentRow?.tools || agentRow.tools.length === 0) {
    throw new DomainError('NO_TOOLS_AVAILABLE', 'Agent has no tools configured', 424);
  }

  const toolsRes = await query<{ tool_id: string; name: string }>(
    `SELECT tool_id, name FROM tools WHERE tool_id = ANY($1::uuid[]) AND name ILIKE '%uipath%' LIMIT 1`,
    [agentRow.tools],
  );
  const toolRow = toolsRes.rows[0];
  if (!toolRow) {
    throw new DomainError('NO_TOOLS_AVAILABLE', 'Agent has no UiPath MCP tool configured', 424);
  }

  const client = await connectToMcpToolById(toolRow.tool_id, 'amadeus-recipe-executor');
  return { client, toolId: toolRow.tool_id };
}

// ── Main recipe run loop ────────────────────────────────────────────────────

export async function runRecipe(
  recipe: RecipeDef,
  opts: { agentId: string; iterations: number; folderId?: string },
  onUpdate: (state: RecipeRunState) => void,
): Promise<RecipeRunState> {
  const runId = randomUUID();
  const log = txLogger(`recipe:${runId}`);
  const folderId = opts.folderId ?? recipe.folderId;

  const state: RecipeRunState = {
    recipeId: recipe.id,
    runId,
    agentId: opts.agentId,
    toolId: '',
    folderId,
    currentIteration: 0,
    currentStepIndex: 0,
    currentVariant: 1,
    resolvedReleaseKeys: {},
    activeJobId: null,
    iterationResults: [],
    status: 'running',
  };

  let client: Client | undefined;
  try {
    const connected = await connectRecipeMcpClient(opts.agentId);
    client = connected.client;
    state.toolId = connected.toolId;

    state.resolvedReleaseKeys = await resolveReleaseKeys(recipe, folderId, client, log);
    onUpdate(state);

    for (let iteration = 1; iteration <= opts.iterations; iteration++) {
      state.currentIteration = iteration;
      state.currentVariant = 1;
      let iterationStatus: 'success' | 'failed' | 'aborted' = 'success';
      let iterationDetail = 'All steps completed successfully';

      stepLoop: for (const [stepIndex, step] of recipe.steps.entries()) {
        state.currentStepIndex = stepIndex;

        // Bounded retry loop for this single step — only rotate_variant steps
        // can loop here, bounded by the real resolved variant count.
        for (;;) {
          onUpdate(state);
          const result = await executeStep(step, state, client, log);
          onUpdate(state);

          if (result.outcome === 'success') break;

          if (step.onFault === 'abort_recipe') {
            state.status = 'failed';
            state.error = result.detail;
            iterationStatus = 'aborted';
            iterationDetail = result.detail;
            state.iterationResults.push({ iteration, status: iterationStatus, detail: iterationDetail });
            onUpdate(state);
            return state;
          }

          if (step.onFault === 'abort_iteration') {
            iterationStatus = 'failed';
            iterationDetail = result.detail;
            break stepLoop;
          }

          // onFault === 'rotate_variant'
          const decision = await classifyFault(result.detail);
          if (decision === 'abort') {
            iterationStatus = 'failed';
            iterationDetail = result.detail;
            break stepLoop;
          }

          const variantCeiling = resolvedVariantCount(state.resolvedReleaseKeys, step.releaseName, recipe.maxVariants);
          state.currentVariant += 1;
          if (state.currentVariant > variantCeiling) {
            iterationStatus = 'failed';
            iterationDetail = `Exhausted all ${variantCeiling} resolved variant(s) of ${step.releaseName} — last error: ${result.detail}`;
            break stepLoop;
          }
          log.info({ iteration, step: step.id, nextVariant: state.currentVariant }, 'Rotating to next variant after retry-worthy fault');
          // loop again with the next variant
        }
      }

      state.iterationResults.push({ iteration, status: iterationStatus, detail: iterationDetail });
      onUpdate(state);
    }

    state.status = 'completed';
    onUpdate(state);
    return state;
  } catch (e) {
    state.status = 'failed';
    state.error = e instanceof Error ? e.message : String(e);
    onUpdate(state);
    return state;
  } finally {
    if (client) {
      try { await client.close(); } catch { /* best effort */ }
    }
  }
}

// ── SSE wiring ───────────────────────────────────────────────────────────────

/**
 * Streams RecipeRunState updates over SSE for the lifetime of a single recipe
 * run. There is exactly one producer (this run) and one consumer (the request
 * that opened the stream) — unlike a2aTasks.ts's EventEmitter registry, which
 * exists because multiple SSE clients can watch the same task, there's no
 * decoupled pub/sub need here, so `onUpdate` writes directly to `reply.raw`.
 */
export async function runRecipeStream(
  recipe: RecipeDef,
  opts: { agentId: string; iterations: number; folderId?: string },
  reply: FastifyReply,
): Promise<void> {
  const corsOrigin = resolveCorsOrigin(reply.request.headers.origin);

  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  if (corsOrigin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', corsOrigin);
    reply.raw.setHeader('Vary', 'Origin');
  }
  reply.raw.flushHeaders();

  const write = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if ((reply.raw as any).flush) (reply.raw as any).flush();
  };

  try {
    const finalState = await runRecipe(recipe, opts, (state) => write('state', state));
    write('complete', finalState);
  } catch (e) {
    write('error', { message: e instanceof Error ? e.message : String(e) });
  } finally {
    reply.raw.end();
  }
}
