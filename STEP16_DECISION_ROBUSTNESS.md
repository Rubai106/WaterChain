# Step 16 — Decision Sensitivity Studio

## User value

The Decision Sensitivity Studio answers a narrow, operationally useful question: **does the diagnostic engine's decision category change if a selected eligible on-pathway record is unavailable?** It runs a leave-one-record-out analysis against the same `/api/diagnose` endpoint used for the normal review.

## Method

- The user chooses up to four currently eligible, on-pathway records.
- For each scenario, the component sends a temporary request omitting one record. In explicit-journey mode it also removes the sampling event that points to that record.
- The original evidence register and current diagnostic report are never modified.
- The result compares decision permission, confidence label, first observed-positive stage, stage hypothesis statuses, and lineage state.
- A JSON artifact records the baseline classification, omitted record IDs/codes, scenario conclusions, findings, errors, and a SHA-256 fingerprint of the tested evidence snapshot. Raw evidence values are not copied into the sensitivity artifact.
- A result is treated as stale when the evidence/journey fingerprint changes, and a stale result cannot be exported.

## Interpretation limits

This is a deterministic **evidence-availability sensitivity check**, not a physical-world counterfactual. It does not mean the omitted sample never existed; it asks what the same rule engine would report if its evidence were unavailable. A result that stays the same under a small selected set of omissions is not a statistical robustness guarantee. The feature estimates no probability, cost, confidence interval, expected information gain, or contamination risk.

Only the same configured rule engine is rerun. This feature does not create new independent scientific evidence, authenticate the source documents, or establish causation.

## Testing

`engine/test_step16_sensitivity.py` covers a controlled linked baseline, all four record omissions, input immutability and conservative interpretation. `tests/e2e/decision-robustness.spec.ts` covers running selected omissions through the UI/API, showing the completed scenario set, preserving original evidence, exporting a report, and removing the sensitivity view when the diagnostic report becomes stale.

Run with:

```bash
npm run test:e2e -- tests/e2e/decision-robustness.spec.ts
```

The browser test needs the normal Next.js/Python environment and Playwright Chromium installed. A source-level check is not a substitute for running it.
