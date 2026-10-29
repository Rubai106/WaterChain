# Step 16 — Verification report

> **Historical implementation-pass snapshot — superseded.** This document records the earlier Step 16 development environment, where npm installation timed out and frontend typecheck/build/Playwright checks were blocked. The later independent audit results are documented in `TEST_REPORT.md` and `BROWSER_TEST_REPORT.md`. The browser test totals in those reports are composed across the final full run and targeted reruns; they are not a claim that all tests passed in one single run. For the latest package verification state, read `RELEASE_RECONCILIATION.md` and the reproducibility manifest.

## Implemented

- Added a guided next-action card that updates from actual workspace state (empty evidence, no review, stale review, withheld attribution, or candidate-transition review) and scrolls/focuses the corresponding section. It is labelled as a workflow suggestion, not a risk/safety score.
- Corrected inherited dark background and low-contrast navigation/diagnostic style overrides to reinforce the intended light-first design.

- Decision Sensitivity Studio runs a single-record-omission test against the actual `/api/diagnose` endpoint.
- It accepts only currently engine-eligible on-pathway positive/negative records and caps a single run at four omissions.
- Explicit-journey scenarios temporarily remove the sampling event referencing the omitted evidence record. The original register and journey are not modified.
- Results compare decision-category signature and conclusion wording. A compact JSON sensitivity report includes a SHA-256 fingerprint of the input snapshot and excludes raw evidence rows.
- Changed evidence makes a prior sensitivity result stale and the diagnostic view hides it with the stale report.
- Added two Playwright regression tests for this feature.

## Checks actually run for this package

| Check | Result | Detail |
|---|---|---|
| Python engine suite | PASS | 83 tests passed (including 4 Step 16 sensitivity regressions) |
| Dataset-adapter suite | PASS | 12 tests passed |
| Sensitivity smoke test | PASS | Four single-record omissions against the controlled linked pathway withheld candidate-transition attribution; input records remained unchanged.
| Synthetic evaluation | PASS | 15 scenarios reproduced; expected-decision fixture accuracy 100.0%; attribution coverage 20.0%; correct abstention 100.0%; unsupported attribution on should-abstain cases 0.0% |
| Synthetic holdout | PASS | 16/16 expected decisions; 0/13 unsupported attributions in should-abstain cases |
| TypeScript/TSX syntax | PASS | 35 files parsed, zero syntax errors |
| Reproducibility manifest | PASS | 5 configured checks passed; 103 source/documentation files hashed; 0 missing |
| ZIP integrity | PASS | verified after packaging |
| npm dependency installation | BLOCKED | `npm ci --prefer-offline --no-audit --no-fund` timed out; local npm cache has no packages |
| TypeScript typecheck | BLOCKED | dependencies and project type definitions unavailable after install timeout |
| ESLint | BLOCKED | dependencies unavailable |
| Next.js production build | BLOCKED | dependencies unavailable |
| Playwright regression tests | NOT RUN | test file included; Playwright/Chromium dependencies unavailable |

## Scientific interpretation

The results describe software behavior on developer-authored synthetic fixtures. They do not establish real-world contamination-localization accuracy. The new feature is an evidence-availability sensitivity check, not a physical-world counterfactual, calibrated probability, statistical robustness guarantee, or proof of causation.

## Recommended verification commands

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:e2e -- tests/e2e/decision-robustness.spec.ts
```
