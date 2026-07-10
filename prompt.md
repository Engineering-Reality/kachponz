# Amadeus — Stop the Agent From Re-Asking for folderId/Org/Tenant It Already Has

Working directory: `microservice/transaction_tracker/`.

## Root cause (confirmed by reading the code)

`buildSystemPrompt()` in `src/orchestrator/engine.ts`:

```ts
function buildSystemPrompt(agentStyle: string | null | undefined): string {
  const base = agentStyle?.trim() || "You are a helpful assistant.";
  return `${base}\n${ANTI_HALLUCINATION_SUFFIX}`;
}
```

This function has **zero knowledge of which tools are attached to the agent**, and zero knowledge of what configuration those tools already have (`env.UIPATH_FOLDER_ID`, `env.UIPATH_ORG`, `env.UIPATH_TENANT`, etc.). Even after the credentials-to-env migration, and even though `mcpAutoManager` correctly injects `UIPATH_FOLDER_ID` into the actual child process at spawn time (so the MCP tool itself *could* default `folderId` server-side when the model omits it), **the model has no way of knowing that default exists**. From its perspective, `folderId` just looks like an optional parameter it might need — and our own `ANTI_HALLUCINATION_SUFFIX` rule #4 ("if you are not sure, say what you actually know") actively reinforces asking rather than assuming, since the model has genuinely never been told a default is configured.

This is a system-prompt gap, not a tool-schema bug and not a UiPath bug. Fix it by telling the model what it already has, explicitly, every time.

## Fix — build a "known context" block from the agent's attached tools and prepend it to the system prompt

### 1. Add a context-resolution function in `engine.ts`

```ts
/**
 * Builds a block describing pre-configured values the model already has
 * access to via its tools' env config — so it stops asking the user for
 * things like folderId that are already resolved server-side.
 */
async function buildToolContextBlock(agentId: string): Promise<string> {
  // Reuse whatever query already fetches an agent's attached tools
  // (the same join used by loadMcpTools / the agent_tools table from the
  // earlier refactor — check what's already available, don't requery raw SQL
  // ad hoc if there's an existing helper for "tools attached to this agent").
  const { rows: toolRows } = await query(`
    SELECT t.tool_id, t.name, t.versions
    FROM agent_tools at
    JOIN tools t ON t.tool_id = at.tool_id
    WHERE at.agent_id = $1
  `, [agentId]);

  const blocks: string[] = [];

  for (const row of toolRows) {
    let versions = row.versions;
    if (typeof versions === 'string') {
      try { versions = JSON.parse(versions); } catch { continue; }
    }
    const env = versions?.[versions.length - 1]?.released?.env;
    if (!env) continue;

    // Only surface non-secret, genuinely useful context fields — never
    // include anything matching the secret pattern, even accidentally.
    const contextFields: string[] = [];
    if (env.UIPATH_FOLDER_ID) contextFields.push(`folderId: ${env.UIPATH_FOLDER_ID}`);
    if (env.UIPATH_ORG) contextFields.push(`organization: ${env.UIPATH_ORG}`);
    if (env.UIPATH_TENANT) contextFields.push(`tenant: ${env.UIPATH_TENANT}`);

    if (contextFields.length > 0) {
      blocks.push(`Tool "${row.name}": ${contextFields.join(', ')} — already configured, use these automatically, do NOT ask the user for them.`);
    }
  }

  if (blocks.length === 0) return '';

  return `\n\n--- Pre-configured context for this agent's tools ---\n` +
    blocks.join('\n') +
    `\nUse these values automatically when calling tools. Only ask the user if a tool call ` +
    `explicitly fails due to one of these values being wrong (e.g. a folder-access error) — ` +
    `never ask preemptively for something listed above.\n`;
}
```

### 2. Wire it into `buildSystemPrompt` at both call sites

Change the signature to accept the resolved context block, and update both places that currently call `buildSystemPrompt(agentConfig.agent_style)` (lines ~781 and ~1004):

```ts
function buildSystemPrompt(agentStyle: string | null | undefined, toolContext: string): string {
  const base = agentStyle?.trim() || "You are a helpful assistant.";
  return `${base}${toolContext}\n${ANTI_HALLUCINATION_SUFFIX}`;
}
```

```ts
// at both call sites — resolve the context block once, before building the agent:
const toolContext = await buildToolContextBlock(agentConfig.agent_id);
// ...
stateModifier: buildSystemPrompt(agentConfig.agent_style, toolContext),
```

Order matters: put the tool-context block **before** `ANTI_HALLUCINATION_SUFFIX`, not after — the anti-hallucination rules should be the last, most emphatic thing the model reads, but the tool context needs to be present so rule #4 doesn't misfire into "I'm not sure, better ask" for something that's actually already known.

### 3. Extend this beyond folderId — anything env-configured and non-secret is fair game

The pattern above only surfaces `UIPATH_FOLDER_ID`/`UIPATH_ORG`/`UIPATH_TENANT` explicitly. Generalize it slightly so any future tool type benefits without needing another hand-written block:

```ts
const NON_SECRET_CONTEXT_KEYS = [
  'UIPATH_FOLDER_ID', 'UIPATH_ORG', 'UIPATH_TENANT', 'UIPATH_BASE_URL',
  // add more as new tool types are registered — keep this an explicit allowlist,
  // never an inferred "anything not matching /secret/i" rule, since that's a
  // much easier place for a real credential to slip through by accident.
];

