# WaterChain Step 11 — Bug Fix Summary (verification pass)

This document covers what the independent verification pass did to
the supplied `WaterChain_Step11_Fixed.zip`. It is split into two
parts: (A) the three supplied Step 11 fixes, which were verified
and NOT changed — the app code for them was correct; and (B) the
defects found during this pass, all in tests or in one UI label,
with their fixes and re-runs. No diagnostic decision rule was
changed anywhere in this pass, and no validation was weakened.

## A. Supplied Step 11 fixes — verified, unchanged

### A1. Eligible but off-pathway results

Supplied change (in `app/page.tsx`, `components/diagnostics/`,
styles): stage summaries count and prioritise only entries with
`on_pathway: true`; other eligible results read `Eligible positive
— not linked to selected pathway` / `Eligible negative — off
selected pathway` / `Eligible record — off selected pathway`;
pathway counts read `On pathway: <pathway_eligible_by_stage>`; the
stage detail joins engine eligibility by immutable internal record
id instead of by user-visible record code.

Verification: browser tests A1–A5 plus direct API calls (see
TEST_REPORT.md section 3A). Result: **correct as supplied**.
One consequence to understand (engine rule, not a bug): because
a pathway requires one batch linking all four stages, a case
with no such batch shows every stage's eligible records as
off-pathway. The supplied fix implements exactly that rule.

### A2. Stale report conclusion remains visible

Supplied change (in `DiagnosticWorkbench.tsx`): when a report is
stale, only the alert and a collapsed `View previous report`
disclosure render; the whole current-result block (conclusion,
metrics, hypotheses, eligibility table, export) is hidden until a
fresh review completes. Export of the old report as current is
therefore impossible, not merely disabled.

Verification: browser tests B1–B2 (TEST_REPORT.md section 3B),
including reload, investigation switching, and rapid-edit /
rapid-rerun races. Result: **correct as supplied**.

### A3. Manual record-code uniqueness

Supplied change (in `lib/evidence.ts` and
`components/evidence/EvidenceRegister.tsx`):
`generateUniqueRecordCode` builds `EV-<timestamp>-<token>` from a
UUID fragment and checks it case-insensitively against the current
investigation's codes, retrying up to 20 times before throwing;
the manual save path re-checks defensively before writing; the
internal id stays a UUID and is now the eligibility join key.

Verification: browser tests C1–C3 plus direct execution of the
shipped function (format, collision retry, bounded throw after
exactly 20 attempts, 200 same-second generations unique).
Result: **correct as supplied**.

## B. Defects found in this pass — fixed, with regression tests

### B1. Supplied pathway tests still expected the old "eligible = pathway" labels (test bug, not app bug)

Severity: medium (test suite red for the wrong reason; the app
was right). In `tests/e2e/pathway.spec.ts`, the blocked-positive
and incomplete-evidence tests expected `Eligible negative
observed` for stages that, under the Step 11 rule, have no
selected pathway and must read `Eligible negative — off selected
pathway`. The lineage test expected the substring `does not
contribute to pathway hypotheses`, while the app (correctly)
says `does not contribute to a cross-stage pathway hypothesis`.

Fix: updated the three expectations to the Step 11 wording, with
comments explaining the rule. No app code changed for these.

### B2. Supplied stale test expected a disabled export button that no longer exists (test bug, not app bug)

Severity: medium. `tests/e2e/workflows.spec.ts` asserted
`.review-bundle-export button:disabled` count >= 1 while stale.
Under the Step 11 design the whole export block is hidden while
stale, so the count is 0 even though the protected behaviour
(no export of the old report as current) holds.

Fix: the test now asserts `.review-bundle-export` count 0 while
stale and no enabled export button. The brief's requirement is
satisfied by absence, which is stronger than a disabled button.

### B3. Two same-named "Add evidence" buttons; the first one only scrolls (UI ambiguity + test-helper flaw)

