# Step 18 comparative evaluation report

> Developer-authored fixtures; fixture conformance only. Not real-world accuracy.
> See engine/COMPARATIVE_EVALUATION_PROTOCOL.md.

- Engine: waterchain-rule-engine-v1
- Baseline: naive first-positive baseline (earliest raw positive; no abstention logic)
- Route: real /api/diagnose at http://localhost:3107
- Scenarios: 12

| Method | Fixture conformance | Unsupported attribution rate | Correct abstention | Attribution correctness |
| --- | --- | --- | --- | --- |
| WaterChain | 100.0% | 0.0% | 100.0% | 100.0% |
| Naive baseline | 41.7% | 87.5% | 12.5% | 100.0% |

- Invalid-evidence detection rate (engine eligibility gate): 100.0%
- Recommendation-quality rubric mean (WaterChain only): 100.0%

## Omission sensitivity

- cmp18-omission-sensitive: baseline serving -> post-omission None (expected None); match=True
- cmp18-omission-stable: baseline storage -> post-omission storage (expected storage); match=True

## Per-scenario results

| Scenario | Expected | WaterChain | Baseline | WC match | BL match | Action quality |
| --- | --- | --- | --- | --- | --- | --- |
| cmp18-clean-serving | serving | serving | serving | True | True | 100% |
| cmp18-clean-collection | collection | collection | collection | True | True | 100% |
| cmp18-duplicate-identifier | None | None | serving | True | False | 100% |
| cmp18-discordant-repeats | None | None | serving | True | False | 100% |
| cmp18-omission-sensitive | serving | serving | serving | True | True | 100% |
| cmp18-omission-stable | storage | storage | storage | True | True | 100% |
| cmp18-missing-timestamp | None | None | storage | True | False | 100% |
| cmp18-unsupported-analyte | None | None | collection | True | False | 100% |
| cmp18-unrelated-source | None | None | serving | True | False | 100% |
| cmp18-failed-qc | None | None | collection | True | False | 100% |
| cmp18-source-positive-all | None | None | source | True | False | 100% |
| cmp18-all-negative | None | None | None | True | True | 100% |

Developer-authored comparison set (Step 18). The engine was designed and tuned on earlier fixtures, so conformance measures fixture conformance, not real-world accuracy. The naive baseline is deliberately naive. Independent blind review is pending via validation/reviewer_packet.json.
