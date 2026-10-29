# WaterChain Step 18 — Independent Test Report

Supplied archive: `WaterChain_Step17_Blind_Review.zip`
(md5 `a4ac97817eeb45da2670aafc5c0b2cf4`), preserved untouched at
`~/workspace/waterchain-step18/original/`.
Working copy: the `waterchain-step17` project in this package
(version `0.6.0`).
Environment: Node v24.22.1, npm 10.9.4, Python 3.12.3, Ubuntu 24.04.5
LTS, Chromium via Playwright `@playwright/test@1.55.0`, production
server on port 3107 (`reuseExistingServer: true`).

The supplier's own `validation/STEP17_VERIFICATION.md` honestly states that
`npm ci` was BLOCKED in its environment (registry DNS failure), so
typecheck, lint, build, and Playwright execution were NOT run by the
supplier (their Python suites, synthetic evaluation, holdout, and Node
review tests were). This report executes everything. Nothing below is taken
from a prior report without re-execution.

Status words: **PASS** = executed and passed; **FAIL** = executed and
failed; **BLOCKED** = could not run, with the reason; **NOT TESTED** =
not attempted. Static inspection, unit tests, API probes, browser tests,
and real-data validation are distinguished throughout.

## 1. The 11 required answers

1. **Does dependency installation pass?** PASS — `npm ci` exit 0 with
   the supplied lockfile, 387 packages. `package.json`/`package-lock.json`
   byte-identical to the supplied ZIP (md5 `46fe1589…`/`bd73fa6b…` —
   recorded in §2).
2. **Does the typecheck, lint, and production build pass?** PASS after
   fixes — the supplied tree FAILED typecheck (exit 1, 4 errors, all in
   the new Step 17 blind-review code) and FAILED lint (10 errors). After
   fixes D1/D2: typecheck PASS, lint 0 errors + 2 pre-existing documented
   warnings, `npm run build` PASS (verified on the final tree).
3. **Does the real browser-to-API-to-Python workflow pass?** PASS —
   65/65 Playwright tests across 12 spec files against the production
   build (see §6), plus direct API probes (§4), plus the 13-scenario
   comparison executed through the real `/api/diagnose` endpoint with
   identical guardrail results (§5).
4. **Do the sensitivity scenarios produce the correct results?** PASS —
   `decision-robustness.spec.ts` 3/3; engine-level omission checks in
   `step18_compare.py` match expectations (pivotal omission changes the
   decision; redundant omission preserves it), also via the real API.
5. **Are selected records eligible and on the correct pathway?** PASS —
   eligibility comes from the engine's own `record_eligibility`
   (`pathway.spec.ts` 8/8, `step12-journey-model.spec.ts` 5/5).
6. **Does stale-report protection work during edits, reloads, and
   investigation switches?** PASS — `step11-audit.spec.ts` 14/14 (stale
   hiding, reload, rapid edits, investigation isolation).
7. **Can original evidence be changed by sensitivity analysis?** PASS —
   scenarios POST filtered copies; register verified unchanged
   (`decision-robustness.spec.ts`, comparison harness).
8. **Do the prior Step 12–17 features still work?** PASS after fixes —
   all module specs green: journeys, evidence validation, provenance,
   audit ledger, ActionLoop (3/3), Risk & Control Register (4/4),
   temporal planner (6/6), blind independent review (4/4 + 12/12 Node).
9. **Which defects were fixed?** D1–D4, reproduced before fixing, in
   `BUG_FIX_SUMMARY_STEP18.md`.
10. **What tests remain blocked?** Live Supabase migration tests
    (BLOCKED — no test database, no credentials used); screen reader,
    Windows/macOS browsers, Node 20 / Python 3.10 minima, remote CI
    (NOT TESTED).
11. **Is the application ready for a competition demo, supervised expert
    pilot, or operational deployment?** See §8.

## 2. Installation and static checks (all executed)

- `npm ci`: PASS (exit 0, 387 packages, supplied lockfile).
- `package.json` md5 `46fe15894b4a06c5cb1f5b03b1b0d0e0` (recorded);
  `package-lock.json` byte-identical to the supplied ZIP. No dependency
  added, removed, or bumped.
