# Step 16 release reconciliation

## Which report is current?

- `TEST_REPORT.md` is the later detailed independent audit report supplied with the Step 16 test-verified release. It records `npm ci`, typecheck, lint, production build, API probes, Python suites, evaluations, the live-browser workflow, and limitations.
- `BROWSER_TEST_REPORT.md` provides detailed browser-test coverage and carefully documents the composed final result: the final full run had one screenshot timeout on a memory-constrained machine; the screenshot test passed on a longer standalone rerun, and targeted regression specs passed. The 61/61 figure is therefore a composed result, not one uninterrupted full run.
- `STEP16_VERIFICATION.md` and `STEP16_RELEASE_AUDIT.md` are historical snapshots from the initial implementation pass, when the authoring environment could not install npm dependencies. They are retained for provenance and must not be read as the final frontend verification status.

## Independent checks repeated in this review environment (2026-10-29)

| Check | Result | Evidence / limitation |
|---|---|---|
| ZIP integrity | PASS | `unzip -t` completed without errors. |
| Python engine tests | PASS | `python3 -m unittest discover -s engine -p 'test_*.py' -v`: 83/83. |
| Research-data adapter tests | PASS | `python3 -m unittest discover -s research/datasets -p 'test_*.py' -v`: 12/12. |
| Synthetic evaluation | PASS | 15 scenarios reproduced: 100% expected-decision fixture conformance, 20% attribution coverage, 100% correct abstention on should-abstain cases, 0% unsupported attributions on those cases. |
| Synthetic holdout | PASS | 16/16 expected decisions; 0/13 unsupported attributions on should-abstain cases. |
| TypeScript/TSX syntax parser | PASS | 35 files parsed; zero syntax errors. This is not a typecheck. |
| Reproducibility manifest | PASS | Rebuilt with 5 checks passed, 105 files hashed, 0 missing. The earlier audit report's 103-file count reflects the manifest generated at that audit point. |
| `npm ci` | BLOCKED here | Request timed out in this review environment. Therefore this reviewer did not independently rerun typecheck, lint, production build, or browser tests. |

## Scientific and operational boundaries

The synthetic results are software fixture conformance, not real-world diagnostic accuracy. The sensitivity feature is leave-one-record-out evidence-dependence analysis, not a physical-world counterfactual or statistical robustness guarantee. External WASH/laboratory review and field validation remain outstanding. Operational deployment remains not ready until authentication, server-side data authority, live database security verification, and field validation are addressed.
