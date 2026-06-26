# Risk Library — PoC Design

Status: **post-grilling, ready to build from** · System of record: self-hosted Supabase · Narrative layer: Obsidian (linked by `projectnumber`) · Glossary: [CONTEXT.md](../CONTEXT.md) · Decisions: [ADR 0001](adr/0001-retrieval-design.md), [0002](adr/0002-no-categories-semantic-only.md), [0003](adr/0003-generic-risk-backend.md)

> This supersedes the original pre-grilling draft. The model is **Risk → Action → Issue** (APM Body of Knowledge), retrieval is **purely semantic** (no categories), and the backend is **domain-neutral** so H&S / POWRA can reuse it later.

## 0. What it does

Capture project **Risks** (and the **Actions** taken on them, and the **Issues** they become) as structured, embedded records. When a new project runs its risk assessment, describe the job and **semantically surface similar past Risks and Issues** — including non-obvious cross-domain ones nobody linked — with what was done and how it turned out. Surfacing past **Risks** is the preventive lever (flag it → action it → it never becomes an Issue); surfacing past **Issues** gives consequence-awareness. Synthesis (an LLM over the matches) is **phase 2**, gated on a sourced GPU.

## 1. Domain model (the grilled spine)

Three entities + one embedding layer. Names are **domain-neutral** and every record carries a `domain` (default `project`) — the seam for H&S/POWRA later (ADR 0003). Design sketch (column lists, not final SQL — no code yet).

All tables: `id uuid pk default gen_random_uuid()`, `created_at/updated_at timestamptz default now()`, `set_updated_at` trigger, RLS = the platform's 4-policy `authenticated` pattern (open for the PoC, ADR-free because it matches existing convention).

### `risk` — the potential (forward-looking, uncertain)

| column | type | notes |
|---|---|---|
| `domain` | `text not null default 'project'` | future seam; PoC only uses `project` |
| `risk_type` | `text not null default 'threat'` | threats only for PoC; `opportunity` later |
| `projectnumber` | `text` **null** → `project_register(projectnumber)` | **nullable** — seed risks are often project-agnostic tribal knowledge |
| `title` | `text` | short label (optional) |
| `cause` | `text` | "due to [cause]…" |
| `event` | `text not null` | "…there is a risk that [event]…" — the core, required |
| `effect` | `text` | "…which could lead to [effect]." |
| `probability` | `text` | `low/medium/high` (optional) |
| `impact` | `text` | `low/medium/high` (optional) |
| `proximity` | `text` | when it might hit (optional) |
| `response_category` | `text` | current strategy: `avoid/reduce/transfer/accept/contingency` |
| `status` | `text not null default 'open'` | `open/closed` |
| `risk_owner` | `text` | who manages it |
| `missed_risk` | `boolean not null default false` | surfaced unforeseen ("elevate to issue") |
| `captured_stage` | `text` | `meeting/closeout` — light capture-context (no separate meeting/closeout tables for the PoC) |
| `created_by` | `uuid` | `auth.uid()` |

The embedded text for a risk = `cause` + `event` + `effect` (+ `title`).

### `issue` — a realized Risk (0..many per Risk)

| column | type | notes |
|---|---|---|
| `risk_id` | `uuid not null` → `risk(id)` on delete cascade | every Issue has a parent Risk |
| `description` | `text not null` | what actually happened |
| `result` | `text` | impact / how it played out / outcome |
| `escalated` | `boolean not null default false` | `false` ≈ APM *Problem* (PM handled it); `true` ≈ APM *Issue* (escalated) |
| `occurred_at` | `date` | |
| `raised_by` | `text` | |
| `status` | `text not null default 'open'` | `open/closed` |
| `closed_at` | `date` | |

The embedded text for an issue = `description` (+ `result`).

### `risk_action` — the response log (risk- or issue-phase)

| column | type | notes |
|---|---|---|
| `risk_id` | `uuid not null` → `risk(id)` on delete cascade | always belongs to a Risk |
| `issue_id` | `uuid` **null** → `issue(id)` on delete set null | set when `phase = issue_mitigation` (names which Issue) |
| `phase` | `text not null` | `risk_mitigation` / `issue_mitigation` |
| `response_type` | `text` | `avoid/reduce/transfer/accept/contingency` (`reduce` = "mitigate") |
| `action_text` | `text not null` | what we did |
| `actionee` | `text` | who carried it out |
| `action_date` | `date` | |

