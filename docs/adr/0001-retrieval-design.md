# Retrieval design: embed both Risks and Issues, query by project profile

**Status:** accepted · 2026-06-26

## Decision

When a new project runs its risk assessment, we surface relevant history semantically. We embed **each Risk and each Issue as its own document** into **one shared vector index** (pgvector, cosine distance, HNSW), tagged by `kind` (`risk` | `issue`). The **query** is the new project's **profile** — free text describing the job (optionally seeded from `project_register_items.line_desc` + client + value). Results come back as one similarity-ranked list, grouped by kind in the UI ("Risks to consider" / "Issues that hit related jobs"), each carrying its Actions and outcome.

Embedding tool: **`nomic-embed-text-v1.5`**, native **768-dim**, served locally on the Orin (GPU). It handles long inputs (8192 tokens, so a full project profile isn't truncated) and uses asymmetric `search_query:` / `search_document:` prefixes, which the embedding-proxy applies per call. Every embedded row stores `embedding_model`, `embedding_version`, `embedding_dim`, and `embedding_input`, so changing the tool later is a **re-embed/backfill**, not a redesign.

## Why embed Risks too, not just Issues

Surfacing a Risk that *never materialized* is the preventive lever: on the new job it gets flagged and actioned, so it never becomes an Issue. Omit Risks from retrieval and the new team isn't prompted, fails to flag it, and it recurs as a missed-risk Issue — the exact failure the library exists to prevent.

## Rejected alternative

"Find the *N* most similar past **projects**, then list their risks." Rejected: it requires projects to be similar *overall*, so it structurally cannot surface a risk from a job that is 90% different but shares the one risky characteristic — which is the main point. Embedding at the Risk/Issue grain lets a single shared trait reach across otherwise-dissimilar jobs.
