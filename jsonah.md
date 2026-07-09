# Amadeus — MCP Tool Schemas Are Being Discarded Before They Reach the LLM

Working directory: `microservice/transaction_tracker/` and `microservice/mcp-uipath/`.

## What's actually happening (read the transcript evidence first)

In the failing session, the model called `bulk_add_uipath_queue_items` **four times** with a different shape each time:

1. `{"queue_name": "...", "items": "[{...stringified array...}]"}` — wrong key name (`queue_name` vs `queueName`) AND `items` sent as a JSON string, not an array.
2. `{"queueName": "...", "items": "[{...stringified...}]"}` — key name fixed, `items` still a string.
3. `{"queueName": "...", "data": "[{...stringified...}]"}` — renamed to `data`, still a string.
4. `{"queueName": "...", "items": "[{...stringified...}]"}` — back to `items`, still a string.

Every attempt fails the same way: **the array is sent as an escaped JSON string, never as a real nested array**, and the parameter name wanders because nothing is anchoring it.

## Root cause

`src/orchestrator/engine.ts`, function `loadMcpTools()`:

```ts
for (const mcpTool of mcpTools) {
  langchainTools.push(
    new DynamicStructuredTool({
      name: mcpTool.name,
      description: mcpTool.description || "MCP Tool",
      schema: z.record(z.any()), // Pass-through Schema
      func: async (args: any) => { ... },
    })
  );
}
```

Every MCP tool, no matter what its real input contract is, gets wrapped with `z.record(z.any())` — a schema that says "accept any object with any keys." The MCP server's `listTools()` response already contains the **real** JSON Schema for each tool (via `mcpTool.inputSchema`) — e.g. for `bulk_add_uipath_queue_items` that schema says `items` is `{"type": "array", "items": {"type": "object"}}`. That information exists and is available at this exact point in the code, and it is thrown away.

Consequence: the model gets zero structural guidance from tool-calling. It cannot know `items` must be an array instead of a string, and it cannot know the exact key name is `items` and not `data`, because the schema it's bound against says "any shape is fine." It's guessing from the natural-language `description` field alone, which is exactly what you're seeing in the transcript — repeated, slightly-different guesses.

This is not a DashScope-specific bug, but DashScope (and most non-OpenAI-native function-calling implementations) are far less forgiving of a loose/absent schema than OpenAI's implementation tends to be in practice — so it surfaces here first, but the underlying defect affects every model you might point this at.

## Fix — Part 1: Convert the real MCP `inputSchema` into a real Zod schema

Add `src/orchestrator/jsonSchemaToZod.ts`:

```ts
import { z, ZodTypeAny } from "zod";

/**
 * Minimal JSON Schema -> Zod converter, scoped to what MCP tool inputSchemas
 * actually contain (object/string/number/boolean/array/enum, required[]).
 * This is intentionally not a general-purpose converter — it covers exactly
 * the shapes MCP tools emit, and falls back to z.any() for anything unrecognized
 * rather than throwing, so an unusual schema degrades gracefully instead of
 * breaking tool loading entirely.
 */
export function jsonSchemaToZod(schema: any): ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.any();

  switch (schema.type) {
    case "string":
      return schema.enum ? z.enum(schema.enum as [string, ...string[]]) : z.string();

    case "number":
    case "integer":
      return z.number();

    case "boolean":
      return z.boolean();

    case "array": {
      const itemSchema = schema.items ? jsonSchemaToZod(schema.items) : z.any();
      return z.array(itemSchema);
    }

    case "object": {
      const props = schema.properties ?? {};
      const required: string[] = schema.required ?? [];
      const shape: Record<string, ZodTypeAny> = {};

      for (const [key, propSchema] of Object.entries(props)) {
        let fieldSchema = jsonSchemaToZod(propSchema);
        if (!required.includes(key)) {
          fieldSchema = fieldSchema.optional();
        }
        shape[key] = fieldSchema;
      }
      // Allow additional keys the schema didn't explicitly declare, rather than
      // rejecting outright — MCP tool schemas aren't always perfectly strict.
      return z.object(shape).passthrough();
    }

    default:
      return z.any();
  }
}
```

Update `loadMcpTools()` in `engine.ts`:

