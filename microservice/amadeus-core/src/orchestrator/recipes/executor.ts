/**
 * Recipe Executor — a deterministic, tool-agnostic state machine for running
 * any agent's configured trigger->wait->verify MCP tool chain. See
 * loop.md/creatoroop.md for the full rationale. The mechanical parts run with
 * NO LLM call at all; every ID used here comes from a tool's `_meta` or from
 * `state.resolved`, never from LLM-generated text. The only model call is
 * `classifyFault`, a single bounded string-in/word-out classification — it
 * never sees recipe/tool/agent state.
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
import { connectToMcpToolById, extractJobTraceMeta } from '../engine.js';
import type { RecipeDef, RecipeResolverDef, RecipeRunState, RecipeStepDef, StepOutcome } from './types.js';

type Logger = ReturnType<typeof txLogger>;

interface MethodEntry {
  client: Client;
  toolId: string;
}

// ── MCP tool call helper ────────────────────────────────────────────────────

/**
 * A tool's `_meta` carries its machine-readable data (job IDs, states, asset
 * values, list results, etc.), never `content` — `content` is free text meant
 * for an LLM. Reading only `_meta` here is what keeps every ID in this file
 * code-derived instead of parsed out of prose.
 */
async function callMcpTool(
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

// ── Step 2: connect to EVERY tool attached to the agent, index by MCP method
// name — a recipe's steps may call methods spread across more than one
// attached tool row, unlike the old single-uipath-tool assumption. ─────────

async function connectRecipeMcpClients(
  agentId: string,
  log: Logger,
): Promise<{ clients: Client[]; methodIndex: Map<string, MethodEntry> }> {
  const agentRes = await query<{ tools: string[] | null }>('SELECT tools FROM agents WHERE agent_id = $1', [agentId]);
  const agentRow = agentRes.rows[0];
  if (!agentRow?.tools || agentRow.tools.length === 0) {
    throw new DomainError('NO_TOOLS_AVAILABLE', 'Agent has no tools configured', 424);
  }

  const toolsRes = await query<{ tool_id: string; name: string }>(
    `SELECT tool_id, name FROM tools WHERE tool_id = ANY($1::uuid[])`,
    [agentRow.tools],
  );

  const clients: Client[] = [];
  const methodIndex = new Map<string, MethodEntry>();

  for (const toolRow of toolsRes.rows) {
    let client: Client;
    try {
      client = await connectToMcpToolById(toolRow.tool_id, 'amadeus-recipe-executor');
    } catch (e) {
      log.warn({ toolId: toolRow.tool_id, toolName: toolRow.name, err: String(e) }, 'Recipe run: failed to connect to an attached tool, skipping it');
      continue;
    }
    clients.push(client);

    const { tools: mcpTools } = await client.listTools();
    for (const mcpTool of mcpTools) {
      if (methodIndex.has(mcpTool.name)) {
        log.warn({ method: mcpTool.name, toolId: toolRow.tool_id }, 'Recipe run: MCP method name collision across attached tools — first-attached wins');
        continue;
      }
      methodIndex.set(mcpTool.name, { client, toolId: toolRow.tool_id });
    }
  }

  if (methodIndex.size === 0) {
    throw new DomainError('NO_TOOLS_AVAILABLE', 'Agent has no connectable MCP tools configured', 424);
  }

  return { clients, methodIndex };
}

/** Fails the whole run up front if the recipe references a tool method that
 * none of the agent's attached tools actually expose — surfaced as a KNOWN
 * LIMIT before the recipe even starts, instead of discovering it mid-loop. */
function validateRecipeToolNames(recipe: RecipeDef, methodIndex: Map<string, MethodEntry>): void {
  const referenced = new Set<string>();
  for (const resolver of recipe.resolvers ?? []) referenced.add(resolver.toolName);
  for (const step of recipe.steps) {
    referenced.add(step.toolName);
    if (step.pollFor) referenced.add(step.pollFor.toolName);
    if (step.verify) referenced.add(step.verify.toolName);
  }
  const missing = [...referenced].filter((name) => !methodIndex.has(name));
  if (missing.length > 0) {
    throw new DomainError(
      'RECIPE_TOOL_NOT_FOUND',
      `This recipe references tool method(s) not exposed by any of this agent's attached tools: ${missing.join(', ')}`,
      424,
      { missing },
    );
  }
}

// ── Placeholder substitution — deliberately minimal, exactly three known
// tokens, no expression language. ───────────────────────────────────────────

interface SubstitutionContext {
  variant: number;
  prevStepOutput: Record<string, unknown>;
  resolved: string | undefined;
}

function substituteString(value: string, ctx: SubstitutionContext): string {
  return value
    .replace(/\{\{variant\}\}/g, String(ctx.variant))
    .replace(/\{\{prevStepOutput\.([a-zA-Z0-9_]+)\}\}/g, (_m, field: string) => {
      const v = ctx.prevStepOutput?.[field];
      return v === undefined || v === null ? '' : String(v);
    })
    .replace(/\{\{resolved\}\}/g, ctx.resolved === undefined ? '' : ctx.resolved);
}

function substitute<T>(value: T, ctx: SubstitutionContext): T {
  if (typeof value === 'string') return substituteString(value, ctx) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => substitute(v, ctx)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = substitute(v, ctx);
    return out as unknown as T;
  }
  return value;
}

