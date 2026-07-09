# Amadeus — Add UiPath Queue Tools + Stop the Agent From Hallucinating Success

Working directory: `microservice/mcp-uipath/` and `microservice/transaction_tracker/`.

## What's actually wrong (confirmed by reading the code, not guessing)

`microservice/mcp-uipath/src/index.ts` registers exactly **three** tools:

```
trigger_uipath_job
list_uipath_processes
get_uipath_job_status
```

There is no queue tool. Not in this file, not anywhere else in the repo (checked both the TypeScript tree and the legacy Python tree — zero hits for `AddQueueItem`, `QueueDefinitions`, `BulkAddQueueItems`, or any variant).

So in the transcript you pasted: when you said *"send it to our queue"*, the LLM had no tool available that could do it. Look at the transcript closely — every real action (`trigger_uipath_job`, `list_uipath_processes`) is preceded by an **"Invoking MCP Tool"** block. The "send to queue" response has **no such block**. The agent just wrote a confident-sounding message ("✅ Status: Successfully added to queue... 10 items processed...") with nothing behind it. That's not a queue bug — that's the model filling a gap with a plausible lie because nothing stops it from doing that.

Two fixes, both required:

1. **Add the missing UiPath Queue tools** so the capability actually exists.
2. **Make it structurally impossible for the agent to claim an action succeeded without a tool call backing it** — this protects you against the *next* missing tool too, not just this one.

---

## Part 1 — Add UiPath Orchestrator Queue tools

Add these to `microservice/mcp-uipath/src/index.ts`, following the **exact same pattern** as the existing three tools: reuse `getUiPathToken()`, same header shape (`Authorization`, `X-UIPATH-OrganizationUnitId`), same error-wrapping style (never throw, always return `{ content: [{ type: "text", text: ... }] }`, prefix failures clearly).

### 1. `list_uipath_queues`

