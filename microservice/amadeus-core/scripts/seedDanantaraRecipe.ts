/**
 * One-off admin script: attaches the ported `danantaraSurveyLoopRecipe`
 * (creatoroop.md) to the real Danantara agent row. Not a public endpoint —
 * run once per environment, same convention as scripts/registerUser.ts.
 *
 * Usage:
 *   npm run recipe:seed-danantara -- --agent-name "Danantara CX100"
 *   npm run recipe:seed-danantara -- --agent-id <uuid>
 *
 * The recipe's `agentId` is intentionally blank in danantaraSurveyLoop.ts
 * since the real agent_id is a Supabase-generated UUID not known at
 * code-authoring time — this script resolves it and fills it in.
 */
import { query } from '../src/db/pool.js';
import { danantaraSurveyLoopRecipe } from '../src/orchestrator/recipes/danantaraSurveyLoop.js';
import { upsertRecipeForAgent } from '../src/orchestrator/recipes/store.js';

interface Args {
  agentId?: string;
  agentName?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--agent-id') out.agentId = argv[++i];
    else if (a === '--agent-name') out.agentName = argv[++i];
  }
  return out;
}

async function resolveAgentId(args: Args): Promise<string> {
  if (args.agentId) return args.agentId;
  if (!args.agentName) {
    console.error('ERROR: must pass either --agent-id <uuid> or --agent-name <name>.');
    process.exit(2);
  }
  const res = await query<{ agent_id: string }>('SELECT agent_id FROM agents WHERE agent_name = $1', [args.agentName]);
  if (res.rows.length === 0) {
    console.error(`ERROR: no agent found with agent_name = "${args.agentName}".`);
    process.exit(3);
  }
  if (res.rows.length > 1) {
    console.error(`ERROR: multiple agents named "${args.agentName}" — pass --agent-id instead.`);
    process.exit(3);
  }
  return res.rows[0]!.agent_id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const agentId = await resolveAgentId(args);

  const recipe = { ...danantaraSurveyLoopRecipe, agentId };
  await upsertRecipeForAgent(agentId, recipe);

  console.log(`Seeded recipe "${recipe.id}" for agent ${agentId}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR seeding Danantara recipe:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
