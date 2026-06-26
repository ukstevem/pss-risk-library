# embedding-proxy

Stable HTTP contract in front of the Orin's Ollama embedding endpoint, for the risk library (and any future domain that reuses the backend). CPU service, internal-only on `platform_net`, reached as `http://embedding-proxy:8009`.

It owns the three things that must stay consistent between *capture* and *search*:
- the asymmetric role prefixes — `search_query:` for the project-profile query, `search_document:` for stored risks/issues;
- L2 normalisation of the returned vectors;
- the pinned model name / version / dimension (`nomic-embed-text-v1.5`, 768), which it reports back so the app can stamp every `rl_vector` row.

Swapping the serving backend later (Ollama → TEI → a sourced GPU) is a change here only — the app never knows.

## Contract

```
POST /embed
  { "texts": ["..."], "role": "query" | "document" }
  -> { "model": "nomic-embed-text", "version": "nomic-embed-text-v1.5", "dim": 768, "vectors": [[...], ...] }

GET /health
  -> { "ok": true, "model": "...", "version": "...", "dim": 768, "orin": "http://10.0.0.74:11434" }
```

## Prerequisite (the Orin)

The GPU box must be running Ollama with the model pulled:

```bash
# on the Orin (10.0.0.74)
ollama pull nomic-embed-text
ollama serve            # listens on :11434
```

## Run

```bash
cp env.example .env     # adjust EMBEDDING_ORIN_URL if needed
docker compose up -d --build
# smoke test (once the Orin is reachable):
curl -s http://localhost:8009/health
curl -s -X POST http://localhost:8009/embed \
  -H 'content-type: application/json' \
  -d '{"texts":["supplier may miss the delivery date"],"role":"document"}' | head -c 300
```

## Notes

- `EMBEDDING_DIM` must match both the model and the `vector(768)` column in migration `040`. Change the model ⇒ change the dim ⇒ re-embed the corpus and rebuild the HNSW index.
- If Ollama's `nomic-embed-text` turns out to prepend its own task prefix, drop the prefix here to avoid double-prefixing — verify once it's running on the Orin.
- Tries the batch endpoint `/api/embed` first, falls back to per-text `/api/embeddings` for older Ollama.
