# Amadeus — Queue Items Arrive Empty With Full Field Set, Succeed With One Field Only

Working directory: `microservice/mcp-uipath/`.

## Where things stand

Evidence from the latest session, in order:

1. `add_uipath_queue_item` called with the correct native-JSON shape (`specificContent` as a real object, not stringified — confirming prior fixes held) containing all 7 extracted fields including `"#"` → item was created in Orchestrator (no HTTP error), but shows **"Specific Data: Object"" with nothing visible underneath** — the payload effectively arrived empty.
2. Same tool, same shape, but `specificContent` containing **only** `{"Email": "..."}` → item created **and the field is visible correctly**.

Two different explanations fit this evidence equally well, and I don't want to guess between them — get the authoritative answer first, it's a 2-minute check:

- **Theory A**: the `"#"` key specifically breaks UiPath's dictionary serialization for the whole object, so the entire `SpecificContent` gets dropped when it's present, regardless of the other fields.
- **Theory B**: `TestQueue` has a configured Transaction Schema (a fixed allowed-fields list) in Orchestrator, and `Email` happens to be the only field from our data that's on that list — everything else gets silently rejected/stripped, not because of `"#"` at all.

These need different fixes. Sanitizing a key name (Theory A) does nothing if the real problem is a schema allowlist (Theory B), and vice versa.

## Step 0 — Check the queue's actual configuration first (fastest way to know for certain)

In UiPath Orchestrator UI: **Queues → TestQueue → Edit**. Look for a "Specify a schema for transaction storage" / "Transaction Fields" section.

- **If a schema IS defined** with a fixed list of named fields → Theory B confirmed. Note the exact field names and types shown there. Skip to Step 2.
- **If no schema is defined** (queue accepts freeform `SpecificContent`) → Theory B is ruled out, the problem must be something about the data itself → go to Step 1 to confirm Theory A specifically.

Also check via API — `GET /odata/QueueDefinitions` may include schema info in its response for this queue (`SpecificContentSchema` or similar field, name varies by Orchestrator version). Add this to `list_uipath_queues`'s output regardless of what Step 0 finds manually, so future debugging doesn't require someone to go into the Orchestrator UI by hand:

```ts
// in list_uipath_queues, include schema info if the API returns it
const list = (data.value ?? []).map((q) => {
  const schemaNote = q.SpecificContentSchema ? ` [schema: ${JSON.stringify(q.SpecificContentSchema)}]` : "";
  return `• ${q.Name} (id: ${q.Id})${q.Description ? ` — ${q.Description}` : ""}${schemaNote}`;
}).join("\n");
```

## Step 1 — If Step 0 showed no schema restriction, isolate whether `"#"` specifically is the problem

Run these two curl calls directly against Orchestrator (bypass the agent and MCP entirely — same token-fetch pattern as before):

```bash
# Test 1: all 7 real fields, WITHOUT the "#" key
curl -v -X POST ".../UiPathODataSvc.AddQueueItem" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "X-UIPATH-OrganizationUnitId: 997942" \
  -d '{"itemData":{"Name":"TestQueue","Priority":"Normal","SpecificContent":{
    "First Name":"John","Last Name":"Smith","Company Name":"IT Solutions",
    "Role in Company":"Analyst","Address":"98 North Road",
    "Email":"jsmith@itsolutions.co.uk","Phone Number":"40716543298"
  }}}'

# Test 2: just the "#" key alone, nothing else
curl -v -X POST ".../UiPathODataSvc.AddQueueItem" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "X-UIPATH-OrganizationUnitId: 997942" \
  -d '{"itemData":{"Name":"TestQueue","Priority":"Normal","SpecificContent":{"#":"1"}}}'
```

Then check both resulting queue items in the Orchestrator UI (Transactions tab), not just the HTTP response — the previous failure mode was a **silent empty item**, not an HTTP error, so a 200-looking curl response alone doesn't prove the fix worked. Confirm visually whether fields actually appear.

- **Test 1 succeeds with all fields visible, Test 2 comes back empty** → Theory A fully confirmed, isolated to `"#"` specifically. Go to Step 2a.
- **Test 1 also comes back empty** → it's not about `"#"` at all — something else in that field set is the problem (space in key names, a specific field value, or a schema restriction Step 0 missed). Re-check Step 0 more carefully, and additionally test removing one field at a time from Test 1's payload to isolate which one.

## Step 2a — Fix for Theory A (the `"#"` key)

In `microservice/mcp-uipath/src/index.ts`, add key sanitization before building the request body for both `add_uipath_queue_item` and `bulk_add_uipath_queue_items`:

