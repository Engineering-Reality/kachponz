/**
 * middleware/auth.ts — X-Robot-Key authentication.
 *
 * Validates the `X-Robot-Key` header against hashed keys stored
 * in the `service_accounts` table.  Uses argon2 for hash comparison.
 *
 * This middleware attaches `serviceAccount` to the Fastify request
 * object so downstream routes can read robot_name / company_id.
 */
import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import argon2 from "argon2";
import { pool } from "../db/index.js";
import { UnauthorizedError } from "../errors/index.js";

declare module "fastify" {
  interface FastifyRequest {
    serviceAccount: {
      id: string;
      robot_name: string;
      company_id: string;
    };
  }
}

interface ServiceAccountRow {
  id: string;
  robot_name: string;
  api_key_hash: string;
  company_id: string;
  is_active: boolean;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const rawKey = request.headers["x-robot-key"];

  if (!rawKey || typeof rawKey !== "string" || rawKey.trim() === "") {
    const err = new UnauthorizedError(
      "Missing X-Robot-Key header",
      { hint: "Include X-Robot-Key: <api_key> in every request" }
    );
    reply.status(err.statusCode).send(err.toResponse());
    return;
  }

  // Fetch all active accounts and compare hash.
  // In production with many robots, add an indexed lookup by key prefix.
  const result = await pool.query<ServiceAccountRow>(
    `SELECT id, robot_name, api_key_hash, company_id, is_active
     FROM service_accounts
     WHERE is_active = true`
  );

  for (const account of result.rows) {
    try {
      const match = await argon2.verify(account.api_key_hash, rawKey);
      if (match) {
        request.serviceAccount = {
          id: account.id,
          robot_name: account.robot_name,
          company_id: account.company_id,
        };
        return; // authenticated
      }
    } catch {
      // argon2.verify throws on malformed hashes — skip, don't leak
      continue;
    }
  }

  const err = new UnauthorizedError("Invalid X-Robot-Key");
  reply.status(err.statusCode).send(err.toResponse());
}

/** Register auth middleware as a Fastify hook on a plugin scope */
export function registerAuthHook(fastify: FastifyInstance): void {
  fastify.addHook("preHandler", authMiddleware);
}
