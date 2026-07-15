# Prompt #13 — Amadeus: Fix Multi-MCP Tool Name Collision (Agent UiPath Folder Mix)

## Context — read this before touching anything

1. `microservice/amadeus-core/src/orchestrator/engine.ts` — `loadMcpTools()`
   (currently around line 321). This function ALREADY supports connecting to
   multiple MCP servers per agent — it loops over `toolConfigs`, connects to each
   independently, and merges all their tools into one flat `langchainTools` array.
   This is functionally equivalent to legacy Python's `MultiServerMCPClient` pattern
   (`agent_boilerplate.py`). **Do not rebuild this from scratch — it already exists.**
   This prompt fixes one specific bug in it.
2. The bug: inside the `for (const mcpTool of mcpTools)` loop (~line 446),
   `langchainTools.push(new DynamicStructuredTool({ name: mcpTool.name, ... }))` uses
   the MCP server's own tool name with no namespacing. If two attached tool
   registrations are both mcp-uipath instances (e.g. pointed at different UiPath
   folders, tenants, or orgs via different `.env`/args), BOTH expose identically-named
   tools (`trigger_uipath_job`, `list_uipath_processes`, `wait_for_uipath_job`, etc.).
   Merged flat, these collide — the model has no way to address one specific server's
   version of a same-named tool.

## Before writing any fix — confirm this is actually needed for the use case

`folderId` is already a per-call argument on mcp-uipath's tools (confirmed across
every trigger_uipath_job / list_uipath_processes call in this project's history —
`{"folderId":"999269"}` is passed at call time, not baked into server config). If the
actual requirement is "one agent, two different UiPath **folders**, same org/tenant/
credentials," the simplest fix is: attach ONE mcp-uipath tool, and have the agent (or
a Recipe step, per Prompt 09/12) pass different `folderId` values across calls. That
needs zero code changes here.

This prompt's fix is for the case where two GENUINELY separate MCP server instances
are needed — different orgs/tenants/credentials, or two different tool types
entirely (not just two folders on one server). Confirm with Jandy which case
"Agent UiPath Folder Mix" actually is before assuming this prompt's fix is required.
If it turns out to be a same-org multi-folder case, skip this prompt and just document
the `folderId`-per-call pattern in the agent's system prompt instead.

## The fix — namespace LangChain-facing tool names by source registration

In `loadMcpTools()`, each `config` (a row from the `tools` table) already has a stable
identifier — `config.tool_id` and `config.name` (the human label Jandy gave that
specific tool registration, e.g. "UiPath Folder A" vs "UiPath Folder B"). Use a
sanitized version of `config.name` as a namespace prefix on the LangChain-facing tool
name ONLY — the underlying MCP `callTool` call must keep using the tool's real,
unprefixed name, since that's what the actual MCP server expects.

```ts
// Add near the top of loadMcpTools, before the toolConfigs loop:
function sanitizeToolPrefix(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40); // keep it bounded — very long tool names are unwieldy for the model
}

// Only prefix when there's more than one tool config attached — a single-tool
// agent (the common case, e.g. Danantara CX100 today) keeps unprefixed names
// exactly as before, so this is non-breaking for every existing agent.
const needsNamespacing = toolConfigs.length > 1;
```

Inside the `for (const config of toolConfigs)` loop, compute the prefix once per
config:

```ts
const namePrefix = needsNamespacing ? `${sanitizeToolPrefix(toolName)}__` : '';
```

Then, inside the inner `for (const mcpTool of mcpTools)` loop:

