# WaterChain Step 16 — Bug-Fix Summary (independent verification pass)

Supplied archive: `WaterChain_Step16_Decision_Sensitivity.zip`
(md5 `6634f5a3b9511c5f22830ccc0be6e7f0`). Every defect below was
reproduced before fixing and re-tested after. No diagnostic decision
rule was changed, no validation was weakened, and no abstention
behaviour was altered to make a test pass. Severity reflects user
impact, not fix size.

## D1 — High: supplied tree failed typecheck (and therefore build)

- **Original behaviour:** `npx tsc --noEmit` exited 2:
  `app/page.tsx(146,290): error TS2304: Cannot find name 'RefreshCw'.`
  The new guided-next-action card uses the `RefreshCw` lucide icon for
  its "Refresh the diagnostic review" state without importing it, so
  `npm run build` also failed. The supplied package was not shippable
  as delivered.
- **Fix:** added `RefreshCw` to the `lucide-react` import in
  `app/page.tsx`. One-line import fix; no behaviour change.
- **Regression evidence:** typecheck PASS (exit 0), `npm run build`
  PASS, production server serves `/` (HTTP 200).

## D2 — Cosmetic: dead imports and unused locals (lint warnings 9 → 2)

- **Original behaviour:** `npx eslint .` reported 9 warnings, all
  `@typescript-eslint/no-unused-vars`: `ChangeEvent`,
  `actionLoopItemSchema`, `transitionItem` in
  `components/actions/ActionLoop.tsx`; `ArrowRight` in
  `components/risks/RiskControlRegister.tsx`; `Link2`, `RefreshCw`,
  `sampleCounts` in
  `components/temporal/TemporalEvidenceWorkbench.tsx`.
- **Fix:** removed the unused imports/locals. The two remaining
  warnings are `react-hooks/exhaustive-deps` heuristics that are
  intentionally not "fixed" (documented below).
- **Regression evidence:** typecheck PASS, lint 0 errors + 2 warnings,
  build PASS. The remaining warnings:
  - `app/page.tsx:141` — `evidenceRecords` (`activeWorkspace?.records
    ?? []`) used in a `useMemo`; wrapping it in its own `useMemo`
    changes nothing functionally.
  - `TemporalEvidenceWorkbench.tsx:61` — the scope-reset effect depends
    on `journeyModel?.journey.id` and `workspaceId` deliberately; adding
    the whole `journeyModel` object would reset the user's scope choice
    on every parent re-render.

## D3 — Minor: duplicate sensitivity runs possible via rapid double-click

- **Original behaviour:** `runStressTest` in
  `DecisionRobustnessStudio.tsx` guarded only on the `running` state.
  Two clicks inside one React render frame both read the stale `false`
  value and start duplicate scenario runs (duplicate API load;
  last-write-wins on results).
- **Fix:** added a `runningRef` ref guard set synchronously at the
  start of `runStressTest` and cleared in `finally`, alongside the
  existing state guard and disabled button.
- **Regression evidence:** typecheck/lint/build PASS;
  `decision-robustness.spec.ts` 3/3 PASS.

## D4 — Minor: sensitivity exports could not be re-verified; tampering undetectable

- **Original behaviour:** the JSON sensitivity export bound scenarios
  to `evidenceSnapshotSha256`, but the app offered no way to verify an
  export — a tampered or out-of-date file could not be checked, and
  edits to scenario conclusions after export were undetectable.
- **Fix:** the export now also carries `contentSha256` (SHA-256 over
  the canonical scenario payload), and the studio has a "Verify an
  exported sensitivity report" control that (1) checks the schema tag,
  (2) recomputes the content fingerprint from the scenarios inside the
  file and reports "altered after export" on mismatch, and
  (3) recomputes the evidence-snapshot fingerprint from the currently
  loaded records/journey and reports current vs. not-current. Exports
  predating the content fingerprint verify for snapshot currency with
  an explicit caveat that content edits cannot be detected for them.
- **Regression evidence:** new Playwright test
  (`decision-robustness.spec.ts`): genuine export → "Verified:";
  conclusion-tampered export → "altered after export". **PASS**.
  Export still excludes raw evidence rows (asserted
  `evidenceRecords` absent).

## D5 — High: every ActionLoop status transition was rejected (inverted validator)

