# WaterChain Step 10 — Bug-Fix Summary

Base: `WaterChain_Step9_Light_Refinement.zip` (Pass 2 light
theme). This step fixes evidence-status ambiguity; it does
not change the light-first design, the branding, or any
diagnostic decision rule.

## Bug 1 (the core Step 10 bug): pathway labelled results "Positive on file" without engine eligibility

**Before.** `app/page.tsx` computed stage signals from the
investigation's records plus the register's local reviews
(`reviewEvidence`): a `detected` record at a stage produced
"Positive on file" immediately — before any diagnostic
review had run, and even when the Python engine would
exclude that record. Worse, the register review and the
engine gate disagree by design: the register treats a
missing source/batch identity as a warning ("limited"),
while the engine's `_usable` gate excludes such a record
outright; a failed quality control, an unsupported
analyte, or a non-finite numeric value likewise exclude
the record in the engine but were invisible in the
pathway signal. A user or judge could therefore read an
unfit result as usable evidence, and could read a
register "No register flags" record as engine-eligible.

**Fix (no React duplication of engine rules).**
- `engine/diagnose.py` now exposes `record_eligibility`
  for every submitted record, computed from the engine's
  own `_usable` gate: `{record_code, record_id, stage,
  eligible, reason, result_kind, on_pathway}`.
  `result_kind` is `positive` (`detected`, or quantified
  > 0), `negative` (`not_detected`), or `neither`
  (quantified zero, `not_tested`, `invalid`, unreportable).
  `on_pathway` additionally requires membership in the
  single selected batch pathway, so an eligible
  off-lineage record is still an observation but does not
  feed pathway hypotheses. No decision rule changed:
  the gate, attribution logic, hypotheses, conclusions,
  and findings are byte-for-byte the old logic; the
  report only carries one new field.
- `lib/diagnostics.ts` adds `recordEligibilitySchema`
  and an optional `record_eligibility` field on the
  report schema. Optional (not required) so saved Pass 2
  reports still validate; the frontend treats a missing
  field as "eligibility unresolved", never as eligible.
- `DiagnosticWorkbench` shares the current report with
  the pathway via an `onReportChange(report, stale)`
  callback, and renders a "Record eligibility (engine)"
  table (record, stage, result, eligible / excluded-with-
  reason / off-pathway note). A stale report's table is
  explicitly labelled as describing the previous evidence
  set.
- `app/page.tsx` derives every stage signal from the
  **current, non-stale** engine report only, using this
  order: no records → `Unassessed`; no current report
  (not run, stale, or pre-Step-10 saved report) →
  `Eligibility unresolved`; discordant results at the
  stage → `Evidence limited` (conflicting); eligible
  positive → `Eligible positive observed`; eligible
  negative → `Eligible negative observed`; only excluded
  records → `Result excluded` + the engine's reason;
  otherwise → `Evidence limited` (no reportable result).
  Each node also shows "Eligible: X of N" from the
  report's `eligible_by_stage` counts when a current
  report exists, and "Eligible: —" otherwise.
- Clicking a stage now opens a detail panel listing
  that stage's records with **both** checks side by
  side (register check vs engine eligibility), the
  findings affecting the stage, and buttons to the
  register and to the diagnostic review. The pathway
  legend now lists all six states, and the pathway
  header shows the engine-review status (not run /
  stale / current) so an old report is never silently
  presented as current.

**Verified by.** 12 new Python tests in
`engine/test_record_eligibility.py` (failed blank
control, missing method/batch/timestamp/source,
unsupported analyte, non-finite/boolean/string numeric
values, clean eligible positive, eligible negative with
a no-absence-proof conclusion, empty evidence,
conflicting records, lineage failure as case-level not
record-level, quantified zero, eligibility-count
consistency, unknown stage) plus 17 Playwright tests
(blocked positive, clean positive, valid negative,
incomplete, conflicting, lineage, unresolved-before-
review, stale fallback). See `TEST_REPORT_STEP10.md`.

## Bug 2: register wording could be read as engine eligibility

**Before.** "No register flags" and the inspector's
"Blocked/Limited" counts were the only status language
next to the pathway, so they invited an engine reading.

**Fix.** The register's own scope note is kept
("Register flags are a record-level metadata screen,
not diagnostic eligibility…"), the inspector note now
reads "Register checks only. Diagnostic eligibility
comes from the engine review — see the pathway and
workbench.", and the workbench eligibility table plus
the stage detail panel show the register check and the
engine verdict as two separate columns. No register
wording was renamed, so existing documentation and
screenshots of the register remain accurate.

## Bug 3: an old report's states could linger after evidence changed

**Before.** The pathway had no notion of report
staleness; only the workbench showed a stale banner
(and disabled bundle export).

**Fix.** Staleness is now shared with the pathway
through the same callback: when evidence changes, the
pathway falls back to `Eligibility unresolved` for
every assessed stage and the pathway header says the
review is stale. Bundle export remains disabled while
stale (unchanged behaviour, re-verified). The Playwright
stale test asserts the full round-trip: current states
→ add a record → unresolved + stale banner + export
disabled → re-run → new current states (discordant
→ `Evidence limited`).

## Bug 4: verification gap — no Playwright tests or screenshots in the ZIP, `npm ci` conflict

**Before.** Prior reviews ran browser checks from
scripts outside the delivered project, and the ZIP
contained no test files or screenshots. Separately,
pinning Playwright 1.49.1 conflicted with Next 15.5's
`peerOptional @playwright/test ^1.51.1`, so a plain
`npm ci` in a clean directory failed dependency
resolution.

**Fix.** `@playwright/test@1.55.0` (satisfies the peer
range) is now a devDependency; plain `npm ci` was
verified in a clean directory (387 packages). The
project now ships `playwright.config.ts`,
`tests/e2e/` (pathway, workflows, screenshots specs +
helpers + fixtures), `tests/screenshots/` (8 shots of
the actual running app), and `tests/README.md` with
the exact commands. The config reuses an existing
production server on port 3106 or starts one itself.

## Bug 5 (test bug, not an app bug): stale-report test read the old result

**Before (first Playwright run).** The shared
`runDiagnostic` helper waited only for
`.diagnostic-result` to exist, so on a re-run it
returned the still-visible stale report and the stale
test failed its "has not permitted" assertion.

**Fix.** The helper now waits for a fresh result: no
"Evaluating…" text, no stale banner, and a result
block present. The stale test then passed, and the
full suite was re-run with the fixed helper. This is
recorded here rather than hidden, because the first
run's 16/17 is the honest history of the suite.

## Deliberately NOT changed

- Engine gates, attribution rules, hypothesis logic,
  conclusions, findings, and limitations: unchanged.
  Evaluation and holdout baselines are identical to
  Pass 2 (evaluation 100% / 20.0% / 100% / 0%;
  holdout 100% conformance, 0/13 unsupported).
- Record schema, API request/response contract shape
  (one optional additive field only), storage keys,
  cache/fingerprint logic, CSV rules, backup/restore
  rules, abstention behaviour, and the light theme.
- No confidence score was invented: eligibility,
  completeness, and causal certainty stay separate
  (eligible flag, record counts, and the engine's
  candidate-transition-only conclusion).
- No synthetic records were added to the production
  register; every browser case is a QA fixture in an
  isolated Playwright context.
