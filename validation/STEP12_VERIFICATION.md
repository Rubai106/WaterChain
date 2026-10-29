# WaterChain Step 12 verification report (initial supplier snapshot — superseded)

> **Historical snapshot.** This document records the initial supplier-side verification before the later independent audit. Its reported npm-install blocker and its note that the real Uganda dataset had not yet been processed were accurate for that earlier run. The later audit supersedes this snapshot: see the top-level `TEST_REPORT.md` for the final frontend/API/browser-test accounting and `RESEARCH_DATA_AUDIT.md` for the actual published dataset profile. Keep this file only as an audit-trail record; do not use it as the current readiness summary.


Verification date: 2026-10-28 (environment date).

## PASS — executed in this environment

- `python -m unittest discover -s engine -p 'test_*.py' -v`: **75 tests passed**.
- `python -m unittest discover -s research/datasets -p 'test_*.py' -v`: **11 tests passed**.
- `python engine/evaluate.py`: **15 synthetic controlled scenarios**; expected-decision fixture conformance 100%; attribution coverage 20%; correct abstention on should-abstain cases 100%; unsupported attribution in should-abstain cases 0%.
- `python engine/run_holdout_validation.py`: **16/16** expected-decision conformance; 0/13 unsupported attributions in cases expected to abstain.
- `python -m py_compile engine/*.py research/datasets/*.py`: passed.
- `node scripts/check-typescript-syntax.cjs`: TypeScript 5.8.3 parser parsed 23 TS/TSX files with zero syntax errors. **This is syntax parsing only; it is not typechecking.**
- `python engine/build_reproducibility_manifest.py`: passed all four included Python/evaluation checks; hashes source inputs and reports zero missing manifest inputs.
- ZIP archive integrity: verified after packaging.

All evaluation figures above are conformance to developer-authored synthetic fixtures. They are not real-world water-contamination accuracy, sensitivity, specificity, calibration, or proof that a candidate transition is causal.

## BLOCKED — not independently completed here

- `npm ci`: timed out while contacting the npm registry. A subsequent direct TypeScript compiler invocation was unavailable because the interrupted install did not include `typescript/bin/tsc` in the local `node_modules` tree.
- `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`: not rerun successfully in this environment because dependency installation did not complete. Do not claim those checks passed based on the syntax parser.
- Full Water Quality Uganda dataset profile: official dataset CSVs were not downloaded or bundled. The adapter was tested only against the included, explicitly synthetic fixtures.
- Optional Supabase/PostgreSQL migration: not applied to a live database; the current application is still localStorage/IndexedDB-based.

## NOT TESTED / pending

- Independent review by a WASH/public-health or laboratory-method specialist.
- Field validation against defensible ground-truth transfer histories.
- Global novelty, patentability, or freedom-to-operate assessment.
- Multi-user data sharing, authentication, cloud persistence, and concurrent-edit behavior.
- External CI execution.

## Important model limits

The new explicit-journey mode links sample bottles to water/container entities through user-entered relationships and transfer evidence. It requires the selected source identifier to match linked evidence, references for qualifying relationship claims, and exactly one complete entity-connected route before it considers a candidate transition. Zero or multiple routes cause the engine to abstain. User-supplied references and hashes do not authenticate a field/lab record, and a complete path still does not prove causation.

The legacy shared-batch mode remains for backward compatibility. It is less expressive than explicit-journey mode.
