# Risk Library

A historical record of project **Risks** and the **Issues** they become, with the **Actions** taken to address each — captured during projects and at closeout, and retrieved semantically when a new project assesses its risks. Supabase is the system of record; Obsidian holds the narrative, linked by `projectnumber`.

## Language

**Risk**:
Per APM BoK: "an uncertain event or set of circumstances that, should it occur, will have an effect on achievement of one or more project objectives." Forward-looking and uncertain (it *may* occur). Described as **cause → event → effect**. A risk can be a **threat** (negative) or an **opportunity** (positive); the PoC scopes to threats. First-class and tracked through a lifecycle.
_Avoid_: hazard, problem (a problem has already occurred — see Issue)

**Issue**:
A realized **Risk** — the potential actually occurred. Records what happened, its impact, and the result. Every Issue has a parent Risk. Carries an `escalated` flag: `false` = the project manager handled it (what APM calls a *Problem*); `true` = it went beyond the PM and was escalated (APM's strict *Issue*). Both live on one record.
_Avoid_: event, incident

**Missed Risk**:
The `missed_risk` flag on a **Risk**, set when an Issue occurred without the Risk having been logged proactively — the Risk is recorded after the fact (typically at closeout) and flagged. Set via an "elevate to issue" checkbox on the project-meeting and closeout forms.

**Action**:
A logged response addressing a **Risk** or its **Issue**, carrying:
- *response type* (APM BoK vocabulary): for threats — `avoid`, `reduce`, `transfer`, `accept`; for opportunities — `exploit`, `enhance`, `share`, `accept`; plus `contingency` for risks not handled proactively (contingency may be time, cost, resources, or course of action). `reduce` is the everyday "mitigate".
- *phase* — **risk mitigation** (addresses the open Risk) or **issue mitigation** (addresses the realized Issue)

One concept, one log; phase is recorded explicitly.
_Avoid_: task, step, reaction, mitigate (use `reduce`)

**Project Meeting**:
A recurring meeting during a project where Risks are identified and reviewed as work progresses.

**Closeout Meeting**:
The terminal meeting at project end. Only realized items are recorded — every closeout entry is an **Issue**; a brand-new one is a missed Risk.

## Relationships

- A **Project Meeting** identifies one or more **Risks**
- A **Risk** is the potential for **zero or more Issues** (it may never materialize, or cause several)
- A **Risk** accrues zero or more **Actions** (each with an effect + phase)
- An **Action** addresses the **Risk** (risk mitigation) or a *specific* **Issue** of that Risk (issue mitigation) — an issue-mitigation Action names which Issue
- A **missed Risk** is a Risk first recognized only once its Issue had occurred
- A **Closeout Meeting** records only **Issues**; a new one there is a missed Risk

## Example dialogue

> **Dev:** "A risk never materialized — do we still keep it?"
> **Steve:** "Yes, it's a risk we managed. If it *had* happened it'd have an Issue; the actions on it were risk mitigation."
> **Dev:** "And something that blew up at the end nobody saw coming?"
> **Steve:** "That's an Issue with a missed risk — tick 'elevate to issue'."

## Flagged ambiguities

- "Issue" first meant a separate closeout problem, then a missed Risk; **resolved** — an Issue is a *realized Risk* (the potential occurred). "Missed risk" is a flag on the Risk, not a separate kind of Issue.
- "Event" (earlier word for a materialized Risk) is **retired** in favour of **Issue**.
- "Action" vs "reaction" — **resolved**: one Action; the difference is its *phase* (`risk mitigation` vs `issue mitigation`).
- **APM "Issue" is stricter than ours** — APM defines an Issue as something that has *already occurred* **and is beyond the project manager's authority** (needs escalation), and calls a within-PM-control occurrence a *Problem*. Our glossary merges both into "Issue = realized Risk". **Resolved** — keep one realized-risk record with an `escalated` flag (`false` ≈ APM Problem, `true` ≈ APM Issue).