### `library_vector` — the embedding layer (domain-agnostic; the reusable asset)

| column | type | notes |
|---|---|---|
| `kind` | `text not null` | `risk` / `issue` |
| `source_id` | `uuid not null` | the `risk.id` or `issue.id` |
| `domain` | `text not null default 'project'` | carried through for future scoping |
| `embedded_text` | `text not null` | exactly what was embedded (verbatim, no prefix) |
| `embedding` | `vector(768)` **null** | filled on save |
| `embedding_model` | `text not null` | `nomic-embed-text-v1.5` |
| `embedding_version` | `text` | serving tag |
| `embedding_dim` | `int not null` | guard against mixed dims |
| `embedded_at` | `timestamptz` | null ⇒ needs embedding |

- `unique (kind, source_id)` — one current vector per source row.
- **HNSW** index on `embedding` `vector_cosine_ops` (`m=16, ef_construction=64`).
- Storing `embedding_model/version/dim/embedded_text` makes a model change a **re-embed/backfill**, not a redesign.

**No `category` table** (ADR 0002). Objective facets for optional narrowing come straight off the rows: `response_type`, `escalated`, materialized-or-not (`kind`), `probability`/`impact`.

## 2. Retrieval (purely semantic + objective facets)

A `security invoker` RPC (RLS applies, browser anon client can call it):

```
match_risk_library(
  query_embedding   vector(768),
  match_count       int     default 10,
  p_domain          text    default 'project',
  filter_response   text    default null,
  filter_escalated  boolean default null,
  filter_kind       text    default null,    -- 'risk' | 'issue' | null (both)
  min_similarity    float   default 0.0
) returns table(kind, source_id, … , similarity)
```

`from library_vector` join its `risk`/`issue`; `where embedding is not null and domain = p_domain` + optional objective facet filters + `similarity >= min_similarity`; `order by embedding <=> query_embedding`; `limit match_count`. `similarity = 1 - cosine distance`. Results grouped by `kind` in the UI: **"Risks to consider"** / **"Issues that hit related jobs."**

(Optional, secondary: a generated `tsvector` + GIN for a keyword narrowing leg — nice-to-have, not the primary signal.)

## 3. Embedding service

```
[risk-library app] --(server-side API route)--> [embedding-proxy (CPU, Proxmox)] --(HTTP)--> [Orin: Ollama nomic-embed-text]
```

