# Step 18 bug-fix summary

All defects below were reproduced before fixing and re-verified after. No
diagnostic rule was weakened to improve a score. The supplied Step 17 tree
failed `tsc --noEmit` and `eslint` as shipped (the Step 17 verification report
honestly recorded that these checks were BLOCKED in its environment); this
pass is the first actual execution of the full toolchain on this tree.

## D1 (HIGH) — supplied tree failed typecheck

`npx tsc --noEmit` exited 1 with 4 errors, all in the new Step 17 blind-review
code:
- `components/validation/IndependentReviewWorkbench.tsx(286,22)`: `ReviewerSession`
  used but not imported. Fix: added `type ReviewerSession` to the existing
  import from `@/lib/independent-review` (it is exported there).
- `tests/e2e/independent-validation.spec.ts`: `const cleanCase` declared twice
  (a Playwright Locator and a packet-case lookup), shadowing caused a further
  type error. Fix: renamed the packet-case lookups to `blockedPacketCase` /
  `cleanPacketCase` (test-side only; no app behavior change).

Verification: `npx tsc --noEmit` exit 0 after the fix.

## D2 (HIGH) — lint failed as shipped

`npm run lint` reported 10 errors:
- 4 `react/no-unescaped-entities` in `IndependentReviewWorkbench.tsx`
  (apostrophes in JSX text). Fix: `&rsquo;` per project precedent.
- 6 `@typescript-eslint/no-require-imports` in
  `tests/unit/independent-review.test.cjs`, a CommonJS test executed with
  `node --test` where `require()` is correct. Fix: added `tests/**/*.cjs` to
  `globalIgnores` in `eslint.config.mjs` (same precedent as the existing
  `scripts/**/*.cjs` entry).
- 1 warning: unused `FIXTURES` import in `independent-validation.spec.ts`.
  Fix: removed the import (test-side only).

Verification: lint 0 errors + 2 pre-existing documented warnings
(`react-hooks/exhaustive-deps` in `app/page.tsx:142` and
`TemporalEvidenceWorkbench.tsx:61`; both intentional and documented, unchanged).

## D3 (minor, engine) — source-identity conflicts produced no guided action

The Step 18 comparative evaluation (`engine/step18_compare.py`) surfaced that
in legacy batch mode a `source_identity_conflict` finding produced only the
generic `paired-follow-up` action, while explicit-journey mode already emitted
a specific `reconcile-source-id` action. The engine correctly abstained in
both modes; only the follow-up guidance differed.

Fix (`engine/diagnose.py`, `build_next_actions`): emit `reconcile-source-id`
for the legacy `source_identity_conflict` finding as well, guarded against
duplication with the explicit-mode action. Wording mirrors the existing
action ("never normalize different sources into one ID for convenience").
No decision rule, gate, or abstention behavior changed.

Regression test: `engine/test_step18_compare.py::test_source_identity_conflict_produces_reconcile_action`.

## D4 (minor, evaluation harness) — duplicate `baseline` key in comparison report

`engine/step18_compare.py::compare()` set the `report["baseline"]` key twice:
first to the baseline description string, then to the metrics dict, silently
discarding the description. Found while adding the harness regression test.

Fix: renamed the description key to `baseline_description`. The harness also
gained a documented API transport adaptation (`createdAt` added; non-finite
`numericValue` scenarios skipped in API mode because JSON cannot carry them —
the API intentionally rejects them).

## Test-side corrections (no app defect)

- Two authored expectations in `step18_compare.py` were corrected after
  execution: `cmp18-missing-timestamp` now expects `qc-method-review` (the
  engine correctly emits it for the excluded record), and
  `cmp18-unrelated-source` expects only `reconcile-source-id` (the
  `paired-follow-up` fallback fires only when no other action does). These
  were wrong expectations about planner output, not engine decision changes,
  and are disclosed per the comparison protocol.

## Net effect on suites

- Engine: 83 -> 91 (8 new `test_step18_compare` tests).
- All prior suites unchanged: adapter 12/12, Node independent-review 12/12,
  synthetic evaluation 100.0%/20.0%/100.0%/0.0%, holdout 16/16 with 0/13
  unsupported attributions.