```ts
import { jsonSchemaToZod } from "./jsonSchemaToZod.js";

// ...

for (const mcpTool of mcpTools) {
  const realSchema = mcpTool.inputSchema
    ? jsonSchemaToZod(mcpTool.inputSchema)
    : z.record(z.any()); // fallback only if the server genuinely provides no schema

  langchainTools.push(
    new DynamicStructuredTool({
      name: mcpTool.name,
      description: mcpTool.description || "MCP Tool",
      schema: realSchema,
      func: async (args: any) => { /* unchanged */ },
    })
  );
}
```

Log the derived schema shape once per tool at connect time (`log.debug({ tool: mcpTool.name, schema: realSchema.shape ?? 'passthrough' }, 'MCP tool schema bound')`) so schema mismatches are debuggable going forward instead of only visible through model guessing behavior.

## Fix — Part 2: Defensive coercion server-side, because some models will still stringify nested fields even with a correct schema

Even OpenAI-native tool calling occasionally emits stringified JSON for deeply nested array/object parameters when routed through a proxy layer (which is effectively what DashScope's OpenAI-compatible endpoint is). Don't rely on Part 1 alone. In `microservice/mcp-uipath/src/index.ts`, wrap every array/object-typed Zod field that receives structured data with a preprocessor that accepts either the real shape or a JSON string of it:

```ts
import { z } from "zod";

/** Accepts either the real array/object, or a JSON string that parses to one. */
function coerceJson<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((val) => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch {
        return val; // let the inner schema's own validation produce the real error
      }
    }
    return val;
  }, inner);
}
```

Apply it to the three queue tools:

```ts
// bulk_add_uipath_queue_items
{
  queueName: z.string(),
  items: coerceJson(z.array(z.record(z.any())).min(1)),
  commitType: z.enum(["AllOrNothing", "StopOnFirstFailure"]).optional().default("StopOnFirstFailure"),
  priority: z.enum(["Low", "Normal", "High"]).optional().default("Normal"),
  folderId: z.string().optional(),
}

// add_uipath_queue_item
{
  queueName: z.string(),
  specificContent: coerceJson(z.record(z.any())),
  priority: z.enum(["Low", "Normal", "High"]).optional().default("Normal"),
  reference: z.string().optional(),
  folderId: z.string().optional(),
}
```

And the existing `trigger_uipath_job`'s `arguments` field, same treatment:

```ts
arguments: coerceJson(z.record(z.any())).optional().describe("InputArguments JSON to pass to the process"),
```

This means: whether the model sends a real array, a JSON string of that array, or (common failure mode) a double-escaped string, `coerceJson` unwraps one level of stringification before Zod's real structural validation runs. If it's still wrong after that (e.g. a string that isn't valid JSON, or valid JSON that isn't an array), the **real** Zod error fires with a clear message — see Part 3 for making that message actually useful to the model.

## Fix — Part 3: Make validation errors self-correcting in one round-trip, not four

Right now, when Zod validation fails inside `server.tool()`, the MCP SDK returns a generic JSON-RPC invalid-params error. Improve the specificity so the model can fix its own mistake immediately instead of thrashing across multiple turns like it did in the transcript.

Wrap each tool's handler entry with an explicit shape check before the main logic, returning a **descriptive, actionable** tool result (not a thrown exception) when the shape is still wrong after coercion:

```ts
async (args) => {
  if (!Array.isArray(args.items)) {
    return {
      content: [{
        type: "text",
        text: `Parameter "items" must be a JSON array of objects (e.g. [{"First Name":"John",...}, {...}]). ` +
              `Received type: ${typeof args.items}. Do not JSON.stringify the array — pass it as a native array value.`,
      }],
      isError: true,
    };
  }
  // ... existing logic
}
```

This matters because a same-turn correction (model sees a precise error, fixes it, calls again) is far cheaper and more reliable than hoping the model infers the right shape from a generic "invalid params" message across several conversation turns — which is exactly what produced the 4-attempt thrash in the transcript.

## Fix — Part 4: Diagnose the final "fetch failed" on `list_uipath_queues`

The last call in the transcript — a trivial, no-argument call to `list_uipath_queues` — failed with a generic "fetch failed" after the burst of malformed `bulk_add_uipath_queue_items` attempts. `list_uipath_queues` takes no complex arguments, so this isn't the schema bug; it's a separate symptom. Before assuming it's transient network flakiness, check these in order:

1. **Process health**: did the `mcp-uipath` child process crash or become unresponsive after the earlier malformed calls? Check `GET /orchestrator/mcp/status` (or equivalent from prior work) for this tool's `status`/`uptimeSec` immediately after reproducing this scenario. If the process restarted mid-conversation, that would explain a sudden, otherwise-inexplicable failure on a simple call.
2. **OAuth token cache state**: `getUiPathToken()`'s in-memory cache is per-process. If the earlier malformed calls somehow caused an uncaught exception mid-token-refresh (unlikely given the current try/catch shape, but verify), the cache could be left in a bad state. Add a log line at the top of `getUiPathToken()` when a fresh token fetch is triggered, so you can see whether `list_uipath_queues`'s failure coincides with a token refresh attempt.
3. **Rate limiting**: four rapid tool calls in ~1 second (per the timestamps in the transcript, all at 04:54 PM) is unlikely to trip UiPath Cloud's rate limits on its own, but check the raw response body of the failure — if `mcp-uipath`'s catch-all `Network error: ${e.message}` is swallowing a real HTTP 429 or 5xx body, you won't be able to tell. Change the catch block in all four tools to include the actual response status/body when available, not just the generic fetch exception message:

```ts
} catch (e) {
  const detail = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text", text: `Network error calling UiPath: ${detail}` }], isError: true };
}
```
(this may already be close to current behavior — the point is to confirm the actual underlying HTTP status is visible in logs, not just in the user-facing text, so this is diagnosable without asking the user to reproduce it again.)

Report back which of the three actually explains the `list_uipath_queues` failure before considering this part done — don't just assume "transient" and move on.

## Constraints (non-negotiable)

- **Every MCP tool's LangChain-facing schema must come from `mcpTool.inputSchema`**, not a blanket passthrough. `z.record(z.any())` is only acceptable as a last-resort fallback when a server genuinely provides no `inputSchema` at all.
- **Coercion (Part 2) is a safety net, not a replacement for Part 1.** Both ship together. Part 1 prevents most of the guessing; Part 2 catches what slips through anyway.
- **Validation error messages returned to the model must name the exact parameter and expected shape.** Generic "invalid params" is not acceptable for any tool a LangGraph agent calls.
- Apply the same `coerceJson` treatment to any other existing or future MCP tool in this codebase that takes an array or nested object parameter — this bug class isn't unique to the UiPath queue tools, it'll recur anywhere a structured parameter exists.

## Verification plan

```bash
cd microservice/mcp-uipath && npm run build
# restart the process per the earlier restart-detection work, or manually if that hasn't landed yet

# 1. Re-run the exact failing scenario end-to-end:
#    upload the same PDF, "extract please", then "send to my queue"
#    Expect: ONE bulk_add_uipath_queue_items call, items sent as a real array
#    (verify in the Agent Call Execution parameters panel — should render as
#    actual nested JSON, not a string with escaped quotes), success on first attempt.

# 2. Confirm list_uipath_queues still works immediately after a bulk add, back to back:
curl -N -X POST http://127.0.0.1:8080/orchestrator/run-agentic \
  -d '{"mode":"playground","agentId":"<uipath-agent>","idempotencyKey":"k1","stream":true,"prompt":"list my queues"}'
# expect success, no "fetch failed"

# 3. Deliberately test the coercion safety net — manually call the tool via
#    MCP Inspector with items as a STRINGIFIED array on purpose:
npx @modelcontextprotocol/inspector http://localhost:<port>/sse
#   bulk_add_uipath_queue_items { "queueName": "TestQueue", "items": "[{\"a\":1}]" }
#   expect: succeeds anyway (coercion unwraps the string), OR if truly malformed,
#   a clear message naming "items" and the expected shape — not a generic error.

# 4. Confirm the schema is actually being derived, not silently falling back:
#    check the new debug log line for each tool at MCP connect time, confirm
#    it shows real per-field shapes, not "passthrough" for the queue tools.
```

All four steps must pass before calling this done. Step 1 succeeding in a single tool call (not four attempts) is the actual fix being verified — the other three are regression guards.
