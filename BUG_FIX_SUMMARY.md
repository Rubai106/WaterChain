# WaterChain Step 8 — Bug-Fix Summary

Every item below was reproduced before it was fixed, and re-tested
after the fix. "Original behaviour" is what the supplied ZIP did;
"Fixed behaviour" is what this corrected package does. No validation
rule was removed to make a test pass, and no abstention behaviour
was weakened — two fixes (F3, F5) strengthen abstention.

## F1 — Critical: production build failed, `autoprefixer` missing

- **Original issue:** `postcss.config.js` lists `autoprefixer` as a
  PostCSS plugin, but `package.json` does not declare it. `npm run
  build` failed in webpack with `Cannot find module 'autoprefixer'`.
  The app could not be built or started in production at all.
- **Impact:** any judge or user following the README's build steps
  hit a hard failure; the Step 8 package was not demonstrably
  runnable.
- **Fix:** added `"autoprefixer": "^10.4.20"` to `devDependencies`
  in `package.json` (and regenerated `package-lock.json`).
- **Regression evidence:** `npm run build` passes (routes `/` and
  `/api/diagnose` emitted); the production server then served the
  homepage (HTTP 200) and the API. No scientific behaviour changed.

## F2 — High: ESLint failed, flat-config import does not resolve

- **Original issue:** `eslint.config.mjs` imported
  `eslint-config-next/core-web-vitals` and `.../typescript` as
  flat-config arrays. Under the installed versions
  (eslint-config-next 15.5.28, ESLint 9.39.5, Node 24), the
  extensionless ESM import cannot resolve (there is no `exports`
  map), and even with a `.js` extension the files are legacy
  eslintrc objects (`module.exports = { extends: … }`), not
  iterable flat configs — so `npm run lint` failed, and `next
  build` printed an ESLint error during its lint step.
- **Impact:** the CI quality gate (`npm run lint`) could never
  pass; the configured lint rules were effectively unenforced.
- **Fix:** rewrote `eslint.config.mjs` to use `FlatCompat` from
  `@eslint/eslintrc` (`compat.extends('next/core-web-vitals',
  'next/typescript')`), and added `@eslint/eslintrc` as a direct
  devDependency instead of relying on a transitive copy. The
  intended rule sets are unchanged.
- **Regression evidence:** `npm run lint` exits 0 (0 errors,
  1 pre-existing `react-hooks/exhaustive-deps` warning on
  `app/page.tsx:127`, unrelated to this fix).

## F3 — High: engine missed duplicate internal record IDs

- **Original issue:** duplicate detection keyed only on the
  human-visible record code (`recordCode`, falling back to `id`
  only when no code existed). Two rows sharing the same internal
  `id` but different record codes were treated as distinct and
  could strengthen a stage count (audit case 22: a linked
  pathway went from 4 records to 5, source count 2, with
  `attribution_permitted: true`).
- **Impact:** a duplicated import that renumbered record codes
  could silently inflate evidence.
- **Fix (`engine/diagnose.py`):** duplicate detection now uses
  two separate maps — one for record codes, one for internal
  IDs — and reports each duplicated value once under the
  existing `duplicate_record_identifier` blocker code, which
  already blocks attribution.
- **Regression test:** `test_duplicate_internal_id_blocks_attribution`
  in `engine/test_diagnose.py` (same id, different code → flag
  false, finding present). A guard case (single record whose
  id equals its record code) was also checked by hand to confirm
  it is not falsely flagged.

## F4 — High: engine accepted non-finite / boolean quantified values (direct/CLI path)

- **Original issue:** `_usable()` checked `val < 0` but NaN is
  neither negative nor positive, infinity passes the same check,
  and Python booleans are `int` subclasses (`True` passed as 1).
  A quantified record with `numericValue: NaN` was therefore
  counted eligible by direct engine/CLI use. (The Next.js API
  path was already safe: Node's strict JSON parser rejects NaN
  tokens and zod requires finite numbers — verified live with a
  400 response.)