- Typecheck: FAIL as shipped (exit 1, 4 errors) → PASS after D1.
- Lint: FAIL as shipped (10 errors) → 0 errors + 2 pre-existing
  documented warnings after D2 (the warnings are intentional and
  unchanged: `app/page.tsx:142`, `TemporalEvidenceWorkbench.tsx:61`).
- Production build: PASS (`next build` exit 0 on the final tree; routes
  `/`, `/api/diagnose`, `/icon.svg` emitted).
- npm scripts that call bare `python` were executed with `python3`
  (identical commands); the API route already defaults to `python3`
  outside Windows. Scripts left unchanged.

## 3. Python engine, adapter, Node review tests, synthetic evaluations

- Engine unit tests: **91/91** (83 prior + 8 new `test_step18_compare`
  regression tests), exit 0.
- Research-data adapter tests: **12/12**, exit 0.
- Node independent-review tests (`npm run test:independent-review`):
  **12/12**, exit 0.
- Synthetic evaluation (`engine/evaluate.py`): 100.0% expected-decision
  fixture accuracy / 20.0% attribution coverage / 100.0% correct
  abstention / 0.0% unsupported attribution — identical to the supplied
  figures. The naive first-positive baseline on the same 15 fixtures:
  26.7% / 93.3% / 8.3% / 91.7%.
- Synthetic holdout (`engine/run_holdout_validation.py`): 16/16
  expected-decision conformance, 0/13 unsupported attributions.
- No engine decision rule was changed in this pass (one additive
  next-action branch, D3; documented).

## 4. API behaviour probes (executed against the production server)

- Valid linked pathway → 200, `attribution_permitted: true`,
  `confidence_label: "candidate transition only"`.
- Empty records → 200, `"not assessed"` / "No evidence records supplied.
  No pathway assessment is possible." (not an error).
- Schema-violating payload → 400 with requestId, generic message.
- Non-finite JSON (`NaN`) → 400; the engine's own NaN guard is covered
  in-process (record excluded: "Numeric value is not a finite number").
- Quantified positive with finite numeric value → 200, engine runs.
- Server logs contain no evidence strings from probe traffic (grep 0).
- Engine failure simulations from the Step 12/16 verification (missing
  Python, malformed output, 15 s timeout → generic 503, no evidence
  echoed) remain valid: the route and CLI are unchanged.

## 5. Step 18 comparative evaluation (executed)

Harness: `engine/step18_compare.py`; protocol:
`engine/COMPARATIVE_EVALUATION_PROTOCOL.md`; reports:
`engine/step18_comparison_report.{json,md}`. 13 developer-authored
adversarial fixtures (clean transitions, duplicate identifiers,
discordant repeats, omission variants, NaN numerics, missing timestamps,
unsupported analytes, unrelated source identities, failed QC,
all-positive, all-negative). Expected decisions fixed at authoring time;
two authored action-expectations corrected after execution (disclosed in
`BUG_FIX_SUMMARY_STEP18.md`); no diagnostic rule altered to fit fixtures.

Results, in-process and through the real `/api/diagnose` (12/12
JSON-carryable scenarios identical):

| Method | Fixture conformance | Unsupported attribution | Correct abstention | Attribution correctness |
| --- | --- | --- | --- | --- |
| WaterChain | 100.0% | 0.0% | 100.0% | 100.0% |
| Naive first-positive baseline | 38.5% | 88.9% | 11.1% | 100.0% |

- Invalid-evidence detection rate (engine eligibility gate): 100.0%.
- Recommendation-quality rubric (six fixed checks, WaterChain only):
  100.0% mean.
- Omission sensitivity: removing the pivotal positive changes the
  decision (serving → abstain); removing a redundant positive preserves
  it (storage → storage). Both match expectations.
- Interpretation: fixture conformance on developer-authored cases with
  known rules — not real-world accuracy. The blind reviewer packets are
  the independent instrument; external review is pending.

## 6. Browser E2E (Playwright, production build, real engine)

Twelve spec files, each run in its own invocation against the same
production server on port 3107 (built once from the final tree).
Isolated browser contexts per test; no synthetic fixtures seeded into
any shared register. **65/65 passed, 0 failures, 0 retries.**

