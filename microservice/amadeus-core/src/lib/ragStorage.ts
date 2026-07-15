/**
 * Local-disk file storage for RAG uploads — the TS/on-prem equivalent of
 * legacy Python's SupabaseStorageClient (microservice/rag/service/
 * storage_database/_storage_utils.py). No object-storage client exists
 * anywhere else in amadeus-core (self-hosted Postgres only, no Supabase
 * SDK) so files are addressed by file_id on local disk rather than a
 * bucket path.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

function filePath(fileId: string): string {
  // file_id is always a generated UUID (never taken from client input as a
  // path component), so no path-traversal surface here.
  return path.join(env.RAG_STORAGE_DIR, fileId);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(env.RAG_STORAGE_DIR, { recursive: true });
}

export async function saveFile(buffer: Buffer): Promise<string> {
  await ensureDir();
  const fileId = randomUUID();
  await fs.writeFile(filePath(fileId), buffer);
  return fileId;
}

export async function replaceFile(fileId: string, buffer: Buffer): Promise<void> {
  await ensureDir();
  await fs.writeFile(filePath(fileId), buffer);
}

export async function deleteFiles(fileIds: string[]): Promise<void> {
  await Promise.all(
    fileIds.map((id) => fs.rm(filePath(id), { force: true })),
  );
}
