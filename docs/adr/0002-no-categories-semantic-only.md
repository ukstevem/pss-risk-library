# No fixed risk categories — retrieval is purely semantic

**Status:** accepted · 2026-06-26

## Decision

The risk library has **no controlled category / taxonomy field**. Retrieval is purely **semantic** over the risk's cause → event → effect text (and the issue text where it materialized). Optional narrowing of results uses **only objective facets that come straight off the risk register** — response type (avoid/reduce/transfer/accept), escalated (yes/no), materialized (risk vs issue), probability/impact. Any thematic grouping for browsing or reporting (e.g. "welding", "coating") is to be **derived automatically** (embedding clustering or auto-tagging), never hand-assigned at capture.

## Why (rejecting the obvious "add categories" design)

A controlled category list is what most risk registers do, so its absence is surprising — but it actively fights this system's purpose:

1. **Subjective assignment.** "Coating spec ambiguity caused rework" could be filed under Design, Quality, Documentation, or Coating; people disagree, and inconsistently.
2. **It excludes the matches that are the whole point.** A category *filter* ("show me Welding risks") hides the relevant risk filed under "Fabrication" — the exact cross-domain connection the library exists to surface (see [ADR 0001](0001-retrieval-design.md)). A taxonomy is a blinder.
3. **Capture friction.** The corpus is the product; every mandatory subjective field lowers capture quality.

The embedding *is* the categorisation — fuzzy, implicit, and impossible to mis-bucket.

## Consequences

- No category-based reporting in the PoC; if wanted later, derive tags automatically rather than reintroducing hand-assigned categories.
- The quality of the **cause/event/effect** risk text matters more, since it carries all the retrieval signal — raising the bar on capture discipline.