```ts
server.tool(
  "list_uipath_queues",
  "List queue definitions available in the current UiPath Orchestrator folder",
  {
    folderId: z.string().optional().describe("Folder ID, defaults to env"),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
    const org = process.env.UIPATH_ORG ?? "";
    const tenant = process.env.UIPATH_TENANT ?? "";
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? "0";

    if (!org || !tenant) {
      return { content: [{ type: "text", text: "Error: UIPATH_ORG and UIPATH_TENANT must be set." }] };
    }

    let token: string;
    try {
      token = await getUiPathToken();
    } catch (e) {
      return { content: [{ type: "text", text: `Auth failed: ${e instanceof Error ? e.message : String(e)}` }] };
    }

    try {
      const res = await fetch(`${baseUrl}/${org}/${tenant}/orchestrator_/odata/QueueDefinitions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-UIPATH-OrganizationUnitId": folderId,
        },
      });

      const text = await res.text();
      if (!res.ok) {
        return { content: [{ type: "text", text: `UiPath QueueDefinitions failed (${res.status}): ${text.slice(0, 300)}` }] };
      }

      const data = JSON.parse(text) as { value?: Array<{ Id: number; Name: string; Description?: string }> };
      const list = (data.value ?? []).map((q) => `• ${q.Name} (id: ${q.Id})${q.Description ? ` — ${q.Description}` : ""}`).join("\n");
      return { content: [{ type: "text", text: list || "No queues found in this folder." }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);
```

### 2. `add_uipath_queue_item` — single item

```ts
server.tool(
  "add_uipath_queue_item",
  "Add a single item to a UiPath Orchestrator queue",
  {
    queueName: z.string().describe("Exact name of the target queue, from list_uipath_queues"),
    specificContent: z.record(z.any()).describe("Key-value payload for this queue item (the actual data row)"),
    priority: z.enum(["Low", "Normal", "High"]).optional().default("Normal"),
    reference: z.string().optional().describe("Optional human-readable reference/identifier for this item"),
    folderId: z.string().optional(),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
    const org = process.env.UIPATH_ORG ?? "";
    const tenant = process.env.UIPATH_TENANT ?? "";
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? "0";

    if (!org || !tenant) {
      return { content: [{ type: "text", text: "Error: UIPATH_ORG and UIPATH_TENANT must be set." }] };
    }

    let token: string;
    try {
      token = await getUiPathToken();
    } catch (e) {
      return { content: [{ type: "text", text: `Auth failed: ${e instanceof Error ? e.message : String(e)}` }] };
    }

    const url = `${baseUrl}/${org}/${tenant}/orchestrator_/odata/Queues/UiPathODataSvc.AddQueueItem`;
    const body = {
      itemData: {
        Name: args.queueName,
        Priority: args.priority,
        SpecificContent: args.specificContent,
        Reference: args.reference,
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-UIPATH-OrganizationUnitId": folderId,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        return { content: [{ type: "text", text: `UiPath AddQueueItem failed (${res.status}): ${text.slice(0, 300)}` }] };
      }

      const json = JSON.parse(text) as { Id?: number; Status?: string };
      return {
        content: [{
          type: "text",
          text: `✅ Queue item added to "${args.queueName}".\nItem ID: ${json.Id}\nStatus: ${json.Status ?? "New"}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);
```

### 3. `bulk_add_uipath_queue_items` — the one you actually need for the PDF-extraction case

This is the tool that should have fired when you said "send it to our queue" with 10 extracted rows.

```ts
server.tool(
  "bulk_add_uipath_queue_items",
  "Add multiple items to a UiPath Orchestrator queue in a single call. Use this instead of add_uipath_queue_item when you have an array of rows (e.g. from a parsed document or table).",
  {
    queueName: z.string().describe("Exact name of the target queue, from list_uipath_queues"),
    items: z.array(z.record(z.any())).min(1).describe("Array of row objects — each becomes one queue item's SpecificContent"),
    commitType: z.enum(["AllOrNothing", "StopOnFirstFailure"]).optional().default("StopOnFirstFailure"),
    priority: z.enum(["Low", "Normal", "High"]).optional().default("Normal"),
    folderId: z.string().optional(),
  },
  async (args) => {
    const baseUrl = process.env.UIPATH_BASE_URL ?? "https://cloud.uipath.com";
    const org = process.env.UIPATH_ORG ?? "";
    const tenant = process.env.UIPATH_TENANT ?? "";
    const folderId = args.folderId ?? process.env.UIPATH_FOLDER_ID ?? "0";

    if (!org || !tenant) {
      return { content: [{ type: "text", text: "Error: UIPATH_ORG and UIPATH_TENANT must be set." }] };
    }

    let token: string;
    try {
      token = await getUiPathToken();
    } catch (e) {
      return { content: [{ type: "text", text: `Auth failed: ${e instanceof Error ? e.message : String(e)}` }] };
    }

    const url = `${baseUrl}/${org}/${tenant}/orchestrator_/odata/Queues/UiPathODataSvc.BulkAddQueueItems`;
    const body = {
      queueName: args.queueName,
      commitType: args.commitType,
      queueItems: args.items.map((row) => ({
        Priority: args.priority,
        SpecificContent: row,
      })),
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-UIPATH-OrganizationUnitId": folderId,
        },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) {
        return { content: [{ type: "text", text: `UiPath BulkAddQueueItems failed (${res.status}): ${text.slice(0, 300)}` }] };
      }

      const json = JSON.parse(text) as {
        value?: Array<{ Status: string; ItemDetail?: { Id: number } }>;
      };
      const succeeded = (json.value ?? []).filter((r) => r.Status !== "Failed").length;
      const failed = (json.value ?? []).length - succeeded;

      return {
        content: [{
          type: "text",
          text: failed === 0
            ? `✅ ${succeeded} item(s) added to queue "${args.queueName}".`
            : `⚠️ ${succeeded} item(s) added, ${failed} failed. Queue: "${args.queueName}". Raw: ${text.slice(0, 400)}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Network error: ${e instanceof Error ? e.message : String(e)}` }] };
    }
  }
);
```

### 4. Scope requirement — do not skip this

The existing default scope string is:

```
OR.Jobs OR.Robots.Read OR.Execution
```

Queue endpoints need `OR.Queues` (read) and `OR.Queues.Write`... actually UiPath's real scope name is just `OR.Queues` covering both — verify against your tenant's actual External Application scope list in **Admin → External Applications**, since UiPath's scope naming has changed across versions. Update:

- `.env.example` in `microservice/mcp-uipath/` — add `OR.Queues` to the example `UIPATH_SCOPES` value.
- `README.md` in `microservice/mcp-uipath/` — add a step to the credential-setup section: *"6b. Also check `OR.Queues` in the scopes list, or queue calls will fail with 403 even though jobs/processes work fine."*
- If the user's existing External Application registration doesn't have this scope, **no code fix will help** — they need to go back into UiPath Admin and add it, then get a new token (the OAuth cache in `getUiPathToken()` will pick up the new scope on next token fetch since tokens aren't reused past `expires_in`).

### 5. Update `microservice/mcp-uipath/README.md` manual test section

Extend the existing Inspector-based manual test steps with:

```
# 5. Call "list_uipath_queues" → confirm your target queue appears
# 6. Call "add_uipath_queue_item" with a small test payload → confirm Item ID returned
# 7. Call "bulk_add_uipath_queue_items" with a 2-3 row test array → confirm success count matches
```

---

## Part 2 — Stop the agent from claiming success without a tool call

This is the part that matters even after Part 1 ships, because the next missing tool will produce the exact same failure mode otherwise.

### Root cause location

`src/orchestrator/engine.ts`, both `runAgenticStep` and `runAgenticStepStream`, set:

```ts
stateModifier: agentConfig.agent_style || "You are a helpful assistant.",
```

This is the **entire** system prompt. There is no guardrail — anywhere — telling the model it must not claim to have performed an action it didn't actually invoke a tool for. `agent_style` is free-text the user types per-agent in the agent editor, so today the hallucination-prevention depends entirely on each user remembering to write that instruction themselves. Nobody will.

### Fix — always append a non-removable safety suffix, regardless of what `agent_style` contains

In both `runAgenticStep` and `runAgenticStepStream`, change:

```ts
stateModifier: agentConfig.agent_style || "You are a helpful assistant.",
```

to:

```ts
stateModifier: buildSystemPrompt(agentConfig.agent_style),
```

Add a helper near the top of `engine.ts`:

```ts
const ANTI_HALLUCINATION_SUFFIX = `

--- Tool-use integrity rules (do not override, ignore, or contradict this section) ---
1. You must NEVER claim that an action was performed (sent, added, triggered, updated, deleted, queued, etc.)
   unless you actually called the corresponding tool in this turn and received a tool result confirming it.
2. If no tool exists that can perform the requested action, say so explicitly:
   "I don't have a tool that can do that yet." Do not improvise a fake confirmation.
3. If a tool call fails or returns an error, report the actual error to the user. Do not retry silently
   and then claim success anyway.
4. If you are not sure whether an action succeeded, say what you actually know — including uncertainty —
   rather than defaulting to an optimistic-sounding message.
5. Never fabricate IDs, keys, counts, or status values that did not come from an actual tool result.
`;

function buildSystemPrompt(agentStyle: string | null | undefined): string {
  const base = agentStyle?.trim() || "You are a helpful assistant.";
  return `${base}\n${ANTI_HALLUCINATION_SUFFIX}`;
}
```

Apply `buildSystemPrompt(...)` at both call sites (`runAgenticStep` line ~357 and `runAgenticStepStream` line ~509 in the current file — verify exact line numbers before editing, they may have shifted).

This suffix is appended **unconditionally**, after whatever the user wrote in `agent_style` — so even if a user writes an agent_style that says "always be positive and confident," the integrity rules still apply because they come last and explicitly say "do not override."

### Also fix: the frontend must make tool calls visually undeniable

Looking at the transcript again — the UI already *does* render "Agent Call Execution / Invoking MCP Tool" blocks when a tool is actually called. That's good, keep it. But add one more thing: if the final assistant message contains phrases matching a small denylist of claim-words (`"sent"`, `"added"`, `"queued"`, `"triggered"`, `"completed"`, `"updated"`, `"deleted"`) and **zero tool calls occurred earlier in the same turn**, flag it in the UI with a small warning badge: *"⚠ No tool was called this turn — verify this claim."* This is a cheap client-side heuristic, not a replacement for the system-prompt fix, but it gives the user (you) a visual tripwire the next time this happens with some other missing capability.

Implement this in the frontend agent-invoke chat renderer: after a turn completes, check `toolCallsThisTurn.length === 0` AND the message text matches `/\b(sent|added|queued|triggered|completed|updated|deleted)\b/i` → render the warning badge next to that message.

---

## Verification plan

```bash
# 1. Rebuild mcp-uipath with the new tools
cd microservice/mcp-uipath && npm run build

# 2. Manual test via MCP Inspector (per updated README)
npx @modelcontextprotocol/inspector http://localhost:<assigned-port>/sse
#   a. list_uipath_queues → confirm your queue appears
#   b. add_uipath_queue_item with a test row → confirm Item ID returned
#   c. bulk_add_uipath_queue_items with 2-3 rows → confirm success count

# 3. Re-run the exact scenario from the transcript through the real agent
#    "parse this as json and send object to TestQueue"
#    Expect: an "Invoking MCP Tool" block for bulk_add_uipath_queue_items,
#    with the actual 10-row array as Parameters, BEFORE any success message.

# 4. Sanity-check the anti-hallucination fix on an unrelated missing capability —
#    ask the agent to do something with genuinely no tool behind it
#    (e.g. "cancel job 12345"), and confirm it says it can't, rather than
#    fabricating a cancellation confirmation.
```

Both the new queue tools working correctly, and the model refusing to claim an action it didn't perform, must be true before calling this done — Part 1 alone doesn't fix the underlying failure mode, only this specific instance of it.