```ts
const langchainToolName = `${namePrefix}${mcpTool.name}`;
loadedNames.push(mcpTool.name); // keep the report showing real MCP tool names, unprefixed — that's for humans reading connection status, not for the model

langchainTools.push(
  new DynamicStructuredTool({
    name: langchainToolName, // prefixed — this is what the LLM sees and calls
    description: needsNamespacing
      ? `[${toolName}] ${mcpTool.description || "MCP Tool"}` // source tag so the model
                                                              // knows which registration
                                                              // this tool belongs to,
                                                              // not just a unique name
      : (mcpTool.description || "MCP Tool"),
    schema: realSchema,
    func: async (args: any) => {
      log.info({ tool: mcpTool.name, prefixedName: langchainToolName, action: "DRAFT_TO_PROCESSING" }, "🔌 Yielding to external MCP tool");
      const res = await mcpClient.callTool({
        name: mcpTool.name, // UNPREFIXED — this is the real call to this specific
                             // mcpClient, which is already the correct server for
                             // this iteration of the outer loop. Do not prefix this.
        arguments: args,
      });
      // ...rest of the function body (trace extraction, etc.) unchanged, still
      // keyed off mcpTool.name (unprefixed) — verify nothing else in this function
      // accidentally starts using langchainToolName where it should use mcpTool.name
      // ...
    },
  })
);
```

## Update the agent's system prompt builder to teach the naming convention

`buildSystemPrompt()` (or wherever `toolContext` gets assembled for the LLM) should
mention the namespacing when it's active, so the model doesn't get confused seeing
`uipath_folder_a__trigger_uipath_job` and `uipath_folder_b__trigger_uipath_job` as
separate tools without knowing why:

```
Catatan: agent ini terhubung ke lebih dari satu MCP server dengan tool yang mirip
namanya. Prefix sebelum "__" menunjukkan sumbernya — misalnya
"uipath_folder_a__trigger_uipath_job" adalah tool trigger_uipath_job dari server
"UiPath Folder A", BUKAN dari server lain. Selalu perhatikan prefix ini untuk
memastikan kamu memanggil server yang benar.
```

Only inject this note when `needsNamespacing` was true for that agent's tool set —
don't clutter single-tool agents' prompts with an explanation that doesn't apply.

## Verify nothing else assumes unprefixed names

Grep for other places that might break once tool names carry a prefix:

```bash
grep -n "mcpTool.name\|langchainTools\|loadedNames\|extractJobTraceMeta" microservice/amadeus-core/src/orchestrator/engine.ts
```

`extractJobTraceMeta(mcpTool.name, ...)` (confirmed at the write-back site) already
uses the raw `mcpTool.name` variable directly, not anything derived from the
LangChain tool's `.name` field — so it should be unaffected, but confirm this by
reading the call site again after the change, not just trusting this note.

## Acceptance criteria

- [ ] A single-tool agent (e.g. Danantara CX100) shows byte-identical tool names
      before and after this change — `needsNamespacing` must be `false` for it, zero
      behavior change.
- [ ] An agent with two mcp-uipath registrations attached shows both sets of tools
      with distinct prefixed names (e.g. `uipath_folder_a__trigger_uipath_job` and
      `uipath_folder_b__trigger_uipath_job`) in its available tool list.
- [ ] Calling the prefixed tool from an agent-invoke session actually reaches the
      correct underlying server — verify by triggering a job via each prefixed tool
      and confirming (via the UiPath Orchestrator dashboard or the job's `folderId` in
      its trace) that it landed in the expected folder/tenant, not the other one.
- [ ] The system prompt for a multi-server agent includes the naming-convention note;
      a single-server agent's prompt does not.
- [ ] `extractJobTraceMeta` and any other code keyed off tool names still receives the
      real, unprefixed MCP tool name — confirmed by re-reading those call sites, not
      assumed.

## Non-goals

- Do NOT change `loadMcpTools`'s behavior for single-tool agents in any way — this
  fix is additive and only activates when more than one tool is attached.
- Do NOT attempt to deduplicate or merge tools that happen to have the same name
  across servers into one "smart" tool that picks a server automatically — that
  removes the model's ability to deliberately choose, which defeats the point of
  "Folder Mix" as a concept. Namespacing preserves explicit choice; don't paper over it.
- Do NOT build this if the actual requirement turns out to be same-org multi-folder
  (see the "before writing any fix" section) — confirm with Jandy first.
