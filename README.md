# pss-risk-library

Semantic **risk library** for the PSS platform. Captures project **Risks**, the **Actions** taken on them, and the **Issues** they become — then, during a new project's risk assessment, surfaces semantically similar past risks/issues (with their actions and outcomes), including non-obvious cross-domain ones nobody linked.

Standalone app on the PSS gateway (`/risk-library/`, port 3017), sharing the self-hosted Supabase and an embedding service. Project risk is the first domain; H&S / POWRA can reuse the same backend later behind new UIs.

## Design & decisions

- [`CONTEXT.md`](CONTEXT.md) — the domain glossary (Risk / Issue / Action).
- [`docs/DESIGN.md`](docs/DESIGN.md) — the buildable spec.
- [`docs/adr/`](docs/adr/) — 0001 retrieval design · 0002 no categories (semantic only) · 0003 generic backend.

## Architecture (summary)

- **Backend:** four tables in the shared Supabase (migration `040` in `platform-portal/supabase/migrations`): `risk`, `issue`, `risk_action`, `library_vector` (pgvector, HNSW cosine). Retrieval via the `match_risk_library` RPC — purely semantic, objective-facet filters only, no category taxonomy.
- **Embeddings:** `nomic-embed-text-v1.5` (768-dim) served on the Orin via Ollama; an `embedding-proxy` (CPU, Proxmox) owns the query/document prefixes + L2 normalisation and is called server-side from this app's API routes.
- **UI:** assessment lookup (project profile → ranked, kind-grouped results), structured capture, and a fast seeding-entry mode for the cold-start brain-dump.

## Local development

```bash
cp env.example .env   # fill in dev values (self-hosted Supabase)
cd app
npm install
npm run dev           # http://localhost:3017/risk-library/
```

## Deploy

Standalone-app pattern: build ARM64 on the dev machine, push to `ghcr.io/ukstevem/pss-risk-library`, pull + `up -d` on the Pi (`10.0.0.75`). See `build.sh` and `docker-compose.app.yml`. Migration `040` must be applied to the shared Supabase first.

## Issue tracking

Uses **beads** (`bd`). Run `bd ready` for available work; `bd prime` after a new session.
