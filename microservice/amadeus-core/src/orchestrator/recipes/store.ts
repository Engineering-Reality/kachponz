/**
 * Per-agent recipe persistence — replaces the old static in-memory registry
 * now that a recipe belongs to a specific agent row (zero-or-one, enforced by
 * `agent_recipes.agent_id` being the primary key) rather than a fixed set of
 * code-registered ids.
 */

import { query } from '../../db/pool.js';
import type { RecipeDef } from './types.js';

export async function getRecipeForAgent(agentId: string): Promise<RecipeDef | null> {
  const res = await query<{ recipe: RecipeDef }>('SELECT recipe FROM agent_recipes WHERE agent_id = $1', [agentId]);
  return res.rows[0]?.recipe ?? null;
}

export async function upsertRecipeForAgent(agentId: string, recipe: RecipeDef): Promise<RecipeDef> {
  const res = await query<{ recipe: RecipeDef }>(
    `INSERT INTO agent_recipes (agent_id, recipe, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (agent_id) DO UPDATE SET recipe = $2, updated_at = now()
     RETURNING recipe`,
    [agentId, JSON.stringify(recipe)],
  );
  return res.rows[0]!.recipe;
}

export async function deleteRecipeForAgent(agentId: string): Promise<boolean> {
  const res = await query('DELETE FROM agent_recipes WHERE agent_id = $1', [agentId]);
  return (res.rowCount ?? 0) > 0;
}
