# Step 15 — Temporal Evidence & Sampling Planner

## What it does

The Temporal Evidence workbench provides three separate views:

1. A chronological list of entered evidence records with collection timestamps and engine eligibility status.
2. A descriptive repeat-observation summary for same-source / same-stage / same-analyte groups when there is a current engine report and eligible result data.
3. A transparent set of possible next actions that can be compared and turned into an ActionLoop draft after a user reviews and submits it.

## Timeline semantics

- A date is rendered from the sample's entered `collectedAt` value. WaterChain does not independently verify the timestamp or timezone.
- Records with missing or invalid times are listed in a separate disclosure and are not assigned an invented time.
- A stale or missing diagnostic report means eligibility displays as unresolved. Register-level validation is not a substitute for engine eligibility.
- An eligible but off-pathway observation may be included as a descriptive temporal observation, with a caveat. It is not allowed to support a cross-stage pathway conclusion.
- Grouping by source / stage / analyte without an explicitly mapped water/container entity is provisional. It does not establish repeated sampling at the same point.
- Repeated sample IDs are labelled as possible duplicate or technical replicate records, not independent field samples.

## Planner semantics

Recommendations are deterministic and rule-based. High priority means an identified issue blocks or substantially limits interpretation under configured rules; medium priority commonly means reconcile results or improve provenance; lower priority means documentation improvement. These labels are not a calibrated health-risk score, cost estimate, sample-success probability, or expected information gain.

For every candidate, the UI explains:
- Why the action was suggested.
- What a possible positive observation would mean.
- What a possible negative observation would mean.
- What remains unknown.
- Prerequisites before action.
- The explicit rule used to rank the action.

Clicking **Use in ActionLoop** opens a prefilled draft. Nothing is persisted until the user reviews the details, assigns an owner, fills required fields, and submits the action.

## Test

```bash
npm run test:temporal-e2e
```

The suite requires dependencies and Playwright Chromium. Its fixture data are synthetic, isolated browser tests; they are not inserted into users' live investigations.