- **Model:** `nomic-embed-text-v1.5`, **768-dim**, 8192-token context, asymmetric prefixes `search_query:` / `search_document:`, L2-normalised, cosine. Served on the **Orin** via **Ollama** (embeddings only).
- **embedding-proxy (Proxmox, CPU):** stable internal contract `POST /embed { texts[], role: "query"|"document" } → { vectors, model, version, dim }`. It owns the **role prefix + L2 normalisation** (so capture and search can't drift) and decouples the app from the serving backend. **Internal-only** — no nginx route; reachable on `platform_net`.
- **Capture (on save):** embed the risk text (and issue text where present) as `document`, upsert `library_vector` row(s) with vector + model/version/dim.
- **Search:** embed the project profile as `query`, call `match_risk_library`, return ranked grouped results. Both hops server-side so the vector never reaches the browser.
- **Timing:** synchronous on-save for the PoC (low volume). Async worker + re-embed backfill = phase 2.

## 4. UI / app placement

- **`pss-risk-library` is a standalone app** (own repo + UI), sharing the self-hosted Supabase and the embedding-proxy — following the platform standalone-app pattern (gateway route, `platform_net`, ghcr.io/ARM64). This follows from the separate repo + the multi-UI direction (H&S/POWRA reuse the backend behind different UIs). *(Confirm at build — the alternative is embedding it inside the `operations` app.)*
- **Integration:** the `operations` project-detail page gets a **"Risk / Lessons"** link that deep-links into the risk-library app for that `projectnumber`.
- **Screens:**
  1. **Assessment lookup** — project-profile text box (optionally pre-seeded from `project_register_items.line_desc` + client + value) → ranked results grouped by kind, each card showing the cause/event/effect (or issue + result), response/actions, `escalated` badge, similarity %, and a link to the source project.
  2. **Capture** — cause/event/effect, (optional) probability/impact/proximity, response category, owner; "has this happened?" → issue description + result + `escalated`; the **"elevate to issue / missed risk"** checkbox.
  3. **Seeding mode** — a fast **"save and add another"** rapid-entry flow for the cold-start brain-dump.
- **Components:** `@platform/ui` (`PageHeader`/`Alert`/`Spinner`/`EmptyState`) + Tailwind + `--pss-*` tokens.
- **Permissions:** **open for the PoC** — any authenticated user can capture/edit; every record attributed (`created_by`, `risk_owner`, `actionee`). Role gating (only owner/PM can close/delete) = phase 2.

## 5. Infra placement

| Concern | Host | Notes |
|---|---|---|
| Embedding generation (GPU) | **Orin `10.0.0.74`** | Ollama `nomic-embed-text`, embeddings only |
| embedding-proxy (CPU) | **Proxmox** | prefix + normalise; on `platform_net`, internal-only |
| risk-library app | **Proxmox** *(stated target)* | ⚠️ apps run on **Pi `10.0.0.75`** today — reconcile |
| Supabase + **pgvector search (CPU)** | **Proxmox VM `10.0.0.85`** | search is CPU-only ✓ matches plan |

Everything runs on `platform_net`. **Storage location is not constrained** (relaxed 2026-06-26): dev uses the self-hosted Supabase, production uses cloud — the standard per-env pattern — so risk text + embeddings may live on the cloud project. Embeddings are still generated **locally on the Orin** (owned, free, on-LAN); only their numeric vectors + text are stored wherever the env points.

## 6. Cold start (the corpus *is* the product)

- **Seeding session only — no back-fill** (no usable historical registers exist). A facilitated brain-dump of the risks that bite *repeatedly* — an hour writes 30–40 high-value cause→event→effect records.
- Seed risks are often **project-agnostic** (`projectnumber` null) and may be **retrospective** (capture the risk *and* its issue/actions/outcome together).
- The capture form must be built for **rapid repeated entry** ("save and add another"); required fields minimal (`event` + whether it materialised). **Day-one value = the quality of that session.**

## 7. Scope

**PoC (build now):**
- Migration **040** (applied to self-hosted for dev, and to the cloud project for prod — enable the `vector` extension in the dashboard there first): `vector` extension; `risk`, `issue`, `risk_action`, `library_vector`; HNSW index; RLS; `set_updated_at` triggers; `match_risk_library` RPC. Neutral names + `domain` seam.
- Orin (Ollama `nomic-embed-text`) + Proxmox embedding-proxy.
- Standalone risk-library app: capture + seeding mode + assessment lookup. Sync-on-save embedding.
- Raw ranked, kind-grouped results (cause/event/effect · response/actions · outcome · `escalated` · similarity). Cloud Claude summary **optional, off by default** (viable now the on-network constraint is relaxed; still recommend deferring to phase 2 to stay lean).
- The seeding session.

**Phase 2 (gated on a sourced GPU):**
- Local **synthesis LLM** over the matches: triage which truly apply, consolidate similar-but-not-identical risks into one recommendation, adapt the precedent to the new job, surface caveats from `result`.
- Async embedding worker + re-embed backfill; opportunities (`risk_type`); derived tags/clustering for browsing; true hybrid fusion.
- **H&S / POWRA domains** — new UIs on the same backend: hierarchy-of-controls response vocabulary, likelihood/severity/residual scoring, a flexible subject (task/location). Backend + retrieval engine unchanged (ADR 0003).

## 8. Plumbing to confirm at build (not blockers, just verify-first)

1. **pgvector version** in the self-hosted Supabase image — HNSW needs ≥ 0.5.0.
2. **Migration file location / numbering** — 040 is the next number in the platform-portal sequence; decide whether the SQL lives in `platform-portal/supabase/migrations` or this repo, applied to the shared DB (avoid sequence collision).
3. **Standalone app vs `operations`-embedded UI** (§4) — following the separate repo, but confirm.
4. **Topology divergence** — stated target is portal + proxy + Supabase on Proxmox; today apps run on the Pi (`10.0.0.75`), Supabase on Proxmox VM (`10.0.0.85`), Orin (`10.0.0.74`) runs CP-SAT/doc services.
