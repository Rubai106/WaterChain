# Step 16 release audit

> **Historical implementation-pass snapshot — superseded.** This document records the earlier Step 16 development environment, where npm installation timed out and frontend typecheck/build/Playwright checks were blocked. The later independent audit results are documented in `TEST_REPORT.md` and `BROWSER_TEST_REPORT.md`. The browser test totals in those reports are composed across the final full run and targeted reruns; they are not a claim that all tests passed in one single run. For the latest package verification state, read `RELEASE_RECONCILIATION.md` and the reproducibility manifest.

## Scope

Alongside the sensitivity panel, this release adds a context-aware guided-next-action card and restores consistent light-first contrast where older CSS overrides conflicted with the redesign.

This release adds a Decision Sensitivity Studio to the existing Step 15 WaterChain application. It tests how the existing rule engine's decision changes when a selected eligible on-pathway record is unavailable to the analysis. The original record store is not modified by a sensitivity scenario.

## Why it is useful

The feature makes evidence dependency visible: reviewers can inspect whether a conclusion category relies on a specific sample being included. It is an explainable challenge to the current review, not a new scientific model.

## Novelty position

Leave-one-out/sensitivity analysis and evidence traceability are established methods. The possible product differentiation is their integrated use within WaterChain's explicit journey, evidence eligibility, abstention, temporal review, risk/control, and action-tracking workflow. Global novelty and patentability are not claimed.

## Verification completed in the current build environment

- Python engine tests: 79/79 PASS.
- Research-data adapter tests: 12/12 PASS.
- Synthetic evaluation: 15 cases reproduced; expected-decision fixture accuracy 100%, attribution coverage 20%, correct abstention 100%, unsupported attributions in should-abstain cases 0%.
- Synthetic holdout: 16/16 expected decisions reproduced; unsupported attributions in should-abstain cases 0/13.
- TypeScript/TSX syntax parse: 35 files, zero syntax errors.
- Reproducibility manifest: five configured checks PASS; 100 files hashed; 0 missing.
- ZIP integrity: verified after packaging.

## Blocked / not run

`npm ci` timed out in this environment; the local npm cache is empty. Consequently, the full project TypeScript typecheck, ESLint, Next.js production build, and Playwright browser tests were not executed here. The new Playwright tests are included but are not claimed to have passed.

## Known limitations

- At most four omission scenarios are run per pass.
- Omission is a test of evidence availability, not a physical-world counterfactual.
- Stable outcomes across selected omissions are not a probability or statistical robustness guarantee.
- The same deterministic rule engine is used for baseline and scenario runs; this feature does not provide independent ground truth.
- Browser/API integration and export must be confirmed after dependencies are installed.
- External WASH/laboratory review, user testing and real-world validation remain needed for a 55/60-level submission; feature implementation alone cannot establish that score.