- **Impact:** low through the app, but the engine's contract
  ("quantitative result requires a real value") was not enforced
  at its own boundary, which matters for any future caller.
- **Fix:** `_usable()` now rejects any present numeric value
  that is a boolean, not an `int`/`float`, or not finite
  (`math.isfinite`), and requires a non-blank unit for
  quantified results.
- **Regression test:** `test_non_finite_or_boolean_quantified_value_is_excluded`
  (NaN, infinity, `True` → 0 eligible).

## F5 — High: `attribution_permitted` was true when no attribution was identified

- **Original issue:** the flag was true whenever the structural
  gates passed (unique batch, source, chronology, coverage, no
  duplicates/discordance/mixed analytes) — even when there was
  no positive at all, when the only positive was at the source
  (origin timing explicitly unresolved), or when earlier stages
  had no negative results (for example quantified zero, which is
  neither a positive nor a `not_detected` negative, so no
  transition interval is bracketed). The UI styles a report by
  this flag, so those cases rendered with the "permitted"
  treatment while their conclusions said the entry point was
  unresolved. The project's own evaluation code already defined
  an attribution as confidence `candidate transition only` **and**
  the flag, which is why its metrics were unaffected — the flag
  alone contradicted that definition.
- **Impact:** a downstream consumer reading only
  `attribution_permitted` (or a judge reading the UI treatment)
  could conclude an entry point had been attributed when the
  engine itself had not bracketed one.
- **Fix (`engine/diagnose.py`):** the flag is now true only when
  the structural gates pass **and** the earliest positive is at
  a non-source stage with negative results at every earlier
  stage — exactly the evaluation's prediction definition. A new
  warning finding, `transition_not_bracketed`, explains the
  unbracketed cases, and the conclusion order was adjusted so
  the specific source/unresolved conclusions survive (a generic
  "not permitted" conclusion is used only when a structural
  gate actually fails). A limitations entry documents the new
  meaning of the flag.
- **Regression tests:** `test_linked_all_negative_does_not_permit_attribution`,
  `test_source_positive_is_observation_not_attribution`,
  `test_unbracketed_positive_does_not_permit_attribution`.
- **Verification that nothing else moved:** Python suite 40/40,
  synthetic evaluation still 100% fixture accuracy / 20.0%
  attribution coverage / 100% correct abstention, holdout still
  16/16. The regenerated reports change the flag in exactly
  three should-abstain holdout cases
  (`holdout_no_positive`, `holdout_off_lineage_positive`,
  `holdout_source_positive_origin_unknown`) and two evaluation
  scenarios (`all_stages_negative`,
  `source_positive_origin_unresolved`); their predictions were
  already "no attribution" and remain so.

## F6 — High: review-bundle restore never verified its SHA-256 fingerprint

- **Original issue:** `app/page.tsx` checked a review bundle's
  schema and declared record count, but never recomputed
  `review.evidenceSha256`. Editing one record's sample code in
  an exported bundle (count unchanged) restored without any
  warning in the browser.
- **Impact:** a corrupted or quietly edited bundle could be
  presented as the exact snapshot of a reviewed report.
- **Fix:** restore now recomputes the fingerprint with Web
  Crypto (`SHA-256` over the schema-parsed records sorted by
  `recordCode`, `id`, then serialized record — the same
  canonicalisation as `app/api/diagnose/route.ts`) and rejects
  the bundle when it differs. If the browser cannot provide
  `crypto.subtle`, bundle restore is refused rather than
  silently unverified. Backups without a hash are unaffected.
- **Limitation (documented in code):** a SHA-256 hash detects a
  changed snapshot; it does not authenticate records — an
  editor who recomputes the hash would pass. Do not present it
  as a signature.
- **Regression evidence (browser):** genuine bundle restores
  (dialog offered, separate investigation created, no old
  report shown); tampered bundle rejected with a fingerprint
  notice and no workspace created; bundle SHA independently
  recomputed from exported records matched exactly.

