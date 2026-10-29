# Step 13 release audit — ActionLoop MVP

## Delivered changes

- Added an investigation-scoped ActionLoop register.
- Created actions from current diagnostic findings, planner recommendations, the engine's next-step recommendation, or a manual follow-up.
- Added owner/creator labels, priority, optional due date, intended outcome, and linked evidence snapshots.
- Added lifecycle transitions for start, submit for verification, verify/close, return for work, cancel, reopen, reassign, and edit.
- Required completion and verification notes plus at least one evidence reference or linked evidence record.
- Prevented a self-entered reviewer name from matching the assigned owner label.
- Added source review snapshot fingerprints, stale-source indications, action history, overdue sorting, filters, and JSON action-log export.
- Added three Playwright regression tests for lifecycle, persistence/isolation, transition reasons, and staleness.
- Tightened due-date validation and clears stale completion/verification fields when an action is returned for work or reopened; history retains the event trail.

## Checks run in this environment

| Check | Status | Evidence |
|---|---|---|
| Python diagnostic engine suite | PASS | 79 tests passed using `python -m unittest discover -s engine -p 'test_*.py' -v` |
| Research-data adapter suite | PASS | 12 tests passed using `python -m unittest discover -s research/datasets -p 'test_*.py' -v` |
| Synthetic controlled evaluation | PASS | `python engine/evaluate.py`; 15 synthetic fixtures reproduced; 100% expected-decision conformance; 20.0% attribution coverage; 100% appropriate abstention on should-abstain cases; 0% unsupported attribution among those cases |
| Synthetic holdout evaluation | PASS | `python engine/run_holdout_validation.py`; 16/16 expected decisions; 0/13 unsupported attributions among cases expected to abstain |
| TypeScript/TSX syntax parsing | PASS | `node scripts/check-typescript-syntax.cjs`; 27 files parsed, zero syntax errors |
| Reproducibility manifest | PASS | `python engine/build_reproducibility_manifest.py`; all five included checks passed; 77 source/document files hashed; zero missing files |
| Dependency installation | BLOCKED | `npm ci --no-audit --no-fund` timed out while resolving dependencies in this environment. The partial `node_modules` tree is not included in the release ZIP. |
| TypeScript typecheck | BLOCKED | `npm run typecheck` was attempted; the incomplete dependency tree lacks TypeScript definition packages such as `@types/node`, `@types/react`, and several transitive type packages. This does not constitute a successful typecheck and does not establish that a code type error exists. |
| ESLint | BLOCKED | Not run reliably because the complete locked dependency installation is unavailable. |
| Next.js production build | BLOCKED | Not completed in this environment because dependencies could not be installed. |
| Playwright browser tests | BLOCKED | `tests/e2e/action-loop.spec.ts` contains three regression tests, but they were not executed in this environment because dependencies/browser installation are unavailable. |

## Interpretation and limitations

The Python tests and synthetic evaluations test software rules against controlled fixtures. They do not establish real-world diagnostic accuracy. The ActionLoop browser workflow requires a complete frontend installation and should be run with `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e` in a connected environment before the latest frontend changes are considered fully verified.

ActionLoop stores data in browser-local storage and exports separately from the main evidence backup. Owner, creator, actor, and verifier labels are self-entered and unauthenticated. Its history is mutable and is not a secure server-side audit authority. Completion or “Verified & closed” indicates workflow state, not laboratory authenticity, remediation success, water safety, or causal confirmation.

No diagnostic decision rule was changed by Step 13. The release keeps the current Step 12 scientific foundation and adds the workflow layer.