// ── Step 1: resolve every resolver's name->value map ONCE, before any
// iteration — generalizes the old resolveReleaseKeys/parseProcessListText. ──

async function runResolvers(
  resolvers: RecipeResolverDef[],
  methodIndex: Map<string, MethodEntry>,
  log: Logger,
): Promise<Record<string, Record<string, string>>> {
  const resolved: Record<string, Record<string, string>> = {};

  for (const resolver of resolvers) {
    const entry = methodIndex.get(resolver.toolName)!; // presence already validated
    const { text, meta } = await callMcpTool(entry.client, resolver.toolName, resolver.argsTemplate);
    const map: Record<string, string> = {};

    if (resolver.extract.kind === 'text_lines') {
      const re = new RegExp(resolver.extract.itemPattern, 'gm');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const name = m[resolver.extract.nameGroup];
        const value = m[resolver.extract.valueGroup];
        if (name && value) map[name.trim()] = value.trim();
      }
    } else {
      const items = meta?.[resolver.extract.metaField];
      if (Array.isArray(items)) {
        for (const item of items) {
          const name = item?.[resolver.extract.nameField];
          const value = item?.[resolver.extract.valueField];
          if (typeof name === 'string' && typeof value === 'string') map[name] = value;
        }
      }
    }

    resolved[resolver.id] = map;
    log.info({ resolverId: resolver.id, count: Object.keys(map).length }, 'Recipe resolver populated');
  }

  return resolved;
}

/** Counts how many contiguous variants (starting at 1) actually resolve —
 * the real rotation ceiling, trusting live resolver data over
 * `variantCount`. A step with no `resolve` has no live data to check against,
 * so `variantCount` is trusted as given. */
function resolvedVariantCount(state: RecipeRunState, step: RecipeStepDef): number {
  if (!step.variantCount) return 0;
  if (!step.resolve) return step.variantCount;

  const map = state.resolved[step.resolve.resolverId] ?? {};
  let count = 0;
  for (let variant = 1; variant <= step.variantCount; variant++) {
    const name = substituteString(step.resolve.nameTemplate, { variant, prevStepOutput: state.lastStepOutput, resolved: undefined });
    if (!map[name]) break;
    count = variant;
  }
  return count;
}

// ── Job-trace side channel — gated entirely behind extractJobTraceMeta's
// UiPath-job-tool allowlist, so this is the ONLY place UiPath specifics leak
// into otherwise tool-agnostic step execution. ─────────────────────────────

