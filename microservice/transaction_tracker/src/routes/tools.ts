import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { DomainError } from '../types/domain.js';

export const registerToolsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Base Tool schema
  const toolSchema = z.object({
    tool_id: z.string().uuid(),
    user_id: z.string().uuid().nullable().optional(),
    company_id: z.string().uuid().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    versions: z.any().nullable().optional(), // JSONB
    on_status: z.string().nullable().optional(),
  });

  const toolCreateSchema = toolSchema.omit({ tool_id: true, user_id: true, company_id: true });
  const toolUpdateSchema = toolSchema.omit({ tool_id: true, user_id: true, company_id: true }).partial();

  // GET /tools
  app.get(
    '/tools',
    {
      schema: {
        response: {
          200: z.array(toolSchema),
        },
      },
    },
    async (request, reply) => {
      const res = await query('SELECT * FROM tools ORDER BY name ASC');
      return reply.code(200).send(res.rows);
    }
  );

  // GET /tools/:id
  app.get(
    '/tools/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: toolSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const res = await query('SELECT * FROM tools WHERE tool_id = $1', [id]);
      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Tool tidak ditemukan', 404);
      }
      return reply.code(200).send(res.rows[0]);
    }
  );

  // POST /tools
  app.post(
    '/tools',
    {
      schema: {
        body: toolCreateSchema,
        response: {
          201: toolSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as z.infer<typeof toolCreateSchema>;
      
      const res = await query(
        `INSERT INTO tools (name, description, versions, on_status)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          body.name, 
          body.description || '', 
          body.versions ? JSON.stringify(body.versions) : '[]', 
          body.on_status || 'Offline'
        ]
      );
      return reply.code(201).send(res.rows[0]);
    }
  );

  // PUT /tools/:id
  app.put(
    '/tools/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: toolUpdateSchema,
        response: {
          200: toolSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof toolUpdateSchema>;
      
      // We do a simple dynamic update
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (body.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(body.name);
      }
      if (body.description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(body.description);
      }
      if (body.versions !== undefined) {
        fields.push(`versions = $${idx++}`);
        values.push(body.versions ? JSON.stringify(body.versions) : '[]');
      }
      if (body.on_status !== undefined) {
        fields.push(`on_status = $${idx++}`);
        values.push(body.on_status);
      }

      if (fields.length === 0) {
        throw new DomainError('VALIDATION_ERROR', 'Tidak ada data untuk diperbarui', 400);
      }

      values.push(id);
      
      const res = await query(
        `UPDATE tools SET ${fields.join(', ')} WHERE tool_id = $${idx} RETURNING *`,
        values
      );

      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Tool tidak ditemukan', 404);
      }
      return reply.code(200).send(res.rows[0]);
    }
  );

  // DELETE /tools/:id
  app.delete(
    '/tools/:id',
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const res = await query('DELETE FROM tools WHERE tool_id = $1 RETURNING *', [id]);
      
      if (res.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 'Tool tidak ditemukan', 404);
      }
      return reply.code(204).send();
    }
  );
};
