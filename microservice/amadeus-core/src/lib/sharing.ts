/**
 * Feature Sharing permission check — built from microservice/feature_sharing/
 * README.md's Permissions section (no legacy Python implementation exists).
 * Single reusable check for all six share endpoints, per feature.md's
 * explicit requirement not to duplicate this logic per-route.
 *
 * Rules (README, verbatim):
 *   - Only the owner of an agent/thread can share it.
 *   - Users in the same company as the owner can also share it.
 *   - Users with editor access to an agent can share threads created with
 *     that agent.
 *
 * Threads (agent_logs) have no user_id/company_id of their own — ownership
 * is entirely inherited from the parent agent — so callers always pass the
 * *agent's* row here, even for thread-share endpoints.
 */

import { randomBytes } from 'node:crypto';
import type { AuthContext } from '../types/domain.js';
import { findUserEmailById } from '../services/users.js';

export interface ShareableAgent {
  user_id: string | null;
  company_id: string | null;
  share_editor_with: string[] | null;
}

export async function canShareResource(auth: AuthContext, agent: ShareableAgent): Promise<boolean> {
  if (agent.user_id && agent.user_id === auth.serviceAccountId) return true;
  if (agent.company_id && agent.company_id === auth.companyId) return true;

  if (agent.share_editor_with && agent.share_editor_with.length > 0) {
    const email = await findUserEmailById(auth.serviceAccountId);
    if (email && agent.share_editor_with.includes(email)) return true;
  }
  return false;
}

/** Matches the README's example format, e.g. "061d0a94b6488dab" (16 hex chars). */
export function generatePublicHash(): string {
  return randomBytes(8).toString('hex');
}