## F7 — Low: malformed backup showed a raw parser error

- **Original issue:** a non-JSON file produced the notice
  "Expected property name or '}' in JSON at position 1…".
  Rejection worked, but the message was unusable.
- **Fix:** `SyntaxError` from `JSON.parse` now maps to "The
  selected file is not valid JSON. Choose a WaterChain
  investigation backup or review bundle." Other validation
  messages are unchanged.
- **Regression evidence:** browser test with a `{not json`
  file shows the friendly notice and creates no workspace.

## F8 — Low: cancelling the create dialog kept the typed name

- **Original issue:** Cancel (and backdrop/X close) hid the
  dialog without clearing `caseName`, so reopening it pre-filled
  the previous, possibly rejected, name.
- **Fix:** all three close paths for the create dialog now clear
  the name and any name error.
- **Regression evidence:** browser duplicate-name flow, then
  reopen, now shows an empty field with the create button
  disabled.

## F9 — Low: engine-timeout timer not cleared on the error path

- **Original issue:** in `app/api/diagnose/route.ts`,
  `finishError` killed the child and rejected but did not clear
  the 15 s timeout; the timer fired later as a no-op (guarded by
  the settled flag). No user-visible effect.
- **Fix:** `clearTimeout(timeout)` inside `finishError`.
- **Regression evidence:** typecheck, lint, build pass; live
  timeout behaviour re-verified (503 after ~15 s).

## F10 — Medium: unknown CSV quality-control values silently became `not_recorded`

- **Original issue:** `parseEvidenceCsv` mapped any QC value
  outside `pass`/`fail`/`not_recorded` to `not_recorded`. A row
  with `positive_control = maybe` imported as a seemingly valid
  record with undocumented QC.
- **Impact:** invalid input was silently converted into valid
  scientific evidence metadata — exactly what the brief forbids.
