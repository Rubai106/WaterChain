# Step 15 Changelog — Temporal Evidence & Sampling Planner

## Added

- Chronological evidence timeline ordered by user-entered collection timestamps.
- Separate disclosure for records with missing or invalid timestamps; no timestamp is inferred or filled in.
- Filters for investigation/journey scope, stage, and analyte.
- Current engine eligibility labels on every timeline event, including unresolved, excluded, and eligible off-pathway statuses.
- Descriptive repeated-observation summaries for eligible records grouped by source/stage/analyte and explicit water/container entity where available.
- Caveats for provisional entity groupings, changing result categories, quantitative unit comparability, and repeated records sharing the same sample ID.
- Deterministic sampling-action candidates for timestamp gaps, critical metadata/QC issues, changing eligible results, missing stage events, undocumented transfers, missing laboratory references, and absent/stale diagnostic review.
- Side-by-side comparison of up to three proposed actions, including positive/negative result interpretation, prerequisites, remaining unknowns, and ranking basis.
- Prefilled ActionLoop draft handoff for temporal planning actions. The handoff does not persist an action without explicit user submission.
- Step 15 Playwright regression tests and an undated-time CSV fixture.

## Preserved

- Diagnostic decision rules and Python engine unchanged.
- Water-journey and relationship-model semantics unchanged.
- Evidence schema unchanged.
- No new dependencies added.
- No sample results seeded into production investigations.

## Limitations

- Browser timeline and action plan are local prototype functions, not shared multi-user workflows.
- Repeat pattern descriptions rely on recorded metadata and current engine eligibility; they do not establish causal relationships or persistent safety conditions.
- The action ranking is a transparent deterministic heuristic, not a validated sampling optimization algorithm.
