# Step 14 verification report — Risk & Control Register

## Scope

This report covers the Step 14 source additions and the checks that were actually run in the current authoring environment. It is not a claim that the Next.js application was fully built or that the browser regression suite ran.

## PASS — executed

| Check | Result | Evidence |
|---|---|---|
| Python diagnostic engine tests | 79/79 passed | `python -m unittest discover -s engine -p 'test_*.py' -v` |
| Research dataset-adapter tests | 12/12 passed | `python -m unittest discover -s research/datasets -p 'test_*.py' -v` |
| Synthetic controlled evaluation | 15 scenarios completed | `engine/evaluate.py` reproduced expected-decision fixture accuracy 100.0%, attribution coverage 20.0%, correct abstention on should-abstain cases 100.0%, unsupported attribution on should-abstain cases 0.0% |
| Synthetic development holdout | 16/16 expected decisions matched | `engine/run_holdout_validation.py`; unsupported attribution in should-abstain cases 0/13 |
| TypeScript/TSX syntax parsing | 30 files parsed, zero syntax errors | `node scripts/check-typescript-syntax.cjs` |
| Source ZIP | Integrity passed | Final archive `testzip()` check |

The Python and synthetic results are unchanged from the prior step because the risk/control register does not modify diagnostic decision rules. All scenario figures describe developer-authored synthetic test conformance, not real-world diagnostic accuracy.

## BLOCKED — not verified here

| Check | Reason |
|---|---|
| `npm ci` | Timed out while accessing the npm registry in this authoring environment. A partial `node_modules` tree was left behind and is removed from the release archive. |
| TypeScript typecheck | Blocked because the incomplete dependency tree lacks required type packages. Syntax parsing is not typechecking. |
| ESLint | Not run successfully because dependencies are incomplete. |
| Next.js production build | Not run successfully because dependencies are incomplete. |
| Playwright browser tests | The test file `tests/e2e/risk-control-register.spec.ts` is included, but browser execution is blocked by the dependency installation problem. |
| Live Supabase/PostgreSQL tests | No disposable test database or credentials were available; no live database was modified. |

## Step 14 functional design included in source

- Record hazards separately from diagnostic hypotheses.
- Qualitative severity/likelihood screening, explicitly not a validated health-risk score.
- Separate control lifecycle states: proposed, documented, implemented-unverified, effectiveness reviewed, ineffective, and unknown.
- Evidence references and links to current evidence records.
- SHA-256 snapshots of selected evidence records for stale-review detection.
- Separate ActionLoop task linkage.
- Administrative risk-review closure requirements and local history.
- Investigation-scoped localStorage records and separate JSON export.

These capabilities have been inspected in source, but they should not be called fully verified until the frontend build and browser tests pass.

## Scientific and operational limitations

- Risk/control data and event history remain browser-local and are not authenticated or server-side.
- Actor, owner, and reviewer labels are self-entered; the workflow's different-name check is not identity verification.
- The qualitative matrix is an unvalidated screening aid and must not replace an adopted local water-safety risk method.
- A hash can detect changed bytes relative to a stored digest; it does not authenticate the source document or certify water safety.
- No independent expert review or field validation is claimed.
