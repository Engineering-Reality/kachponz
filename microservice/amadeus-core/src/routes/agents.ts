import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { callFn } from '../db/rpc.js';
import { DomainError } from '../types/domain.js';
import { authenticateRobot } from '../middleware/auth.js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'node:crypto';
import { runAgenticStep } from '../orchestrator/engine.js';

export const registerAgentsRoutes: FastifyPluginAsync = async (rootApp: FastifyInstance) => {
  await rootApp.register(async (app) => {
  app.addHook('preHandler', authenticateRobot);

  // Base Agent schema
  const agentSchema = z.object({
    agent_id: z.string().uuid(),
    user_id: z.string().uuid().nullable().optional(),
    company_id: z.string().uuid().nullable().optional(),
    agent_name: z.string(),
    description: z.string().nullable().optional(),
    agent_style: z.string().nullable().optional(),
    on_status: z.boolean().default(true),
    tools: z.array(z.string()).default([]),
    share_editor_with: z.array(z.string()).default([]),
    // Not a column on `agents` — backed by the agent_knowledge_bases junction
    // table (fn_set_agent_knowledge_bases). Populated on read, written via RPC.
    knowledge_base_ids: z.array(z.string()).default([]),
    created_at: z.string().or(z.date()).optional(),
  });

  const agentCreateSchema = agentSchema.omit({ agent_id: true, user_id: true, company_id: true, created_at: true });
  const agentUpdateSchema = agentSchema.omit({ agent_id: true, user_id: true, company_id: true, created_at: true }).partial();

  // AML/CFT screening verdict (apu.md Task 4) — output contract the agent's
  // system prompt is instructed to follow exactly. Validated here so a
  // malformed/non-JSON LLM response fails loud instead of silently landing
  // a garbage row in alert_outbox.
  const AmlVerdictSchema = z.object({
    transaction_id: z.string(),
    message_format: z.enum(['MT103', 'MT202', 'pacs.008']),
    verdict: z.enum(['hit', 'clean', 'needs_review']),
    risk_score: z.number().min(0).max(100),
    matched_entities: z.array(z.object({
      party_role: z.string(),
      matched_name: z.string(),
      kb_source: z.string(),
      match_confidence: z.number().min(0).max(1),
    })),
    red_flags: z.array(z.string()),
    reasoning: z.string(),
    recommended_action: z.enum(['escalate_to_compliance', 'auto_clear', 'manual_review']),
  });

  // GET /agents
  app.get(
    '/agents',
    {
      schema: {
        response: {
          200: z.array(agentSchema),
        },
      },
    },
    async (request, reply) => {
      const res = await query(
        'SELECT * FROM agents WHERE company_id = $1 ORDER BY agent_name ASC',
        [request.auth!.companyId],
      );
      const agentIds = res.rows.map((r: any) => r.agent_id);
      const kbMap: Record<string, string[]> = {};
      if (agentIds.length > 0) {
        const kbRes = await query<{ agent_id: string; kb_id: string }>(
          'SELECT agent_id, kb_id FROM agent_knowledge_bases WHERE agent_id = ANY($1::uuid[])',
          [agentIds],
        );
        for (const row of kbRes.rows) {
          (kbMap[row.agent_id] ??= []).push(row.kb_id);
        }
      }
      const agentsWithKb = res.rows.map((r: any) => ({ ...r, knowledge_base_ids: kbMap[r.agent_id] ?? [] }));
      return reply.code(200).send(agentsWithKb);
    }
  );

  // GET /agents/:id
  app.get(
    '/agents/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: agentSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const res = await query(
        'SELECT * FROM agents WHERE agent_id = $1 AND company_id = $2',
        [id, request.auth!.companyId],
      );
      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
      }
      const kbRes = await query<{ kb_id: string }>(
        'SELECT kb_id FROM agent_knowledge_bases WHERE agent_id = $1',
        [id],
      );
      return reply.code(200).send({ ...res.rows[0], knowledge_base_ids: kbRes.rows.map((r) => r.kb_id) });
    }
  );

  // POST /agents
  app.post(
    '/agents',
    {
      schema: {
        body: agentCreateSchema,
        response: {
          201: agentSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof agentCreateSchema>;

      const res = await query(
        `INSERT INTO agents (agent_name, description, agent_style, on_status, tools, share_editor_with, company_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          body.agent_name,
          body.description || '',
          body.agent_style || '',
          body.on_status ?? true,
          body.tools || [],
          body.share_editor_with || [],
          request.auth!.companyId,
        ]
      );
      const agent = res.rows[0];
      if (!agent) {
        throw new DomainError('INTERNAL_ERROR', 'Gagal membuat agent', 500);
      }
      const kbIds = body.knowledge_base_ids ?? [];
      if (kbIds.length > 0) {
        await callFn('fn_set_agent_knowledge_bases', [agent.agent_id, kbIds]);
      }
      return reply.code(201).send({ ...agent, knowledge_base_ids: kbIds });
    }
  );

  // PUT /agents/:id
  app.put(
    '/agents/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: agentUpdateSchema,
        response: {
          200: agentSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof agentUpdateSchema>;

      if (Object.keys(body).length === 0) {
        throw new DomainError('VALIDATION_ERROR', 'Tidak ada data untuk diperbarui', 400);
      }

      // fn_update_agent tidak menerima company_id (lihat db/functions/fn_update_agent.sql) —
      // scoping company dicek di sini sebelum RPC dipanggil, bukan di dalam function-nya.
      const owned = await query('SELECT 1 FROM agents WHERE agent_id = $1 AND company_id = $2', [
        id,
        request.auth!.companyId,
      ]);
      if (owned.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
      }

      // fn_update_agent (db/functions/) treats NULL as "field not supplied" via
      // COALESCE — undefined fields must be passed as null, not omitted.
      const res = await callFn(
        'fn_update_agent',
        [
          id,
          body.agent_name ?? null,
          body.description ?? null,
          body.agent_style ?? null,
          body.on_status ?? null,
          body.tools ?? null,
          body.share_editor_with ?? null,
        ],
      );

      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
      }

      let kbIds: string[];
      if (body.knowledge_base_ids !== undefined) {
        await callFn('fn_set_agent_knowledge_bases', [id, body.knowledge_base_ids]);
        kbIds = body.knowledge_base_ids;
      } else {
        const kbRes = await query<{ kb_id: string }>(
          'SELECT kb_id FROM agent_knowledge_bases WHERE agent_id = $1',
          [id],
        );
        kbIds = kbRes.rows.map((r) => r.kb_id);
      }
      return reply.code(200).send({ ...res.rows[0], knowledge_base_ids: kbIds });
    }
  );

  // DELETE /agents/:id
  app.delete(
    '/agents/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const res = await query(
        'DELETE FROM agents WHERE agent_id = $1 AND company_id = $2 RETURNING *',
        [id, request.auth!.companyId],
      );

      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
      }
      return reply.code(204).send();
    }
  );

  // POST /agents/create-from-description
  // TypeScript port of Python agent_creator autofill.
  // Sends the user's natural language description to the LLM and returns a
  // structured agent config (name, description, agent_style, tool_ids).
  // Does NOT persist — the frontend sends a follow-up POST /agents to compile.
  app.post(
    '/agents/create-from-description',
    {
      schema: {
        body: z.object({
          description: z.string().min(10).max(4000),
          runtime: z.enum(['cloud', 'on_prem']).optional().default('cloud'),
        }).strict(),
      },
    },
    async (request, reply) => {
      const { description, runtime } = request.body as { description: string; runtime: 'cloud' | 'on_prem' };

      // Fetch available tools to pass as context for recommendation
      const toolsRes = await query<{ tool_id: string; name: string; description: string | null }>(
        'SELECT tool_id, name, description FROM tools WHERE company_id = $1 ORDER BY name ASC',
        [request.auth!.companyId],
      );
      const availableTools = toolsRes.rows;

      const toolList = availableTools.length > 0
        ? availableTools.map(t => `- ID: ${t.tool_id} | Name: ${t.name} | Desc: ${t.description ?? ''}`).join('\n')
        : '(no tools registered yet)';

      const systemPrompt = `You are Agent Architect, an expert AI agent configuration generator for the Amadeus platform.
Given a natural language description of an agent the user wants to build, you must produce a JSON object with these exact fields:
- agent_name: string (short, clear, PascalCase slug, e.g. "LcSettlementOrchestrator")
- description: string (2–4 sentence description of the agent's purpose and capabilities)
- agent_style: string (a detailed system prompt that defines the agent's persona, tone, and behaviour rules; 3–6 sentences)
- keywords: string[] (3-5 short keywords for searching external tool registries, e.g. ["github", "database", "calendar", "uipath"])
- tool_ids: string[] (array of tool IDs from the available tools list that this agent should have access to; pick only the most relevant ones)
- reasoning: string (1–2 sentence explanation of why you chose those tools)

Available MCP tools registered in this company:
${toolList}

Respond with ONLY a valid JSON object, no markdown, no explanation.`;

      const apiKey = runtime === 'on_prem'
        ? (process.env.NETRA_API_KEY || '')
        : process.env.NETRA_API_KEY;
      const baseURL = runtime === 'on_prem'
        ? 'https://api.netraruntime.com/v1'
        : process.env.NETRA_BASE_URL;
      const modelName = runtime === 'on_prem' ? 'qwen3.6-35b' : (process.env.NETRA_LLM_MODEL || 'qwen3.6-35b');

      const llm = new ChatOpenAI({
        modelName,
        temperature: 0.3,
        apiKey: apiKey!,
        configuration: { baseURL },
      });

      const raw = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(description),
      ]);

      let parsed: any;
      try {
        const text = typeof raw.content === 'string' ? raw.content : JSON.stringify(raw.content);
        // Strip markdown code fences if present
        const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        throw new DomainError('LLM_PARSE_ERROR', 'LLM returned invalid JSON — please try again', 500);
      }

      return reply.code(200).send({
        agent_name: parsed.agent_name ?? '',
        description: parsed.description ?? '',
        agent_style: parsed.agent_style ?? '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        tool_ids: Array.isArray(parsed.tool_ids) ? parsed.tool_ids : [],
        reasoning: parsed.reasoning ?? '',
        available_tools: availableTools,
      });
    }
  );

  // POST /agents/:id/screen — run an AML/CFT screening agent against one
  // transaction message (apu.md Task 5). Runs the agent (mode='playground',
  // so no coupling to the unrelated LC/SKBDN transactions state machine),
  // validates the JSON verdict against AmlVerdictSchema, and inserts it into
  // alert_outbox (status='pending') for the email worker in
  // scripts/mcpAutoManager.ts to pick up — never emails synchronously from
  // this request handler.
  app.post(
    '/agents/:id/screen',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          message: z.string().min(1),
          runtime: z.enum(['cloud', 'on_prem']).optional().default('cloud'),
        }),
        response: { 200: AmlVerdictSchema },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { message, runtime } = request.body as { message: string; runtime: 'cloud' | 'on_prem' };

      const owned = await query('SELECT 1 FROM agents WHERE agent_id = $1 AND company_id = $2', [
        id,
        request.auth!.companyId,
      ]);
      if (owned.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
      }

      const result = await runAgenticStep(
        request.auth!,
        undefined,
        randomUUID(),
        message,
        undefined,
        id,
        'playground',
        undefined,
        runtime,
      );

      const rawOutput = result.agentOutput;
      const text = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
      const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(clean);
      } catch {
        throw new DomainError('LLM_PARSE_ERROR', 'Agent tidak mengembalikan JSON yang valid', 502);
      }

      const verdictParse = AmlVerdictSchema.safeParse(parsedJson);
      if (!verdictParse.success) {
        throw new DomainError('LLM_PARSE_ERROR', 'Verdict agent tidak sesuai schema yang diharapkan', 502, {
          issues: verdictParse.error.issues,
        });
      }
      const verdict = verdictParse.data;

      await query(
        `INSERT INTO alert_outbox (transaction_ref, payload, status) VALUES ($1, $2, 'pending')`,
        [verdict.transaction_id, JSON.stringify(verdict)],
      );

      return reply.code(200).send(verdict);
    }
  );

  });
};