| Spec | Tests | Result |
| --- | --- | --- |
| independent-validation (blind review workbench) | 4 | 4/4 |
| decision-robustness (Sensitivity Studio) | 3 | 3/3 |
| workflows | 9 | 9/9 |
| pathway | 8 | 8/8 |
| action-loop | 3 | 3/3 |
| risk-control-register | 4 | 4/4 |
| temporal-evidence | 6 | 6/6 |
| step11-audit | 14 | 14/14 |
| step12-audit | 7 | 7/7 |
| step12-journey-model | 5 | 5/5 |
| step11-screenshots | 1 | 1/1 |
| screenshots | 1 | 1/1 |

Honest accounting: the 65 tests were not executed in one single
`playwright test` run; they were executed as 12 sequential per-spec runs
against the same build and server. No spec required a second attempt.
The full single-run was avoided deliberately: this machine has ~1 GB
free RAM and the Step 16 audit documented server death under memory
pressure; sequential per-spec runs are the reproducible configuration
here. Screenshots were regenerated (tests/screenshots/).

## 7. Real research data (Water Quality Uganda)

- The four published CSVs were **re-downloaded 2026-10-29** from
  https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/
  (CC-BY; Nansiimbi C, Clavijo Daza A (2026)). SHA-256 hashes identical
  to the 2026-10-28 record — the published files are unchanged.
- Adapter CLI exit 0, `profile_complete`; inputs unmodified. Full profile:
  `research/real-data-profile.json` (regenerated); narrative:
  `research/REAL_DATA_QUALITY_STEP18.md`.
- Joins: 508 borehole-visit, 2,236 household-visit, 459 missing visit_id
  (3,203 total). `match_status`: matched 2,187; **ambiguous key 278 —
  refused, never auto-linked**; no field record 295; no lab result 443.
- 843 exact measured transport/storage pairs; 275 household visits
  unpaired/ambiguous; 0 duplicate IDs; 0 date mismatches.
- **Lab blanks: 9/134 positive (6.7%)** — flagged as a pilot caveat; the
  adapter does not auto-invalidate samples.
- Used only to test evidence handling (joins, ambiguity refusal, QC
  flagging, censored values). No causal ground truth is claimed; a shared
  visit_id is a relationship check, not a verified physical transfer.

## 8. Readiness verdict and precautions

- **Competition demonstration: READY with precautions.** Use the
  six-beat script in `validation/STEP18_DEMO_SCRIPT.md` (linked journey,
  unrelated positive, failed QC, sensitivity analysis, justified
  follow-up action, verbatim limitation statement), clearly labeled
  fixtures, a quiet machine (>2 GB free RAM), and the documented figures
  only if asked about accuracy.
- **Supervised expert pilot: READY as a prototype.** Suitable for a
  qualified WASH/laboratory reviewer to trial on documented evidence
  with the blind-review and user-evaluation protocols available; every
  conclusion must remain the reviewer's, not the software's.
- **Operational deployment: NOT READY.** No field validation, no
  external review completed, browser-local storage is not a multi-user
  authority, the Supabase migration is unconnected (two nullability
  divergences documented in `DEPLOYMENT_READINESS.md` still open), no
  clinical/regulatory standing.

Precautions: never present synthetic fixtures or scores as real-world
accuracy; the Sensitivity Studio is a decision-dependence check, not a
robustness proof; hash checks detect changes relative to a fingerprint,
not document authenticity; a stable categorical conclusion is not proof
of scientific correctness.

## 9. Unresolved issues / not tested

- Live Supabase migration tests: BLOCKED (no test database, no
  credentials used or requested).
- Screen reader usability: NOT TESTED.
- Windows/macOS browsers: NOT TESTED.
- Node 20 / Python 3.10 minimum versions: NOT TESTED.
- Remote CI: NOT TESTED.
- No external reviewer has completed the blind protocol; no user study
  has been run (protocols prepared; impact validation pending).
- Field validation: not performed.
- Reproducibility manifest: PASS, 126 files hashed, 0 missing
  (`validation/reproducibility_manifest.json`, Step 18 scope).
