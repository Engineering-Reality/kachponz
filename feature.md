# Prompt #15 — Amadeus: Port RAG (pgvector) and Feature Sharing to TypeScript

Two unrelated features bundled in one prompt because they were requested together —
implement as two independent PRs/commits, not one tangled change.

## Context — read this before touching anything

1. Legacy Python `microservice/rag/` — `routes/rag.py` (upload/update/remove file,
   `/query` endpoint), `service/rag/_rag_utils.py` (`retrieval_with_rerank`,
   `generate_response`), `service/embedding/_embedding_utils.py` (`EmbedderService`),
   `service/storage_database/_storage_utils.py` (generic Supabase storage/table
   client). Also `routes/image_rag.py` + `service/rag/_image_rag_utils.py` — this is
   multimodal (CLIP image embeddings + VLM), explicitly OUT of scope for this prompt,
   see Non-goals.
2. Legacy Python `microservice/feature_sharing/` — **this has no real implementation**,
   only a `README.md` documenting the intended API surface (agent/thread sharing,
   visitor/editor roles, public links via hash). Build this from the README spec, not
   from code — there's no working Python to port here, despite the folder existing.
3. `microservice/amadeus-core/src/orchestrator/executors/qwenClient.ts` — reuse for
   RAG's answer-generation step. Do not call a new/different model client.
4. `microservice/agent_backend` — existing patterns for Supabase table access, auth
   middleware, and permission checks (owner/company-scoped access) — RAG's file
   storage and Feature Sharing's permission logic should follow the same conventions
   already established there, not invent new ones.

## Critical dependency note — read this before writing any embedding code

Legacy Python's `EmbedderService` loads the **full CLIP ViT-Large model
(`openai/clip-vit-large-patch14`) via `torch`/`transformers`** in-process, producing
768-dimensional embeddings. This is the same class of problem flagged repeatedly in
this project (Prompt 11, Prompt 14) — a multi-hundred-MB model loaded directly in the
serving process is incompatible with the 2GB RAM deploy target. **Do not port this
embedding approach as-is.**

Instead: check whether Netra Runtime's hosted API (already in use per Prompt 11)
exposes an embeddings endpoint (`/v1/embeddings`, OpenAI-compatible shape). If yes,
call that instead of a local model — this keeps the embedding step as a lightweight
network call, exactly like `qwenChat()`. If Netra Runtime doesn't offer embeddings,
the fallback is DashScope's text-embedding API (`text-embedding-v3` or similar) — but
confirm with Jandy given the DashScope compliance concerns already documented in
`qwenClient.ts` (Prompt 11) before defaulting to it for anything beyond
dev/prototyping.

Whichever endpoint is chosen, the embedding dimension it returns MUST match the
`vector(N)` column width created in Part A's schema below — check the actual
dimension the chosen API returns before finalizing the migration, don't assume 768
carries over from the old CLIP setup.

## Part A — RAG (text-only, pgvector)

### A.1 — Database schema

Confirm the `pgvector` extension is enabled on the local/self-hosted Postgres
instance (this is a local extension, not a Supabase-cloud-only feature — it runs fine
on a self-hosted Postgres, which fits the on-premise direction):

```sql
create extension if not exists vector;

create table if not exists rag_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id), -- adjust to whatever this repo's actual user/auth table is
  file_id text not null,             -- ties back to the stored file (see A.2)
  content text not null,             -- the chunk's text
  embedding vector(N) not null,      -- N = whatever the chosen embedding API returns — confirm before writing this literal
  created_at timestamptz default now()
);

create index on rag_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

Recreate `rerank_documents` as a genuine Postgres function (the legacy Python code
calls it via Supabase RPC, but the function body itself isn't in the Python zip — it
lives in the database, not the app code; write it fresh here rather than searching
for source that doesn't exist in this repo):

```sql
create or replace function rerank_documents(query_embedding vector(N), top_k int default 5)
returns table (file_id text, content text, similarity float)
language sql stable
as $$
  select file_id, content, 1 - (embedding <=> query_embedding) as similarity
  from rag_documents
  order by embedding <=> query_embedding
  limit top_k;
$$;
```

### A.2 — File storage and chunking

Port `upload_file`/`update_file`/`remove_file` from `rag.py` to
`microservice/amadeus-core/src/orchestrator/routes.ts` (or a new `rag.ts` router file
if that fits this repo's existing route-file conventions better — check how other
feature areas split their routes before deciding). Reuse whatever object storage this
repo already uses elsewhere (check `agent_backend` for an existing Supabase Storage
client pattern) rather than introducing a second storage abstraction.

On upload, chunk the file's text content (simple fixed-size chunking with overlap is
enough to start — don't build a sophisticated semantic chunker in this PR), embed
each chunk via the endpoint chosen above, and insert rows into `rag_documents`.

### A.3 — Retrieval + generation

```ts
// microservice/amadeus-core/src/orchestrator/executors/ragClient.ts
import { qwenChat } from "./qwenClient.js";
import { embedText } from "./embeddingClient.js"; // new — wraps whichever embeddings endpoint was chosen above
import { query } from "../../db.js"; // adjust to this repo's actual db helper

export async function retrievalWithRerank(userQuery: string, topK = 5) {
  const queryEmbedding = await embedText(userQuery);
  const result = await query(
    `select * from rerank_documents($1::vector, $2)`,
    [JSON.stringify(queryEmbedding), topK],
  );
  return result.rows; // { file_id, content, similarity }[]
}

