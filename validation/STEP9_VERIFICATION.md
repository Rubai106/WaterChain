# WaterChain Step 9 — Verification status

Date: 2026-10-28. This report distinguishes checks executed in this environment from checks that remain blocked.

## Passed here

- Corrected Step 8 archive was inspected and passed `unzip -t`.
- Python suite: 40/40 tests passed after the Step 9 source edits. These are the existing engine tests; Step 9 does not change inference rules.
- Synthetic evaluation: 15 scenarios rerun; expected-decision fixture conformance 100%, attribution coverage 20%, correct abstention 100%, unsupported attribution 0% across predeclared abstain cases. Fixture scores are not real-world diagnostic performance.
- Development holdout: 16/16 predeclared decisions matched; 0/13 unsupported attributions in scenarios expected to abstain. Still developer-authored synthetic cases, not an independent review.
- TypeScript/TSX parser syntax check: 11 files parsed without syntax diagnostics using the globally installed TypeScript compiler API. This is syntax parsing, not a full project typecheck.
- CSV parser smoke tests passed with a stubbed evidence-schema dependency for: duplicate record codes inside a file, collision with existing record codes, unknown header rejection, and normal import. Full Zod/browser integration is not covered by this smoke test.
- Reproducibility manifest regenerated after the Step 9 edits; all listed files were present and the Python tests passed.
- Final ZIP passed integrity verification.

## Blocked / not yet verified for Step 9

- `npm ci --no-audit --no-fund` timed out while accessing the package registry. As a result, the Step 9 version's complete `npm run typecheck`, `npm run lint`, and production build were not run here. The previous corrected Step 8 version passed those checks in Muse's reported environment, but Step 9 has frontend changes, so that previous result does not prove this version builds.
- Real browser tests for report restoration after switching investigations/reloading, stale-cache handling, and the updated CSV import checks were not rerun for Step 9. The added checks in `JUDGE_DEMO_CHECKLIST.md` must be executed against this archive.
- GitHub Actions has not been run remotely.
- No external review or real-world scientific validation is claimed.

## Critical manual regression sequence

1. Create investigations A and B. Add evidence to A, run a diagnostic review, switch to B, then return to A. A's report should restore; B must not show A's report.
2. Reload while A is active. Its report should reappear.
3. Edit one field in A. The stale notice should appear and export should be disabled. Re-run the diagnostic; export should become available again.
4. Try a CSV with duplicate `record_code` rows, one with a record code already in the current case, and one with an unsupported header. Confirm a clear error and no silent duplicate/import loss.
5. Check that malformed report cache content is not silently overwritten on page load.