- **Fix (`lib/evidence-csv.ts`):** a non-blank QC value outside
  the allowed set is now a row error ("Unknown … value … Use
  pass, fail, or not_recorded"), like unknown stages/analytes/
  results. Blank QC still means `not_recorded`, as documented.
- **Regression evidence (browser):** the same mixed CSV that
  previewed 3 parsed / 2 skipped before the fix now previews
  2 parsed / 3 skipped, with the QC row listed among the
  skipped rows with its reason.

## What was deliberately NOT changed

- No validation rule was removed; no abstention was weakened;
  no synthetic results, probabilities, or performance claims
  were added. The four-stage model, eligibility gates, and
  Direction A Evidence Investigation Workbench design are
  untouched.
- The engine still treats a UI "Metadata clear" record as
  excludable when QC is merely undocumented — the engine is
  stricter than the register by design; see `TEST_REPORT.md`
  unresolved item 7.
- Unused `@xyflow/react`, the favicon 404, Google Fonts, and
  the one pre-existing ESLint warning were left alone as
  cosmetic/non-blocking.


---

# Step 11 verification-pass addendum (2026-10-28)

The three supplied Step 11 fixes (off-pathway labelling,
stale-conclusion hiding, unique manual record codes) were
independently verified in a real browser and needed no app
changes. The defects fixed in this pass were test-side errors
and one UI label ambiguity; see `BUG_FIX_SUMMARY_STEP11.md`
for the complete list (B1–B6), the evidence for each, and the
regression tests. No diagnostic decision rule was changed and
no validation was weakened. Final state: typecheck PASS, lint
PASS (0 errors, 1 pre-existing warning), build PASS, Python
52/52, evaluation and holdout baselines identical to Step 10,
Playwright 33/33.

---

# Step 12 verification-pass addendum (2026-10-28)

The supplied Step 12 archive introduced the explicit water-journey model, a
browser-local provenance vault, a hash-linked audit ledger, a next-action
planner, a Water Quality Uganda adapter, and a reference Supabase migration.
Its own verification report honestly left typecheck, lint, build, browser
tests, and real-dataset profiling unexecuted (npm install had timed out
there). This pass executed all of them and fixed nine items (D1–D9); see
`BUG_FIX_SUMMARY_STEP12.md` for the complete list with evidence:

- D1 (HIGH): typecheck/build failure — audit-trail caller type fixed.
- D2 (HIGH): lint/build failures — unescaped JSX entity fixed; Node `.cjs`
  script excluded from app linting; unused imports/parameter removed.
- D3 (minor, engine): duplicate transfer IDs now flagged as blockers.
- D4 (minor, engine): reversed, non-adjacent, and foreign-journey transfers
  now flagged as blockers instead of silently ignored.
- D5 (minor, UI): cross-journey record reuse now shows a visible warning.
- D6 (minor, UI): exported audit ledgers can now be re-verified in the app.
- D7 (minor, adapter): sample/visit date mismatches now reported.
- D8 (test-side): stale assertions in the supplied journey spec and the
  Step 11 A2 test corrected to the app's actual wording and row layout
  (record codes, not sample codes, in linked rows; "Household storage"
  stage name; blockers-panel phrasing; Step 12 card copy).
- D9 (minor, UI): transfer-form entity inputs no longer carry native
  HTML `required`, which had blocked submission before the app's own
  friendly validation errors could appear.

No diagnostic decision rule was weakened and no validation was relaxed.
Final state: typecheck PASS, lint PASS (0 errors, 1 pre-existing warning),
build PASS, Python engine 79/79 (was 75), adapter 12/12 (was 11), evaluation
and holdout baselines identical to Step 10/11, Playwright 45/45 across the
full run plus targeted re-runs (composed accounting in `TEST_REPORT.md`
§6), and the real Uganda dataset profiled (see `RESEARCH_DATA_AUDIT.md`).

---

# Step 16 verification-pass addendum (2026-10-29)

The supplied Step 16 archive added the Decision Sensitivity Studio
(single-record-omission analysis against the real `/api/diagnose`
endpoint), a guided next-action card, and light-theme contrast fixes.
Its own verification report honestly states that `npm ci` timed out in
the supplier's environment, so typecheck, lint, build, and all
Playwright tests were NOT executed there. This pass executed them and
found real defects. See `BUG_FIX_SUMMARY_STEP16.md` for the complete
list with evidence:

- D1 (HIGH): supplied tree failed typecheck — `app/page.tsx` used the
  `RefreshCw` icon without importing it. One-line import fix.
- D2 (cosmetic): removed 7 unused imports/locals; lint 9 → 2 warnings
  (0 errors). The 2 remaining warnings are intentional and documented.
- D3 (minor): double-click guard for the sensitivity runner
  (`runningRef` in addition to the state guard).
- D4 (minor): sensitivity exports now carry a `contentSha256`
  fingerprint and can be re-verified in the app; tampered exports are
  detected ("altered after export").
- D5 (HIGH): `nonempty()` in `lib/action-loop.ts` had inverted logic —
  every ActionLoop status transition was rejected whenever a valid
  actor name was supplied, so no action could leave "Open". One-line
  fix; no transition rule or guardrail changed.
- D6 (test-side): eight stale assertions in the supplied Step 13/14
  specs corrected to the app's actual wording/behaviour (priority-chip
  text, effectiveness-review wording, external-reference distinction,
  event-history duplicate text, auto-expanded card toggle, "Active
  actions" filter, status-chip scoping). No app behaviour weakened.

No diagnostic decision rule was weakened and no validation was relaxed.
Final state: `npm ci` PASS (387 packages), typecheck PASS, lint 0
errors + 2 documented warnings, build PASS, Python engine 83/83,
adapter 12/12, synthetic evaluation 100.0%/20.0%/100.0%/0.0% and
holdout 16/16 + 0/13 (identical to the supplied tree's figures),
Playwright full suite re-run (see `TEST_REPORT.md` §6 for the composed
accounting), reproducibility manifest PASS (103 files hashed,
0 missing), and the real Uganda dataset re-profiled on freshly
downloaded files (hashes identical to the Step 12 record).

## Step 18 addendum (2026-10-29)

The supplied Step 17 tree failed `tsc --noEmit` (exit 1, 4 errors) and
`npm run lint` (10 errors) as shipped — the Step 17 verification report
honestly recorded these as BLOCKED in its environment. This pass is the
first actual execution of the full toolchain on this tree. Full detail in
`BUG_FIX_SUMMARY_STEP18.md`.

- D1 (HIGH): typecheck errors in the new blind-review code — missing
  `ReviewerSession` type import in `IndependentReviewWorkbench.tsx`, and a
  doubly-declared `cleanCase` in `independent-validation.spec.ts` (renamed
  test-side). Typecheck now PASS.
- D2 (HIGH): lint errors — 4 unescaped JSX apostrophes (fixed with
  `&rsquo;`), 6 `no-require-imports` in the CommonJS Node test (fixed by
  adding `tests/**/*.cjs` to `globalIgnores`), 1 unused import (removed).
  Lint now 0 errors + 2 documented warnings.
- D3 (minor, engine): the Step 18 comparative evaluation surfaced that a
  legacy-mode `source_identity_conflict` produced only the generic
  `paired-follow-up` action; `build_next_actions` now also emits the specific
  `reconcile-source-id` action (duplication-guarded). No decision rule or
  abstention behavior changed. Regression test added.
- D4 (minor, harness): `step18_compare.py` overwrote the `baseline`
  description key with the metrics dict; renamed to `baseline_description`.
- Test-side corrections: two authored comparison expectations corrected
  (disclosed, not engine changes).

Final state: typecheck PASS, lint 0 errors, build PASS, engine 91/91
(+8 new Step 18 comparison tests), adapter 12/12, Node review tests 12/12,
evaluation 100.0%/20.0%/100.0%/0.0%, holdout 16/16 + 0/13, comparison
WaterChain 100% conformance / 0% unsupported attribution / 100% abstention /
100% invalid-evidence detection / 100% recommendation rubric (naive baseline
88.9% unsupported attribution), API parity confirmed on the real endpoint.

## Step 20 addendum (2026-10-29)

The Step 19 tree passed `npm ci`, typecheck, lint (0 errors), and production build on first fresh execution in this environment — the Step 19 BLOCKED frontend-verification item is closed. No shipped defects were found in the supplied tree; the changes below are improvements and hardening surfaced by the Step 20 audit, not bug fixes.

- N1 (improvement, UI): no human-readable case export existed — only the machine-readable JSON review bundle. Added `lib/case-report.ts` (pure Markdown case-report builder: conclusion, stage hypotheses, eligibility table with exclusion reasons, findings, lineage review, next actions, limitations, provenance, interpretation notice) and an "Export readable case report" button in `DiagnosticWorkbench.tsx`, disabled while the report is stale (same guard as the bundle export). The report references records by code; full records stay in the JSON bundle (stated in the document). No probabilities or causal claims; uncertainties travel with the conclusion.
- N2 (hardening, validation tooling): `validation/build_reviewer_handoff.py` now also scans the reviewer packet's *content* for forbidden tokens (`expected_decision`, `facilitator_key`, `answer_key`) in addition to the existing filename check. Verified the handoff builds cleanly.
- Process note: the invitation file shipped inside the reviewer handoff (`INVITATION.md`) must stay reviewer-facing — sender instructions live in the new `validation/REVIEWER_OUTREACH_CHECKLIST.md` instead (an earlier draft briefly mixed them; reverted before any send, and no reviewer has been contacted).
- New regression tests: `tests/e2e/case-report.spec.ts` (R1 export content, R2 stale-disable).

No diagnostic rule, gate, or abstention behavior was changed. No dependency was added, removed, or bumped.
