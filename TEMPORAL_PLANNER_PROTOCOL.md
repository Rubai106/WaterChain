# Step 15 — Temporal Pattern and Sampling Planner Protocol

## Scope

The temporal workbench is a descriptive review aid. It does not estimate contamination prevalence, persistence, source, risk, or causal origin. It does not treat a negative result as proof of absence.

## Temporal grouping rules

Records are grouped by recorded source ID, stage, analyte, and explicit water/container entity reference where one is available. If the entity reference is missing, the UI adds a limitation explaining that grouping is provisional. It is not a confirmed same-point time series.

Only records with parseable `collectedAt` values enter the timeline. Records without valid collection times remain visible in a separate list.

Repeat-pattern descriptions require a current diagnostic report with eligible observations. Engine-excluded and unresolved records are not used in these descriptions. Eligible observations marked off the selected pathway may be described as observations, but the UI explicitly says they do not support a cross-stage pathway conclusion.

Same sample ID over multiple records is treated as a potential duplicate or laboratory replicate, not as independent field sampling. Detected/not-detected changes are described as observed category changes, not inferred intermittent contamination.

Quantitative values are compared descriptively only when all values have the same non-empty unit and the values are finite and eligible. The implementation does not normalize units or infer detection-limit semantics.

## Candidate-action priority rules

- **High:** missing/invalid collection timestamps; critical method/QC/quantitative integrity issues; changing eligible result categories needing reconciliation; missing sampling events or unsupported adjacent-stage transfer relationships in a selected explicit journey.
- **Medium:** repeat a single eligible positive observation to understand repeatability; reconcile missing original laboratory-report references; run a current diagnostic review when absent or stale.
- **Low:** reserved for future documentation-only actions where no stronger gap exists. The current planner does not manufacture a low-priority candidate merely to fill a list.

The ranked list is capped at twelve unique candidate actions and sorted by priority then stage/title. This is a deterministic workflow heuristic, not an information-theoretic optimizer. It does not estimate probabilities, cost, time, or expected information gain.

## Interpretation rules

The possible-result statements are qualitative explanations. A positive follow-up establishes only another observation at the documented time and conditions, subject to test eligibility. A negative follow-up does not erase an earlier positive. Neither alone proves a causal origin.