```ts
/**
 * UiPath's SpecificContent dictionary serialization breaks when a key starts
 * with certain non-alphanumeric characters (confirmed: "#"). Sanitize before
 * sending, and tell the user what changed so field mapping isn't a silent surprise.
 */
function sanitizeSpecificContentKeys(obj: Record<string, any>): { sanitized: Record<string, any>; renamed: Array<[string, string]> } {
  const sanitized: Record<string, any> = {};
  const renamed: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(obj)) {
    let safeKey = key;
    if (/^[^a-zA-Z0-9]/.test(key)) {
      // Leading special character — replace with a readable fallback.
      safeKey = key === "#" ? "RowNumber" : key.replace(/^[^a-zA-Z0-9]+/, "Field_");
      renamed.push([key, safeKey]);
    }
    sanitized[safeKey] = value;
  }
  return { sanitized, renamed };
}
```

Apply it in both tools before constructing the request body:

```ts
const { sanitized, renamed } = sanitizeSpecificContentKeys(args.specificContent);
// use `sanitized` in the outgoing itemData.SpecificContent

// in the success response text:
const renameNote = renamed.length
  ? ` (note: field names ${renamed.map(([o, n]) => `"${o}"→"${n}"`).join(", ")} were sanitized for UiPath compatibility)`
  : "";
```

For `bulk_add_uipath_queue_items`, apply the same sanitization to each row in `args.items` before mapping to `queueItems`, and aggregate the rename note once (not per-row) since it'll be identical across rows from the same extraction.

**Important**: if a sanitize function already exists in the codebase from a prior pass at this problem, read it first — the fact that Test result #1 in this session produced a **silently empty item** (not the earlier explicit "must not be null" error) suggests either partial sanitization is already happening, or something is actively producing an empty object where it shouldn't. Check for a bug in any existing sanitize logic before assuming this needs to be written from scratch — the empty-not-rejected behavior is a different symptom than before and needs to be explained, not just papered over with a second sanitize implementation stacked on top of a possibly-broken first one.

## Step 2b — Fix for Theory B (queue-level field schema)

If Step 0 found a defined Transaction Schema on `TestQueue`, there are two legitimate paths — pick with the user, don't assume:

1. **Widen the queue's schema in Orchestrator** to accept the real field names (`First Name`, `Last Name`, etc.) — this is a UiPath Orchestrator UI change, not a code change, and is the right call if this queue is meant to hold this kind of contact data going forward.
2. **Map our data to the queue's existing allowed fields** in code, if the schema is fixed for a reason (e.g., a downstream robot process expects specific field names it can't easily change). Add a field-mapping layer: since `list_uipath_queues` now surfaces the schema (Step 0), the agent (or a pre-processing step in the tool) can map extracted column names to the queue's actual expected names before sending.

Either way, do **not** silently drop fields that don't match the schema without telling the user which ones were dropped and why — surface that in the tool's response text, same pattern as the rename-note in Step 2a.

## Step 3 — Stop the agent from needing hand-holding through the wrong shape

In this session, you had to manually tell the agent to use `specificContent` instead of the incorrect `itemData` wrapper a well-meaning-but-wrong suggestion introduced. The tool's own description should make this unambiguous so a user never has to correct it again. Update the `add_uipath_queue_item` and `bulk_add_uipath_queue_items` tool descriptions in `mcp-uipath/src/index.ts` to include a concrete inline example directly in the description string (which the LLM sees at tool-binding time):

```ts
server.tool(
  "add_uipath_queue_item",
  `Add a single item to a UiPath Orchestrator queue. ` +
  `Pass the row data directly as "specificContent" — do NOT nest it under an "itemData" wrapper, ` +
  `that wrapping is handled internally by this tool. ` +
  `Example call: { "queueName": "TestQueue", "specificContent": { "Email": "a@b.com", "Name": "..." } }`,
  { /* schema unchanged */ },
  async (args) => { /* unchanged */ }
);
```

Do the same for `bulk_add_uipath_queue_items`'s description, showing an example with `items` as an array of 1-2 sample row objects.

## Verification plan

```bash
# 1. Confirm Step 0's finding is documented — schema restricted or not, note it here.

# 2. Re-run the disambiguation curls from Step 1 if Theory A was the path,
#    confirm both now produce visible, fully-populated queue items in Orchestrator UI.

# 3. Full end-to-end, no manual correction from the user this time:
#    upload the PDF, "extract please", "masukkan di queue"
#    Expect: ONE bulk_add_uipath_queue_items call (or the agent correctly explains
#    a field-mapping/rename if Theory B applied), success message naming any
#    renamed/dropped fields explicitly, and all 10 rows visible with real data
#    in Orchestrator's Transactions tab — not "Specific Data: Object" with nothing under it.

# 4. Spot-check at least 3 of the 10 resulting queue items in the Orchestrator UI directly,
#    confirm every field value matches the original PDF extraction (not just that
#    "some data" is present).
```

All four steps must pass. Step 4 matters because "the API returned success" was already proven insufficient once in this exact bug (the empty-item case returned no HTTP error) — always confirm visually in Orchestrator, not just via the API response, before calling this fixed.