Severity: low (UX friction; test failures on empty cases). The
inspector empty state carried a button labelled `Add evidence`
whose action only scrolls to the register, while the register's
own `Add evidence` button opens the entry modal. A test helper
clicking the first match therefore opened nothing on empty
investigations (the supplied distinct-codes test and this pass's
C1 test both timed out on `#sample-code` there; cases with
existing records were unaffected because the inspector button
disappears once records exist).

Fix (app): the inspector button is now labelled
`Go to evidence register`, which describes what it does.
Fix (test): `addManualRecord` in `tests/e2e/helpers.ts` now
clicks the button scoped inside `#evidence-register`, so it
cannot pick up the inspector button again.
Regression tests: supplied distinct-codes test and audit C1
(8 rapid manual adds on an empty case) both pass in the final
full run.

### B4. Import helper hung on rejected imports (test bug, not app bug)

Severity: low. `importCsv` in `tests/e2e/helpers.ts` always
clicked the modal Import button, but for preview-rejected imports
(duplicates, unknown columns) that button is correctly disabled,
so the helper timed out after 90 s.

Fix: new `importCsvRejected` helper (select file, assert the
preview error, no Import click) plus `closeCsvModal`, used by
audit tests C2, C3, D1. The app's rejection behaviour itself was
verified correct in the same tests.

### B5. Audit-test expectation errors found by re-running (test bugs, not app bugs)

Severity: low. Three expectations in the new audit spec were
wrong on first writing and were corrected after reading the
actual app output: (a) the A1 detail-status substring (same
wording issue as B1); (b) A1's source-stage count, which is
`On pathway: 0 of 1` — not 1 of 1 — because no batch links all
four stages (the B1 rule, applied uniformly); (c) D1 assumed the
lab name appears in collapsed rows, while it lives in the
expanded row detail (`METHOD / LAB`) together with notes — the
test now expands the row first. No app code changed for any of
these.

### B6. Lint error introduced by a new audit helper (fixed)

Severity: trivial. An explicit `any` in `activeRecords`
(`step11-audit.spec.ts`) failed ESLint. Replaced with a typed
localStorage-store shape. Final lint: 0 errors, 1 pre-existing
warning.

## C. Deliberately NOT changed

- No Python diagnostic decision rule, gate, threshold, or
  finding was touched. Evaluation and holdout baselines are
  byte-identical to Step 10.
- No validation rule was loosened to make a test pass. Every
  failing expectation was traced to either the documented Step 11
  behaviour change or a test-helper flaw, and the fix landed on
  the test (or the one label) side.
- `package.json` and `package-lock.json` are byte-identical to
  the supplied ZIP. No dependency was added, removed, or bumped.
- The supplied `STEP11_FIXES.md` and `STEP11_VERIFICATION.md`
  are kept as-is (the latter honestly records its own BLOCKED /
  NOT RUN items, which this pass resolves: typecheck, build,
  and browser tests all execute here).

## D. What changed in this package vs the supplied ZIP

- `app/page.tsx`: one button label (`Add evidence` →
  `Go to evidence register`, inspector empty state only).
- `tests/e2e/helpers.ts`: scoped manual-entry click; new
  `importCsvRejected` + `closeCsvModal` helpers.
- `tests/e2e/pathway.spec.ts`: three corrected expectations (B1).
- `tests/e2e/workflows.spec.ts`: stale-export assertion (B2).
- `tests/e2e/step11-audit.spec.ts` (new), `tests/e2e/fixtures/audit-*.csv`
  (new), `tests/e2e/step11-screenshots.spec.ts` (new),
  `tests/screenshots/` (10 files: 8 regenerated + 2 new),
  `tests/README.md` (suite list + port 3107).
- Docs: `TEST_REPORT.md` (this pass), `BROWSER_TEST_REPORT.md`,
  `READINESS_ASSESSMENT.md`, `BUG_FIX_SUMMARY_STEP11.md` (this
  file), `STARTUP_GUIDE.md` (Step 11 notes), regenerated
  `validation/reproducibility_manifest.json` (52 tests, 44 files
  hashed, 0 missing).
