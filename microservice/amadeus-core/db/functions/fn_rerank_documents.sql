-- Cosine-similarity retrieval over rag_documents. `<=>` is pgvector's cosine
-- distance operator (0 = identical); `1 - distance` converts it to a
-- similarity score in [-1, 1] to match the legacy Python rag.py response
-- shape (file_id, content, similarity). Ordering by the raw distance (not
-- the derived similarity) lets the ivfflat index on rag_documents(embedding)
-- serve the query directly.
CREATE OR REPLACE FUNCTION rerank_documents(
  query_embedding VECTOR(1024),
  top_k           INT DEFAULT 5
)
RETURNS TABLE (
  file_id    TEXT,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT file_id, content, 1 - (embedding <=> query_embedding) AS similarity
  FROM rag_documents
  ORDER BY embedding <=> query_embedding
  LIMIT top_k;
$$;