for (const [key, value] of Object.entries(env)) {
  if (NON_SECRET_CONTEXT_KEYS.includes(key) && value) {
    contextFields.push(`${key}: ${value}`);
  }
}
```

Using an **explicit allowlist** (not a secret-pattern blocklist) here is a deliberate safety choice — a blocklist can miss a credential with an unexpected key name; an allowlist can only ever leak what's explicitly been reviewed and added.

## Verification — confirm the actual env value is correct first

Before testing the system-prompt fix, confirm the underlying data is actually right — if `UIPATH_FOLDER_ID` itself is wrong or missing for this specific tool row (e.g. it fell back to the migration's default `'0'` because the original registration never had a real folderId in its credentials blob), the model will stop asking but tool calls will still fail silently against the wrong folder, which is worse than asking.

```bash
psql $DATABASE_URL -c "
  SELECT name, versions->-1->'released'->'env'->>'UIPATH_FOLDER_ID' as folder_id
  FROM tools WHERE name ILIKE '%uipath%';
"
# confirm this shows the REAL folder id (e.g. 997942), not "0" or null
```

If it shows `0` or null, fix the data directly for now (this is the same tool row from the earlier credentials-migration work — update it with the correct folder ID), and separately note that the migration's `COALESCE(..., '0')` fallback silently produced a wrong-but-present value instead of flagging the row for manual review. That's worth revisiting in the migration script for any *future* tool registrations that go through it, but isn't urgent to redo retroactively — just fix this one row's data now.

## Also check: does the live MCP tool schema actually mark `folderId` optional?

Even with the system-prompt fix, if the tool's own Zod schema requires `folderId` (no `.optional()`), the LLM tool-calling contract itself forces it to supply something every time regardless of what the system prompt says. Since the actual UiPath MCP server now lives outside this repo (per the recent singleton-connection fix, which had to be applied directly to a local `build/index.js` because "this dir has no source, only the built artifact"), you can't just grep the source here — check the live schema instead:

```bash
npx @modelcontextprotocol/inspector http://localhost:<current-port>/sse
# inspect list_uipath_processes / list_uipath_queues / trigger_uipath_job's inputSchema
# confirm folderId shows required: false in the JSON schema
```

If it's required, the fix has to happen in whatever the current real source of the UiPath MCP tool is — which, given the singleton-fix note, might currently only exist as a patched local `build/index.js` with no corresponding source anywhere. **This is worth resolving as its own follow-up**: find out where `amadeus-uipath-mcp`'s actual source of truth lives now (a separate repo? not yet extracted anywhere and the build artifact IS the only copy?) before making further changes to it — two emergency patches in a row applied directly to a build artifact with no source is a sign this needs to be consolidated somewhere durable before it happens a third time.

## Verification plan

```bash
# 1. Confirm the env value is correct (see above)

# 2. Restart, open a NEW chat with the UiPath agent, ask something that needs folderId
#    e.g. "list my uipath processes"
#    Expected: NO question about folderId — it should just work, using the
#    configured value silently.

# 3. Confirm it still asks appropriately when something IS actually wrong —
#    temporarily set env.UIPATH_FOLDER_ID to an invalid value, restart, ask again
#    Expected: the tool call fails with a real UiPath error (folder not found /
#    access denied), and the model reports that actual error rather than either
#    (a) claiming success or (b) asking the user to supply a folderId it should
#    already have — it should say something like "the configured folder (XXXX)
#    isn't accessible, here's the actual error" not silently re-prompt.
#    Restore the correct value after this test.

# 4. Confirm secrets never leak into the context block —
#    grep the actual system prompt sent to the LLM (add a temporary debug log
#    of the full stateModifier string, or check via LangSmith/tracing if wired up)
#    and confirm UIPATH_CLIENT_SECRET or any credential never appears in it,
#    only the explicitly-allowlisted non-secret fields.
```

All four must pass. Step 4 matters most — a context-injection feature that accidentally leaks `UIPATH_CLIENT_SECRET` into the system prompt (which then gets sent to the LLM provider, potentially logged by DashScope/whatever provider is in use) would be a real security regression, not just a cosmetic one.

## Constraints

- Explicit allowlist for context fields, never a secret-pattern blocklist.
- Tool-context block goes before `ANTI_HALLUCINATION_SUFFIX` in the assembled prompt, not after.
- Don't touch the external UiPath MCP package's schema/source in this pass — that's a separate, larger question about where its source of truth now lives. This fix is fully contained within `transaction_tracker`, which is why it's the right first move regardless of that unresolved question.