export async function generateRagResponse(userQuery: string, retrievedContext: { file_id: string; content: string; similarity: number }[]) {
  const formattedContext = retrievedContext
    .map((doc, i) => `Document ${i + 1} (ID: ${doc.file_id}, Relevance: ${doc.similarity.toFixed(4)}):\n${doc.content}`)
    .join("\n\n");
  const prompt = `Berdasarkan konteks yang diambil berikut, jawab pertanyaan ini.\n\nPertanyaan: ${userQuery}\n\nKonteks:\n${formattedContext}\n\nJawaban:`;
  const result = await qwenChat({
    model: "qwen-plus",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });
  return result.content;
}
```

Add `POST /orchestrator/rag/query` wrapping both calls in sequence, matching the
legacy `/rag/query` endpoint's shape (`{ query }` in, `{ query, response }` out).

## Part B — Feature Sharing (build from spec, no legacy code to port)

Since there's no working Python implementation, build directly from the README's
documented API surface — treat the README as the spec, not as documentation of
existing behavior.

### B.1 — Schema additions

```sql
alter table agents add column if not exists share_visitor_with text[] default '{}';
alter table agents add column if not exists share_editor_with text[] default '{}';
alter table agents add column if not exists public_hash text unique;
alter table agents add column if not exists is_public boolean default false;

-- Threads (agent_logs, per the README) get the same shape, nested under chat_history
-- per the README's documented structure — confirm agent_logs' actual current schema
-- before deciding whether this becomes columns or a JSONB sub-object; the README
-- shows it living inside chat_history as JSON, so match that rather than adding
-- separate columns if agent_logs is JSONB-shaped already.
```

### B.2 — Endpoints (mirror the README's documented paths exactly)

```
POST /feature-sharing/agent/share-editor-with/:agentId
POST /feature-sharing/agent/share-visitor-with/:agentId
POST /feature-sharing/agent/share-anyone-with-link/:agentId
POST /feature-sharing/thread/share-editor-with/:agentId/:threadId
POST /feature-sharing/thread/share-visitor-with/:agentId/:threadId
POST /feature-sharing/thread/share-anyone-with-link/:agentId/:threadId

GET /agent-invoke/shared-agent/:agentHash       (public, no auth)
GET /agent-invoke/shared-thread/:threadHash     (public, no auth)
```

### B.3 — Permission rules (per the README, enforce exactly this)

- Only the agent/thread owner can share it.
- Users belonging to the same company as the owner can also share it.
- Users with editor access to an agent can share threads created with that agent.
- All endpoints require JWT auth EXCEPT the two public `GET` endpoints above.

Implement permission checks as a small reusable middleware/helper
(`canShareResource(userId, resource)`), not inlined per-route — this logic is reused
across six endpoints and needs to stay consistent.

### B.4 — Public hash generation

```ts
import { randomBytes } from "crypto";
function generatePublicHash(): string {
  return randomBytes(8).toString("hex"); // matches the README's example format, e.g. "061d0a94b6488dab"
}
```

Generate once per share-link request; if a `public_hash` already exists for that
resource, reuse it rather than generating a new one on every call (so links don't
silently break for people who already have the old one).

### B.5 — Frontend

Add share buttons/modals wherever agents and threads are displayed
(`agent-creator`, `playground`/chat history) — visitor/editor email input, a "copy
public link" action. Scope this to a functional minimum (a modal with the three share
modes) rather than a polished sharing-management dashboard; that can come later once
the basic flow is confirmed working.

## Acceptance criteria

- [ ] Embeddings for RAG come from a network API call (Netra Runtime or, with
      Jandy's confirmation, DashScope) — grep confirms zero `torch`/`transformers`
      involvement anywhere in the new TypeScript RAG code.
- [ ] `pgvector` extension confirmed enabled; `rag_documents` table and
      `rerank_documents` function created and callable.
- [ ] `POST /orchestrator/rag/query` returns a response grounded in actually-retrieved
      chunks — verify with a test document uploaded, queried, and the response citing
      content that only exists in that document.
- [ ] All six Feature Sharing endpoints implemented per the README's exact paths and
      permission rules.
- [ ] The two public `GET` endpoints work without any auth header; every other
      endpoint in this prompt requires it.
- [ ] `canShareResource` (or equivalent) is a single shared function, not duplicated
      per-route logic.

## Non-goals

- Do NOT port image RAG (`image_rag.py`, `_image_rag_utils.py`) in this PR — that
  needs CLIP-equivalent image embeddings and a vision-capable model, a materially
  bigger scope (Netra Runtime would need to support a vision model, e.g. Qwen-VL, and
  a decision about whether image embeddings can also move to a hosted API or need to
  stay local). Flag as a separate future prompt if Jandy wants it.
- Do NOT build a sophisticated semantic/recursive chunking strategy — fixed-size
  chunking with overlap is enough to ship a working RAG loop; refine later once real
  usage shows it's needed.
- Do NOT build a full sharing-management UI (usage analytics, revoke-all, expiring
  links) — the README's documented six endpoints plus a minimal share modal is the
  full scope here.
- Do NOT reuse `model_name="custom-vlm"` (legacy `generate_response`'s default) for
  anything — every generation call in this prompt goes through `qwenChat()`.
