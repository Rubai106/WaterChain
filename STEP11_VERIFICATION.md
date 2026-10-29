# WaterChain Step 11 — Verification Report

## Changes in this package

- Off-pathway eligible results are no longer shown as selected-pathway observations.
- Pathway counts show the number of eligible records actually linked to the selected pathway.
- Eligibility table matching uses immutable internal record IDs.
- Stale reports hide the previous conclusion and result panels by default. The historical result is available only through an explicit collapsed disclosure and remains non-exportable as current evidence.
- Manual entry uses a collision-checked human-readable record code and rejects an accidental duplicate defensively.
- Browser regression tests cover off-pathway positive evidence, stale conclusion collapse, and distinct manually generated record codes.

## Checks executed in this environment

| Check | Status | Result |
|---|---|---|
| Python unit tests | PASS | 52/52 tests pass |
| Synthetic controlled evaluation | PASS | 15 scenarios; expected-decision fixture conformance remains 100% |
| Synthetic development holdout | PASS | 16/16 expected decisions match |
| ZIP archive integrity | PASS | Final ZIP passes `unzip -t`; 96 project files are included, excluding local dependency/cache directories |
| TypeScript syntax parse | PASS | Global TypeScript `transpileModule` parsed all 6 modified TS/TSX files without syntax errors; this is syntax-only, not a typecheck |
| TypeScript typecheck | BLOCKED | `tsc --noEmit` could not resolve type definition packages (`d3-*`, `estree`, `json-schema`, `json5`, `node`, `react`, `react-dom`) after `npm ci` timed out |
| Production build | BLOCKED | npm dependency installation timed out; no full frontend build claim is made |
| Playwright browser tests | NOT RUN | Updated E2E tests are included but could not be executed because dependency installation timed out and no complete browser-capable app run was available |

## Existing limitations

- The Python evaluation fixtures remain authored synthetic scenarios. They do not establish real-world performance or causal identification.
- No independent external scientific review or field validation has occurred.
- The browser-to-API-to-Python path should be re-tested in a dependency-enabled environment after `npm ci` completes.

## Recommended commands in a dependency-enabled environment

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm run test:e2e
python -m unittest discover -s engine -p "test_*.py" -v
python engine/evaluate.py
python engine/run_holdout_validation.py
```

The new browser tests are in `tests/e2e/pathway.spec.ts` and `tests/e2e/workflows.spec.ts`.