async function maybeWriteJobTrace(
  state: RecipeRunState,
  toolId: string,
  toolName: string,
  processName: string,
  meta: Record<string, unknown> | undefined,
  log: Logger,
): Promise<void> {
  const trace = extractJobTraceMeta(toolName, meta);
  if (!trace) return;
  try {
    await callFn('fn_upsert_uipath_job_trace', [
      state.agentId,
      toolId,
      state.runId,
      trace.jobId,
      trace.jobKey,
      trace.releaseKey,
      processName,
      trace.folderId,
      null, // queue_name — not applicable to job-trigger tools
      trace.state,
      trace.info,
    ]);
  } catch (e) {
    log.warn({ err: e, jobId: trace.jobId }, 'Failed to persist uipath_job_trace for recipe run');
  }
}

// ── Step 3: the deterministic step executor (no LLM involved) ──────────────

async function executeStep(
  step: RecipeStepDef,
  state: RecipeRunState,
  methodIndex: Map<string, MethodEntry>,
  log: Logger,
): Promise<StepOutcome> {
  // Hard concurrency invariant, enforced in code, not requested of the model.
  if (state.activeStepId !== null) {
    throw new Error(
      `Recipe invariant violated: attempted to start step ${step.id} while ${state.activeStepId} is still active. This should never happen — it's a bug in the executor, not something to work around.`,
    );
  }

  let resolvedValue: string | undefined;
  let resolvedName: string | undefined;
  if (step.resolve) {
    resolvedName = substituteString(step.resolve.nameTemplate, { variant: state.currentVariant, prevStepOutput: state.lastStepOutput, resolved: undefined });
    resolvedValue = state.resolved[step.resolve.resolverId]?.[resolvedName];
    if (!resolvedValue) {
      return { outcome: 'fault', detail: `No resolved value for "${resolvedName}" via resolver "${step.resolve.resolverId}" — this name does not exist in the live resolver data.` };
    }
  }
  const processName = resolvedName ?? step.id;

  const ctxFor = (): SubstitutionContext => ({ variant: state.currentVariant, prevStepOutput: state.lastStepOutput, resolved: resolvedValue });

  const triggerEntry = methodIndex.get(step.toolName)!; // presence already validated
  const triggerArgs = substitute(step.argsTemplate, ctxFor());
  const triggerRes = await callMcpTool(triggerEntry.client, step.toolName, triggerArgs);
  if (triggerRes.meta) state.lastStepOutput = { ...state.lastStepOutput, ...triggerRes.meta };
  await maybeWriteJobTrace(state, triggerEntry.toolId, step.toolName, processName, triggerRes.meta, log);

  if (step.pollFor) {
    state.activeStepId = step.id;
    const pollEntry = methodIndex.get(step.pollFor.toolName)!;
    const pollIntervalMs = step.pollFor.pollIntervalSeconds * 1000;
    const deadline = Date.now() + step.pollFor.timeoutSeconds * 1000;
    const successValues = new Set(step.pollFor.successValues ?? step.pollFor.terminalValues);
    const terminalValues = new Set(step.pollFor.terminalValues);

    let finalState: string | undefined;
    let timedOut = true;

    while (Date.now() < deadline) {
      try {
        const pollArgs = substitute(step.pollFor.argsTemplate, ctxFor());
        const pollRes = await callMcpTool(pollEntry.client, step.pollFor.toolName, pollArgs);
        if (pollRes.meta) state.lastStepOutput = { ...state.lastStepOutput, ...pollRes.meta };
        await maybeWriteJobTrace(state, pollEntry.toolId, step.pollFor.toolName, processName, pollRes.meta, log);

        const fieldValue = pollRes.meta?.[step.pollFor.terminalField];
        if (typeof fieldValue === 'string' && terminalValues.has(fieldValue)) {
          finalState = fieldValue;
          timedOut = false;
          break;
        }
      } catch (err) {
        // A single flaky call mid-poll shouldn't abort the whole wait — log it
        // and keep polling until the deadline.
        log.warn({ step: step.id, err: String(err) }, 'pollFor call failed mid-poll, retrying');
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    state.activeStepId = null;

    if (timedOut) {
      return { outcome: 'timeout', detail: `Step ${step.id} did not reach a terminal state within ${step.pollFor.timeoutSeconds}s (last known: ${finalState ?? 'unknown'})` };
    }
    if (!finalState || !successValues.has(finalState)) {
      return { outcome: 'fault', detail: `Step ${step.id} ended with state ${finalState ?? 'unknown'}` };
    }
  }

  if (step.verify) {
    const verifyEntry = methodIndex.get(step.verify.toolName)!;
    const verifyArgs = substitute(step.verify.argsTemplate, ctxFor());
    const verifyRes = await callMcpTool(verifyEntry.client, step.verify.toolName, verifyArgs);
    if (verifyRes.meta) state.lastStepOutput = { ...state.lastStepOutput, ...verifyRes.meta };
    const value = verifyRes.meta?.[step.verify.checkField];
    if (step.verify.mustBeNonEmpty && !value) {
      return { outcome: 'fault', detail: `Verify field "${step.verify.checkField}" is empty after step ${step.id} completed — treating as a fault.` };
    }
  }

  return { outcome: 'success', detail: `Step ${step.id} completed successfully` };
}

// ── Step 4: LLM decision point — only for genuinely unfamiliar faults ──────

const KNOWN_RETRYABLE = ['not authorized', 'rate limit', 'quota'];

async function classifyFault(detail: string): Promise<'retry' | 'abort'> {
  const lower = detail.toLowerCase();
  if (KNOWN_RETRYABLE.some((k) => lower.includes(k))) return 'retry'; // no LLM call needed for known patterns

  const llm = new ChatOpenAI({
    modelName: env.NETRA_LLM_MODEL || 'qwen3.6-35b',
    temperature: 0,
    apiKey: env.NETRA_API_KEY,
    configuration: { baseURL: env.NETRA_BASE_URL },
  });

  // A single, narrow, stateless call — it gets a short string in, returns one
  // word out. It cannot hallucinate an ID because it never sees one.
  const response = await llm.invoke([
    { role: 'system', content: "You classify a recipe step's fault reason as either 'retry' (transient, worth trying the next variant) or 'abort' (permanent, retrying won't help). Respond with exactly one word: retry or abort." },
    { role: 'user', content: detail },
  ]);
  const word = String(response.content).trim().toLowerCase();
  return word.startsWith('retry') ? 'retry' : 'abort';
}

// ── Main recipe run loop ────────────────────────────────────────────────────

export async function runRecipe(
  recipe: RecipeDef,
  opts: { agentId: string; iterations: number },
  onUpdate: (state: RecipeRunState) => void,
): Promise<RecipeRunState> {
  const runId = randomUUID();
  const log = txLogger(`recipe:${runId}`);

  const state: RecipeRunState = {
    recipeId: recipe.id,
    runId,
    agentId: opts.agentId,
    currentIteration: 0,
    currentStepIndex: 0,
    currentVariant: 1,
    resolved: {},
    activeStepId: null,
    lastStepOutput: {},
    iterationResults: [],
    status: 'running',
  };

  let clients: Client[] = [];
  try {
    const connected = await connectRecipeMcpClients(opts.agentId, log);
    clients = connected.clients;
    validateRecipeToolNames(recipe, connected.methodIndex);

    state.resolved = await runResolvers(recipe.resolvers ?? [], connected.methodIndex, log);
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
          const result = await executeStep(step, state, connected.methodIndex, log);
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

          const variantCeiling = resolvedVariantCount(state, step);
          state.currentVariant += 1;
          if (state.currentVariant > variantCeiling) {
            iterationStatus = 'failed';
            iterationDetail = `Exhausted all ${variantCeiling} resolved variant(s) for step ${step.id} — last error: ${result.detail}`;
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
    for (const client of clients) {
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
  opts: { agentId: string; iterations: number },
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
