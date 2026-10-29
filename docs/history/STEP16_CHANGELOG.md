# Step 16 changelog — Decision Sensitivity Studio

## Added

- Added a context-aware “Suggested next action” card that directs users to the appropriate evidence, review, follow-up, or sensitivity-test section without presenting workflow progress as a water-safety score.
- Removed late dark-page overrides that conflicted with the intended light-first theme and corrected contrast for navigation and diagnostic-state text.

- `components/diagnostics/DecisionRobustnessStudio.tsx` adds a report-scoped evidence-sensitivity panel.
- A reviewer can select up to four currently eligible, on-pathway positive/negative records and submit one omission scenario per selected record to the same diagnostic API.
- In explicit-journey mode, the temporary scenario also removes the sampling event that references the omitted record; no local evidence or transfer data is altered.
- The UI compares decision categories, conclusion text, confidence labels, hypothesis states, and lineage states, and separates failed scenarios from successful runs.
- JSON export binds the scenario report to a SHA-256 fingerprint of the input snapshot and avoids duplicating raw evidence rows.
- `tests/e2e/decision-robustness.spec.ts` adds browser regression tests for scenario runs, preservation of original records, export and stale-report behavior.
- Documentation covers method, interpretation, novelty boundaries and current verification status.

## Preserved

No Python diagnostic rule, evidence schema, API contract, sample record, or evaluation fixture was changed. The new feature reruns the existing engine with a deliberately reduced payload and labels the operation as an evidence-availability sensitivity analysis.
