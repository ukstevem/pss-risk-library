# Generic risk-assessment backend; project risk is the first domain

**Status:** accepted · 2026-06-26

## Decision

The same capture + semantic-retrieval engine applies beyond project risk — to **health & safety risk assessments** and **point-of-work risk assessments (POWRA)**. They share the Risk → Action → Issue structure and the "surface similar past records during a new assessment" use case. So the PoC builds **project risk only**, but keeps the backend **domain-neutral** so other domains arrive later as **new UIs on the same backend, not new systems**.

Concretely, banked now (cheap, reversible):
- Core tables are **`rl_`-prefixed and domain-neutral** — `rl_risk`, `rl_issue`, `rl_action`, `rl_vector` — **not** `project_*`.
- A **`domain` column** (default `project`) tags every record, as the future scoping seam.
- The subject link is **loose** — `projectnumber` is nullable now; a generic subject (task / location / work package) comes later.
- The embedding/retrieval layer is already domain-agnostic and is the shared asset.

**Not** built now: the H&S response vocabulary (hierarchy of controls: eliminate / substitute / engineering / administrative / PPE), H&S scoring (likelihood / severity / residual), alternative subjects, or any second UI.

## Why

The varying parts (subject, response vocabulary, scoring, retention/legal weight, UI) are thin compared with the shared parts (the spine + the embedding engine). A column and neutral naming are near-free insurance against a later rewrite; building the full generality now would slow the proof for a need that is explicitly "longer term".

## Consequences

- When H&S/POWRA come: add domain-scoped response vocabularies, a flexible subject, domain-specific scoring, and new capture UIs — backend and retrieval engine unchanged.
- Naming and the `domain` seam must be honoured in migration 040 even though only `project` is used in the PoC.
