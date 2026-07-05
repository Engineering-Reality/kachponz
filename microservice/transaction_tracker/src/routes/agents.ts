import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { DomainError } from '../types/domain.js';

export const registerAgentsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
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
      const res = await query('SELECT * FROM agents ORDER BY agent_name ASC');
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
      const res = await query('SELECT * FROM agents WHERE agent_id = $1', [id]);
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
        `INSERT INTO agents (agent_name, description, agent_style, on_status, tools, share_editor_with)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          body.agent_name, 
          body.description || '', 
          body.agent_style || '', 
          body.on_status ?? true,
          body.tools || [],
          body.share_editor_with || []
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
      
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (body.agent_name !== undefined) {
        fields.push(`agent_name = $${idx++}`);
        values.push(body.agent_name);
      }
      if (body.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(body.description);
      }
      if (body.agent_style !== undefined) {
        fields.push(`agent_style = $${idx++}`);
        values.push(body.agent_style);
      }
      if (body.on_status !== undefined) {
        fields.push(`on_status = $${idx++}`);
        values.push(body.on_status);
      }
      if (body.tools !== undefined) {
        fields.push(`tools = $${idx++}`);
        values.push(body.tools);
      }
      if (body.share_editor_with !== undefined) {
        fields.push(`share_editor_with = $${idx++}`);
        values.push(body.share_editor_with);
      }

      if (fields.length === 0) {
        throw new DomainError('VALIDATION_ERROR', 'Tidak ada data untuk diperbarui', 400);
      }

      values.push(id);
      
      const res = await query(
        `UPDATE agents SET ${fields.join(', ')} WHERE agent_id = $${idx} RETURNING *`,
        values
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
      const res = await query('DELETE FROM agents WHERE agent_id = $1 RETURNING *', [id]);
      
      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Agent tidak ditemukan', 404);
      }
      return reply.code(204).send();
    }
  );
};
