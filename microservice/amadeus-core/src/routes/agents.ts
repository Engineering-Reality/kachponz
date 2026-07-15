import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { callFn } from '../db/rpc.js';
import { DomainError } from '../types/domain.js';
import { authenticateRobot } from '../middleware/auth.js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

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
    created_at: z.string().or(z.date()).optional(),
  });

  const agentCreateSchema = agentSchema.omit({ agent_id: true, user_id: true, company_id: true, created_at: true });
  const agentUpdateSchema = agentSchema.omit({ agent_id: true, user_id: true, company_id: true, created_at: true }).partial();

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
      return reply.code(200).send(res.rows);
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
      return reply.code(200).send(res.rows[0]);
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
      return reply.code(201).send(res.rows[0]);
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
      return reply.code(200).send(res.rows[0]);
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
        : process.env.QWEN_API_KEY;
      const baseURL = runtime === 'on_prem'
        ? 'https://api.netraruntime.com/v1'
        : process.env.QWEN_BASE_URL;
      const modelName = runtime === 'on_prem' ? 'qwen3.6-35b' : (process.env.QWEN_LLM_MODEL || 'qwen3.6-35b');

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

  });
};
