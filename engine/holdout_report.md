# WaterChain Step 6 — Development holdout and adversarial validation

> **Synthetic software tests only. This is not independent or blinded validation and is not real-world performance evidence.**

Cases: **16**
Expected-decision conformance: **100.0%**
Cases expected to abstain: **13**
Unsupported attributions in should-abstain cases: **0**

| Case | Expected stage | Prediction | Match? | Finding codes |
|---|---|---|---|---|
| `holdout_clean_collection_transition` | collection | collection | yes | — |
| `holdout_clean_serving_transition` | serving | serving | yes | — |
| `holdout_no_positive` | ABSTAIN | ABSTAIN | yes | — |
| `holdout_discordant_storage_repeats` | ABSTAIN | ABSTAIN | yes | discordant_stage_results |
| `holdout_duplicate_record_id` | ABSTAIN | ABSTAIN | yes | duplicate_record_identifier |
| `holdout_reused_sample_id` | ABSTAIN | ABSTAIN | yes | sample_identity_reused_across_stages |
| `holdout_off_lineage_positive` | ABSTAIN | ABSTAIN | yes | off_lineage_records |
| `holdout_two_common_batches` | ABSTAIN | ABSTAIN | yes | ambiguous_multiple_common_batches, lineage_unproven, discordant_stage_results, discordant_stage_results |
| `holdout_qc_incomplete` | ABSTAIN | ABSTAIN | yes | record_excluded, no_shared_batch_link, lineage_unproven |
| `holdout_qc_failed` | ABSTAIN | ABSTAIN | yes | record_excluded, no_shared_batch_link, lineage_unproven |
| `holdout_equal_adjacent_timestamps` | ABSTAIN | ABSTAIN | yes | timeline_conflict |
| `holdout_conflicting_sources` | ABSTAIN | ABSTAIN | yes | source_identity_conflict, lineage_unproven |
| `holdout_mixed_analytes` | ABSTAIN | ABSTAIN | yes | mixed_analyte_pathway |
| `holdout_consistent_quantitative_serving` | serving | serving | yes | — |
| `holdout_source_positive_origin_unknown` | ABSTAIN | ABSTAIN | yes | transition_not_bracketed |
| `holdout_missing_collection` | ABSTAIN | ABSTAIN | yes | no_shared_batch_link, lineage_unproven |

## Interpretation limits

- Every case is synthetic and authored by the developer; no real samples or lab results are present.
- The test set is separate from the Step 5 scenario generator but is not independently blinded or externally adjudicated.
- Conformance measures software behavior against hand-declared expected decisions, not real-world causal accuracy.
- The rule engine does not model intermittent contamination, sample sensitivity, transfer/refill graphs, or probabilistic uncertainty.
- Passing this suite does not establish safety, public-health utility, scientific validation, novelty, or superiority over other tools.

Expected-decision conformance measures only agreement with the test cases' predeclared software-behavior expectations. It must not be described as diagnostic accuracy in the field.
