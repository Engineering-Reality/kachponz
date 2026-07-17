import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { DomainError } from '../types/domain.js';
import { authenticateRobot } from '../middleware/auth.js';
import { extractTextFromImage } from '../orchestrator/executors/visionExtract.js';
import { PDFParse } from 'pdf-parse';

const knowledgeBaseSchema = z.object({
  kb_id: z.string().uuid(),
  company_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.string().or(z.date()).optional(),
});

const kbCreateSchema = knowledgeBaseSchema.omit({ kb_id: true, company_id: true, created_at: true });

const kbDocumentSchema = z.object({
  doc_id: z.string().uuid(),
  kb_id: z.string().uuid(),
  filename: z.string(),
  file_type: z.enum(['pdf', 'image', 'txt']),
  status: z.enum(['processing', 'ready', 'failed']),
  uploaded_at: z.string().or(z.date()).optional(),
});

const kbDetailSchema = knowledgeBaseSchema.extend({
  documents: z.array(kbDocumentSchema),
});

/** Infers file_type from mimetype, falling back to the filename extension
 * for browsers that send a generic mimetype (e.g. text/plain vs
 * application/octet-stream for .txt). Returns null when unsupported. */
function detectFileType(mimetype: string, filename: string): 'pdf' | 'image' | 'txt' | null {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype === 'text/plain') return 'txt';
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'txt') return 'txt';
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  return null;
}

async function extractRawText(buffer: Buffer, fileType: 'pdf' | 'image' | 'txt', mimetype: string): Promise<string> {
  if (fileType === 'txt') return buffer.toString('utf8');
  if (fileType === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
  return extractTextFromImage(buffer, mimetype);
}

export const registerKnowledgeBaseRoutes: FastifyPluginAsync = async (rootApp: FastifyInstance) => {
  await rootApp.register(async (app) => {
    app.addHook('preHandler', authenticateRobot);

    // POST /knowledge-bases
    app.post(
      '/knowledge-bases',
      {
        schema: {
          body: kbCreateSchema,
          response: { 201: knowledgeBaseSchema },
        },
      },
      async (request, reply) => {
        const body = request.body as z.infer<typeof kbCreateSchema>;
        const res = await query(
          `INSERT INTO knowledge_bases (name, description, company_id) VALUES ($1, $2, $3) RETURNING *`,
          [body.name, body.description ?? null, request.auth!.companyId],
        );
        return reply.code(201).send(res.rows[0]);
      },
    );

    // GET /knowledge-bases
    app.get(
      '/knowledge-bases',
      {
        schema: { response: { 200: z.array(knowledgeBaseSchema) } },
      },
      async (request, reply) => {
        const res = await query(
          'SELECT * FROM knowledge_bases WHERE company_id = $1 ORDER BY name ASC',
          [request.auth!.companyId],
        );
        return reply.code(200).send(res.rows);
      },
    );

    // GET /knowledge-bases/:id — KB + its documents (status per document, for the UI)
    app.get(
      '/knowledge-bases/:id',
      {
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: kbDetailSchema },
        },
      },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const kbRes = await query(
          'SELECT * FROM knowledge_bases WHERE kb_id = $1 AND company_id = $2',
          [id, request.auth!.companyId],
        );
        if (kbRes.rows.length === 0) {
          throw new DomainError('NOT_FOUND', 'Knowledge base tidak ditemukan', 404);
        }
        const docsRes = await query(
          'SELECT doc_id, kb_id, filename, file_type, status, uploaded_at FROM kb_documents WHERE kb_id = $1 ORDER BY uploaded_at DESC',
          [id],
        );
        return reply.code(200).send({ ...kbRes.rows[0], documents: docsRes.rows });
      },
    );

    // DELETE /knowledge-bases/:id — cascades to kb_documents + agent_knowledge_bases
    app.delete(
      '/knowledge-bases/:id',
      {
        schema: { params: z.object({ id: z.string().uuid() }) },
      },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const res = await query(
          'DELETE FROM knowledge_bases WHERE kb_id = $1 AND company_id = $2 RETURNING *',
          [id, request.auth!.companyId],
        );
        if (res.rows.length === 0) {
          throw new DomainError('NOT_FOUND', 'Knowledge base tidak ditemukan', 404);
        }
        return reply.code(204).send();
      },
    );

    // POST /knowledge-bases/:id/documents — multipart upload (pdf/image/txt)
    app.post(
      '/knowledge-bases/:id/documents',
      {
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 201: kbDocumentSchema },
        },
      },
      async (request, reply) => {
        const { id: kbId } = request.params as { id: string };

        const owned = await query('SELECT 1 FROM knowledge_bases WHERE kb_id = $1 AND company_id = $2', [
          kbId,
          request.auth!.companyId,
        ]);
        if (owned.rows.length === 0) {
          throw new DomainError('NOT_FOUND', 'Knowledge base tidak ditemukan', 404);
        }

        const data = await request.file();
        if (!data) {
          throw new DomainError('VALIDATION_ERROR', 'file wajib disertakan (multipart field "file")', 400);
        }

        const fileType = detectFileType(data.mimetype, data.filename);
        if (!fileType) {
          throw new DomainError(
            'VALIDATION_ERROR',
            'Tipe file tidak didukung — hanya PDF, image, atau TXT',
            400,
          );
        }

        const buffer = await data.toBuffer();

        const inserted = await query<{ doc_id: string }>(
          `INSERT INTO kb_documents (kb_id, filename, file_type, status) VALUES ($1, $2, $3, 'processing') RETURNING doc_id`,
          [kbId, data.filename, fileType],
        );
        const insertedRow = inserted.rows[0];
        if (!insertedRow) {
          throw new DomainError('INTERNAL_ERROR', 'Gagal membuat dokumen', 500);
        }
        const docId = insertedRow.doc_id;

        try {
          const rawText = await extractRawText(buffer, fileType, data.mimetype);
          const updated = await query(
            `UPDATE kb_documents SET raw_text = $1, status = 'ready' WHERE doc_id = $2
             RETURNING doc_id, kb_id, filename, file_type, status, uploaded_at`,
            [rawText, docId],
          );
          return reply.code(201).send(updated.rows[0]);
        } catch (e) {
          request.log.warn({ err: e, docId, fileType }, 'KB document text extraction failed');
          const failed = await query(
            `UPDATE kb_documents SET status = 'failed' WHERE doc_id = $1
             RETURNING doc_id, kb_id, filename, file_type, status, uploaded_at`,
            [docId],
          );
          return reply.code(201).send(failed.rows[0]);
        }
      },
    );

    // DELETE /knowledge-bases/:id/documents/:docId
    app.delete(
      '/knowledge-bases/:id/documents/:docId',
      {
        schema: {
          params: z.object({ id: z.string().uuid(), docId: z.string().uuid() }),
        },
      },
      async (request, reply) => {
        const { id: kbId, docId } = request.params as { id: string; docId: string };

        const owned = await query('SELECT 1 FROM knowledge_bases WHERE kb_id = $1 AND company_id = $2', [
          kbId,
          request.auth!.companyId,
        ]);
        if (owned.rows.length === 0) {
          throw new DomainError('NOT_FOUND', 'Knowledge base tidak ditemukan', 404);
        }

        const res = await query('DELETE FROM kb_documents WHERE doc_id = $1 AND kb_id = $2 RETURNING *', [
          docId,
          kbId,
        ]);
        if (res.rows.length === 0) {
          throw new DomainError('NOT_FOUND', 'Dokumen tidak ditemukan', 404);
        }
        return reply.code(204).send();
      },
    );
  });
};