- **Original behaviour:** `nonempty()` in `lib/action-loop.ts`
  returned the *normalized value* when the input was non-empty and the
  error message when empty — the exact inverse of the contract all 14
  call sites assume (`const x = nonempty(v, label); if (x) return
  { ok: false, error: x };`). Consequence: **every** transition
  (`start`, `submit_for_verification`, `verify`, `return_for_work`,
  `cancel`, `reopen`, `reassign`, `edit`) failed whenever a valid actor
  name was supplied, with the form error displaying the actor's own
  name (e.g. submitting "Start work" as "Assigned owner" produced the
  error "Assigned owner"). ActionLoop was functionally read-only for
  status changes; creation worked (it uses separate inline
  validation). Reproduced in a live browser before the fix.
- **Impact:** the entire Step 13 follow-through workflow — the
  headline Step 13 feature — could not progress any action past
  "Open". The supplied Step 13/14 Playwright specs were never executed
  by the supplier (their verification was blocked on `npm ci`), so
  this was never caught upstream.
- **Fix:** corrected `nonempty` to return `null` when the value is
  non-empty and `` `${label} is required.` `` when empty. One-line
  logic fix; all 14 call sites now behave as written. No transition
  rule, guardrail, or required-field set was changed — verification
  still requires evidence references, a note, and a reviewer different
  from the owner.
- **Regression evidence:** `tests/e2e/action-loop.spec.ts` 3/3 PASS in
  real Chromium (lifecycle incl. self-verification guard, transitions
  incl. cancel/reopen, stale-source marking), plus the previously
  passing specs still pass. Engine suites unaffected.

## D6 — Test-side: eight stale assertions in the supplied Step 13/14 specs (no app behaviour changed)

The supplied `action-loop.spec.ts` and `risk-control-register.spec.ts`
were written against earlier UI text and never executed. Each fix below
aligns the test with the app's actual, deliberate wording or behaviour;
no guardrail was weakened:

1. `risk-control-register.spec.ts:27` — expected the priority chip to
   read `High`; the app deliberately renders `Screening priority:
   high` (the documented honest label for the unvalidated screening
   aid). Test now asserts the actual text.
2. `risk-control-register.spec.ts:111` — expected `…must have an
   effectiveness review`; the app says `…must have a current,
   evidence-backed effectiveness review before closing this
   administrative review` (the same spec's later test already expected
   the longer wording). Test now asserts the actual text.
3. `risk-control-register.spec.ts:89` — expected `Effectiveness
   verified`; the control was verified with external text references
   only, so the app honestly renders `Effectiveness review recorded ·
   external reference` (the spec's own line 62 already expects this
   wording for that case). Test now asserts the actual text.
4. `risk-control-register.spec.ts:207,212` — `getByText('Isolation-only
   hazard')` resolved to 2 elements after the event-history feature
   was added ("Risk / hazard recorded: …"); scoped to
   `getByRole('heading', …)`.
5. `risk-control-register.spec.ts:119` — the "Controls & history"
   toggle reads "Hide details" when the card is already expanded (new
   risk cards auto-expand on creation); the test now tolerates both
   labels and ensures the details section is open.
6. `action-loop.spec.ts:50,53,66` — verified actions leave the default
   "Active actions" filter; the test now selects "All actions" before
   asserting the verified card (also after reload and after switching
   investigations back).
7. `action-loop.spec.ts:126` — same filter handling for the cancelled
   action.
8. `action-loop.spec.ts:52,59,131,138` — `getByText('Verified &
   closed' / 'Cancelled' / 'Reopened', { exact: true })` matched both
   the status chip and the history-event label; scoped to
   `.action-status-chip`.

**Regression evidence:** `action-loop.spec.ts` 3/3 PASS,
`risk-control-register.spec.ts` 4/4 PASS in real Chromium against the
production build.

## Not changed

- No Python diagnostic rule, evidence schema, API contract, evaluation
  fixture, or abstention threshold was modified. Engine 83/83, adapter
  12/12, synthetic evaluation 100.0% / 20.0% / 100.0% / 0.0%, holdout
  16/16 and 0/13 — all identical to the supplied tree's own figures.
- The two remaining lint warnings are documented in D2 and left
  intentionally.
