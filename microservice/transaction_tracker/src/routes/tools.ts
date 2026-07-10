import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { DomainError } from '../types/domain.js';

const SECRET_KEY_RE = /secret|password|token|key/i;

function maskSecrets(env: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    masked[k] = SECRET_KEY_RE.test(k) && v.length > 6
      ? v.slice(0, 6) + '••••••••'
      : v;
  }
  return masked;
}

/** Reject credentials embedded in args — they must go in env instead. */
function rejectCredsInArgs(args: string[]): string | null {
  for (const arg of args) {
    if (typeof arg === 'string' && /clientSecret|client_secret|password/i.test(arg)) {
      return 'Credentials must be stored in the "env" field, not embedded in "args". ' +
             'Move your clientId/clientSecret/etc. to env as UIPATH_CLIENT_ID, UIPATH_CLIENT_SECRET, etc.';
    }
  }
  return null;
}

export const registerToolsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Structured MCP server release contract (see bugfix1.md Bug 1). `command`
  // is the executable, `args` is an array passed as-is to execvp — no shell
  // interpolation, no re-splitting of a concatenated string.
  const ReleaseSchema = z.discriminatedUnion('method', [
    z.object({
      method: z.literal('stdio'),
      command: z.string().min(1),
      args: z.array(z.string()),
      env: z.record(z.string()).default({}),
    }),
    z.object({
      method: z.literal('sse'),
      // Legacy/display only — the live port is assigned at process-start
      // time and lives solely in mcp_runtime_state (see portprompt.md).
      // Never treated as durable config; optional so the UI no longer has
      // to submit a value the user typed.
      port: z.number().int().positive().optional(),
      command: z.string().min(1),
      args: z.array(z.string()),
      env: z.record(z.string()).default({}),
    }),
  ]);

  const VersionSchema = z
    .object({
      version: z.string().optional(),
      released: ReleaseSchema,
    })
    .passthrough();

  // Response schema stays lenient on `versions` — pre-existing rows in the DB
  // may still hold the legacy (broken) shape, and response validation must
  // not 500 on reads of old data. Only writes are held to the strict shape.
  const toolSchema = z.object({
    tool_id: z.string().uuid(),
    user_id: z.string().uuid().nullable().optional(),
    company_id: z.string().uuid().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    versions: z.any().nullable().optional(), // JSONB
    on_status: z.string().nullable().optional(),
  });

  // Write schema enforces the structured {command, args[], env} contract so
  // the UI/API can never persist the broken concatenated-string shape again.
  const toolWriteSchema = z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    versions: z.array(VersionSchema).nullable().optional(),
    on_status: z.string().nullable().optional(),
  });

  const toolCreateSchema = toolWriteSchema;
  const toolUpdateSchema = toolWriteSchema.partial();

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
      // Mask secrets in env before returning to frontend
      const tool = { ...res.rows[0] };
      try {
        let versions = typeof tool.versions === 'string' ? JSON.parse(tool.versions) : tool.versions;
        if (Array.isArray(versions)) {
          versions = versions.map((v: any) => {
            if (v?.released?.env) {
              return { ...v, released: { ...v.released, env: maskSecrets(v.released.env) } };
            }
            return v;
          });
          tool.versions = versions;
        }
      } catch { /* leave as-is if parsing fails */ }
      return reply.code(200).send(tool);
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

      // Phase 3a: Reject credentials in args
      if (Array.isArray(body.versions)) {
        for (const v of body.versions) {
          const released = (v as any)?.released;
          if (released?.args) {
            const rejection = rejectCredsInArgs(released.args);
            if (rejection) {
              throw new DomainError('CREDENTIALS_IN_ARGS', rejection, 400);
            }
          }
        }
      }
      
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

      // Phase 3a: Reject credentials in args
      if (Array.isArray(body.versions)) {
        for (const v of body.versions) {
          const released = (v as any)?.released;
          if (released?.args) {
            const rejection = rejectCredsInArgs(released.args);
            if (rejection) {
              throw new DomainError('CREDENTIALS_IN_ARGS', rejection, 400);
            }
          }
        }
      }
      
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
