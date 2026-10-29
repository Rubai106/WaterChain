# Step 18 comparative evaluation protocol

## Objective

Compare WaterChain's diagnostic engine against a documented simple baseline on
adversarial synthetic fixtures, measuring conservative behavior (unsupported
attributions, abstention), evidence handling, omission sensitivity, and the
quality of follow-up recommendations.

## The baseline

**Naive first-positive baseline**: predict the earliest pathway stage with a
raw positive result; abstain only when no positive exists. It deliberately
ignores lineage (batch/source identity), laboratory QC, test method,
timestamps, duplicate identifiers, discordant repeat results, and analytes.
It is a lower-bound comparison point, not a recommended workflow and not a
fair substitute for a validated operational method.

## Scenario provenance and disclosure

- The 13 `cmp18-*` scenarios in `engine/step18_compare.py` were authored in
  Step 18 by the auditor with full knowledge of the engine's decision rules.
- The engine itself was designed and tuned on earlier fixtures (Steps 6-16).
- Expected decisions were fixed at authoring time from the documented rules,
  before the comparison was executed. Two authored expectations were corrected
  after execution (documented in docs/history/BUG_FIX_SUMMARY_STEP18.md): both were wrong
  expectations about which next-action IDs the planner emits, not engine
  decision changes. No diagnostic rule was altered to fit the fixtures.
- Conformance figures measure fixture conformance on developer-authored cases.
  They are not real-world diagnostic accuracy, field validation, or evidence of
  product effectiveness.
- The independent-review packet (`validation/reviewer_packet.json`,
  `engine/build_reviewer_packet.py`, protocol in
  `validation/INDEPENDENT_REVIEW_PROTOCOL.md`) is the instrument for review
  independent of implementation. External reviewer results are pending; no
  external review is claimed.

## Metrics

- **Unsupported-attribution rate**: share of should-abstain cases where the
  method names an attribution stage anyway.
- **Correct-abstention rate**: share of should-abstain cases with no
  attribution.
- **Attribution correctness**: share of should-attribute cases where the
  predicted stage equals the expected stage.
- **Invalid-evidence detection rate**: share of records pre-marked
  `should_be_excluded` (ineligible by rule) that the engine's eligibility gate
  actually excludes (from `record_eligibility`).
- **Recommendation-quality rubric** (WaterChain only; the baseline has no
  recommendation mechanism): six fixed checks per scenario —
  (1) every action has non-empty why / what-positive-means / what-negative-means
  / prerequisites; (2) action IDs unique and count <= 8; (3) no assertion of a
  contamination origin as fact (banned-phrase scan); (4) no citation of an
  excluded record ID; (5) expected case-relevant action IDs present;
  (6) at least one action produced. Mean over scenarios.

## Execution

- In-process: `python3 engine/step18_compare.py`
  (calls the same `diagnose()` function the API shells out to).
- Through the real API: `python3 engine/step18_compare.py --api http://localhost:3107`
  (fixture transport adaptation documented in the script: `createdAt` added;
  non-finite numeric values cannot be carried in JSON and are skipped in API
  mode — the API intentionally rejects them).
- Reports: `engine/step18_comparison_report.json` and
  `engine/step18_comparison_report.md`.
- Regression guardrails: `python3 -m unittest engine.test_step18_compare`
  (no unsupported attributions, full abstention on abstain-required cases,
  full invalid-evidence detection, omission expectations, rubric pass,
  legacy-mode source-identity reconcile action).

## Interpretation

A stable categorical conclusion or a 100% conformance figure on these fixtures
is not proof of scientific correctness. The honest claims supported here:

1. The engine never names an attribution where its own rules require
   abstention (0.0% unsupported-attribution rate on 9 should-abstain fixtures),
   while the naive baseline does so 88.9% of the time.
2. Decisions respond to evidence omission in the expected direction
   (pivotal omission changes the decision; redundant omission preserves it).
3. Follow-up recommendations are complete, bounded, and free of origin
   assertions or invented probabilities.
4. Identical guardrail behavior is observed through the real
   browser/API/Python path (12/12 JSON-carryable scenarios).
