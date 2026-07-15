import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { callFn } from '../db/rpc.js';
import { DomainError } from '../types/domain.js';
import { authenticateRobot } from '../middleware/auth.js';

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
  });
};
