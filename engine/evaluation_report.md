# WaterChain controlled-scenario evaluation

> **Synthetic fixtures only. Not field data, not laboratory results, and not a real-world performance study.**

Scenario count: **15**

## Methods compared

| Metric | WaterChain | Naive first-positive baseline |
|---|---:|---:|
| Expected-decision fixture accuracy | 100.0% | 26.7% |
| Attribution coverage | 20.0% | 93.3% |
| Selective accuracy when attributing | 100.0% | 21.4% |
| Correct attribution rate on identifiable fixtures | 100.0% | 100.0% |
| Correct abstention rate on should-abstain fixtures | 100.0% | 8.3% |
| Unsupported attribution rate on should-abstain fixtures | 0.0% | 91.7% |
| Incorrect attribution count | 0 | 11 |

## Scenario-by-scenario results

| Scenario | Expected decision | WaterChain | Baseline | Outcome |
|---|---|---|---|---|
| `clean_collection_transition` | collection | collection | collection | both match |
| `clean_storage_transition` | storage | storage | storage | both match |
| `clean_serving_transition` | serving | serving | serving | both match |
| `all_stages_negative` | ABSTAIN | ABSTAIN | ABSTAIN | both match |
| `source_positive_origin_unresolved` | ABSTAIN | ABSTAIN | source | WaterChain only |
| `missing_serving_batch` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `mismatched_storage_batch` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `conflicting_source_identity` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `chronology_conflict` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `source_stage_missing` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `qc_failed_at_storage` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `storage_method_missing` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `collection_not_tested` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `unsupported_storage_analyte` | ABSTAIN | ABSTAIN | storage | WaterChain only |
| `invalid_source_timestamp` | ABSTAIN | ABSTAIN | collection | WaterChain only |

## Interpretation guardrails

- Scenarios and values are synthetic test fixtures created in code, not household or laboratory observations.
- Expected decisions are predeclared for deterministic software conformance; they are not independently adjudicated field ground truth.
- The baseline is deliberately naive and is not a fair substitute for a validated operational method.
- This harness tests only the current four-stage rule engine and its defined constraints.
- No statistical significance, external validity, calibration, or real-world diagnostic efficacy can be inferred from these results.

These metrics describe only conformance on the listed synthetic fixtures. They must not be presented as real-world diagnostic accuracy, validated sensitivity/specificity, or proof that WaterChain outperforms existing water-quality workflows.
