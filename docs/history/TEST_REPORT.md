# WaterChain Step 16 — Independent Test Report

> **Step 18 (2026-10-29):** this file is the Step 16 report, preserved for
> continuity. The current Step 18 audit — full re-verification of the
> Step 17 tree, comparative evaluation vs a documented naive baseline,
> blind-review packet, real-data re-profile, demo script, and two-page
> project report draft — is reported in **`TEST_REPORT_STEP18.md`**.
> The Step 18 verdict: competition demo READY with precautions,
> supervised expert pilot READY as a prototype, operational deployment
> NOT READY.

Supplied archive: `WaterChain_Step16_Decision_Sensitivity.zip`
(md5 `6634f5a3b9511c5f22830ccc0be6e7f0`), preserved untouched at
`~/workspace/waterchain-step16/original/`.
Working copy: the `waterchain-step16` project in this package
(version `0.6.0`).
Environment: Node v24.22.1, npm 10.9.4, Python 3.12.3, Ubuntu 24.04.5
LTS, Chromium via Playwright `@playwright/test@1.55.0`, production
server on port 3107 (`reuseExistingServer: true`).

The supplier's own `STEP16_VERIFICATION.md` honestly states that
`npm ci` timed out in their environment, so typecheck, lint, build,
browser tests, and the new-feature integration were NOT executed by
the supplier (their Python suites and synthetic evaluations were).
This report executes everything. Nothing below is taken from a prior
report without re-execution.

Status words: **PASS** = executed and passed; **FAIL** = executed and
failed; **BLOCKED** = could not run, with the reason; **NOT TESTED** =
not attempted. Static inspection, unit tests, API tests, browser
tests, and real-data validation are distinguished throughout.

## 1. The 11 required answers

1. **Does dependency installation pass?** PASS — `npm ci` exit 0 with
   the supplied lockfile, 387 packages, no package added/removed/
   bumped. (`package.json`/`package-lock.json` byte-identical to the
   supplied ZIP.)
2. **Does the typecheck, lint, and production build pass?** PASS after
   one fix — the supplied tree FAILED typecheck (exit 2:
   `app/page.tsx` used `RefreshCw` without importing it), so the build
   could not succeed as shipped (D1). After the fix: typecheck PASS,
   lint 0 errors + 2 documented warnings (D2), `npm run build` PASS
   (`.next` outputs verified, incl. the `/api/diagnose` route).
3. **Does the real browser-to-API-to-Python workflow pass?** PASS —
   Playwright against the production build drives the real
   `/api/diagnose` route and the real Python engine (see §6), plus
   direct API probes (§4): valid linked pathway → 200 with
   `attribution_permitted: true`, "candidate transition only";
   malformed JSON → 400 with requestId; schema violations → 400 with
   no evidence echoed; empty evidence → 200, "not assessed", no
   attribution.
4. **Do the sensitivity scenarios produce the correct results?** PASS
   — live omission matrix against the real API (§4,
   `SENSITIVITY_TEST_REPORT.md` §B): omitting the serving positive or
   any earlier negative withholds the candidate transition
   ("Decision changed"); redundant independent evidence absorbs an
   omission ("Same decision category", correctly); an already-
   abstaining baseline stays withheld. The browser test asserts two
   "Decision changed" pills end-to-end for the QC-01/QC-04 omissions.
5. **Are selected records eligible and on the correct pathway?** PASS
   by code inspection + engine contract: candidates are filtered from
   the engine's own `record_eligibility` on `eligible && on_pathway &&
   (positive|negative)`, joined by immutable internal record ID; the
   API schema carries `record_id`, `eligible`, `on_pathway`,
   `result_kind` from the engine — nothing is guessed from labels.
6. **Does stale-report protection work during edits, reloads, and
   investigation switches?** PASS — the studio unmounts with a stale
   report (`#decision-robustness` count 0 after an evidence edit,
   asserted in browser); mid-run evidence changes mark results stale
   and block export; results are not persisted across reloads (fail
   closed); workspace switches reset the workbench state. Tampered or
   out-of-date exports are flagged by the new in-app verifier (D4).
7. **Can original evidence be changed by sensitivity analysis?** No —
   PASS. Scenarios build filtered copies (`records.filter(item =>
   item.id !== record.id)`) and POST them as temporary payloads; the
   register still lists all records afterwards (asserted in browser);
   the export contains no raw evidence rows (asserted
   `evidenceRecords` absent).
8. **Do the prior Step 12–15 features still work?** PASS after fixes —
   the full Playwright suite covers Step 11 audits, Step 12 journey
   model/vault/ledger, Step 13 ActionLoop, Step 14 risk register, and
   Step 15 temporal planner. Two genuine defects were found and fixed:
   D5 (every ActionLoop transition rejected — inverted validator) and
   D6 (eight stale test assertions). See §6.
9. **Which defects were fixed?** D1–D6, documented with evidence in
   `BUG_FIX_SUMMARY_STEP16.md` (summary appended to
   `BUG_FIX_SUMMARY.md`).
10. **What tests remain blocked?** Live Supabase migration tests
    (BLOCKED — no test database; the migration remains unconnected
    static SQL, as in Step 12); screen reader, Windows/macOS browsers,
    Node 20 / Python 3.10 minima, remote CI (NOT TESTED).
11. **Is the application ready for a competition demo, supervised
    expert pilot, or operational deployment?** Competition demo:
    **READY with precautions** (use the judge demo checklist; do not
    present synthetic scores as real-world accuracy). Supervised
    expert pilot: **READY as a prototype** — all audit defects fixed
    and verified, but expert review of the scientific content is still
    required before any operational claim. Operational deployment:
    **NOT READY** — browser-local storage is not a secure multi-user
    authority, the Supabase migration is unconnected, and no field
    validation exists. See §8.

No "55/60 score" or scientific-accuracy claim is made from feature
counts or synthetic scores; the synthetic evaluation measures
conformance to developer-authored fixtures only.

## 2. Installation and static checks

| Check | Result |
|---|---|
| `npm ci` (supplied lockfile) | PASS — exit 0, 387 packages |
| `npx tsc --noEmit` | PASS after D1 (supplied tree: exit 2) |
| `npx eslint .` | PASS — 0 errors, 2 documented warnings (was 9 warnings; D2) |
| `npm run build` | PASS — exit 0, `.next` outputs verified |
| Supplied ZIP integrity (`unzip -t`) | PASS — no errors |
| Reproducibility manifest (`python3 engine/build_reproducibility_manifest.py`) | PASS — 5 checks, 103 files hashed, 0 missing |

Note: `package.json` scripts invoke bare `python`, which this
environment does not provide; Python suites were run with `python3`
using the identical commands. The API route already prefers `python3`
on non-Windows. Scripts were left unchanged.

## 3. Python engine, adapter, and synthetic evaluation (all executed)

| Suite | Result |
|---|---|
| Engine unit tests (`test_*.py` in `engine/`) | **83/83 PASS** (incl. 4 Step 16 sensitivity regressions) |
| Dataset-adapter tests | **12/12 PASS** |
| Synthetic evaluation (`engine/evaluate.py`) | PASS — 15 cases: expected-decision fixture accuracy 100.0%, attribution coverage 20.0%, correct abstention 100.0%, unsupported attribution on should-abstain 0.0% |
| Synthetic holdout (`engine/run_holdout_validation.py`) | PASS — 16/16 expected decisions, 0/13 unsupported attributions |

All figures identical to the supplied tree's own claims and to the
Step 10–12 baselines. No engine rule was modified in this pass.

## 4. API behaviour probes (executed against the production server)

- Valid linked 4-stage pathway → 200, `attribution_permitted: true`,
  confidence "candidate transition only", 4 `record_eligibility`
  entries.
- Omit serving positive → 200, attribution withheld, "insufficient
  evidence". Omit source/storage negative → withheld.
- Redundant evidence (extra serving positive) → omission leaves the
  candidate transition permitted (correct).
- Already-abstaining baseline (all negatives) → omission keeps
  "insufficient evidence".
- Malformed JSON → 400 + requestId; schema violation → 400, no
  evidence echoed in the error body; empty evidence → 200,
  "not assessed".
- Hanging engine → **503 at ~15.3 s** (TIMEOUT_MS 15000), generic
  message + requestId, no report (cannot be mistaken for an
  abstention). Malformed engine output → 503 generic. Missing Python
  → 503 generic. Server logs contain no evidence on these paths.

## 5. Sensitivity Studio — see `SENSITIVITY_TEST_REPORT.md`

Full Phase 2/3 report in `SENSITIVITY_TEST_REPORT.md`: basic operation
(§A), decision-change matrix (§B), eligibility/pathway membership
(§C), concurrency and stale-data handling (§D), algorithm and report
accuracy (§E), regression tests (§F), known limits (§G). Headline:
the feature runs genuine leave-one-record-out analyses against the
real diagnostic API, omits by immutable record ID, never modifies the
evidence, labels its method honestly (no probabilities, no "robust"
claims, no causal-counterfactual framing), and its exports are now
tamper-evident and re-verifiable in the app (D4).

## 6. Browser E2E (Playwright, production build, real engine)

Composed, honest accounting (Step 12 precedent: no single-run claim
where re-runs were needed):

- **First full run: 60 tests, 28 passed, 32 failed.** Failure triage:
  26 failures were `net::ERR_CONNECTION_REFUSED` — the test server
  process died mid-run under memory pressure (the environment had
  <1 GB free while Chromium + Next.js ran for 18+ minutes), not app
  defects. The remaining 6 were genuine: 2 ActionLoop + 3
  risk-register assertion failures and 1 screenshots timeout (the
  timeout was also server-death fallout).
- Root causes found: **D5** (inverted `nonempty()` validator rejected
  every ActionLoop transition — the headline Step 13 workflow could
  not progress any action past "Open") and **D6** (eight stale
  assertions in the never-executed Step 13/14 specs: honest UI wording
  the tests predated, an auto-expanded card toggle, the "Active
  actions" filter, and history-label text collisions).
- **After fixes + rebuild + fresh server:** `action-loop.spec.ts`
  3/3 PASS, `risk-control-register.spec.ts` 4/4 PASS,
  `decision-robustness.spec.ts` 3/3 PASS (incl. the new
  export-verification/tamper test and the "Decision changed"
  assertions).
- **Final full run: 61 tests** (60 + the new sensitivity tamper test):
  **60 passed, 1 failed** in 29.3 min. The single failure was
  `screenshots.spec.ts` exceeding its 90 s timeout on a heavily loaded
  machine — re-run standalone with a 240 s timeout: **1 passed**
  (1.8 min), with genuine screenshots regenerated into
  `tests/screenshots/`. Composed total: **61/61 PASS** across the
  final full run plus the standalone screenshots re-run (composition
  stated explicitly, as in Step 12; no single 61-test run claimed).

All Playwright scripts are in `tests/e2e/` (11 spec files + `helpers.ts`
+ fixtures). No synthetic fixture is seeded into the production
evidence register; every case uses isolated browser contexts.

## 7. Real research data (Water Quality Uganda)

- The four published CSVs were **re-downloaded on 2026-10-29** from the
  authoritative source
  (`https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/`,
  docs at `https://openwashdata.github.io/waterqualityuganda/`,
  licence CC-BY, citation Nansiimbi C, Clavijo Daza A (2026)).
- Fresh-download hashes are **identical** to the Step 12 record
  (samples.csv `34d75127…5f5f5`, 3,203 rows; borehole_visits.csv 477;
  household_visits.csv 1,118; labblanks.csv 134), confirming the cached
  files are the current published files.
- Adapter run (`waterqualityuganda_adapter.py`) exit 0
  (`profile_complete`): joins 508 borehole / 2,236 household / 459
  missing visit_id; match_status: 2,187 matched, **278 ambiguous
  (refused, never auto-linked)**, 295 no field record, 443 no lab
  result; 843 exact transport/storage pairs; duplicate IDs 0; date
  mismatches 0; **9 of 134 lab blanks positive (6.7%)** — flagged as a
  pilot caveat; the adapter does not auto-invalidate samples.
- Full profile: `RESEARCH_DATA_AUDIT.md` (+ the regenerated
  `research/real-data-profile.json` in this package).
- Limits (unchanged): observational data, no causal ground truth; a
  shared `visit_id` is a relationship check, not a verified physical
  transfer.

## 8. Readiness verdict and precautions

- **Competition demo: READY with precautions.** Follow
  `JUDGE_DEMO_CHECKLIST.md`; state plainly that the 15 synthetic
  scenarios are developer-authored software tests, not real samples,
  and do not measure real-world accuracy. The sensitivity studio is a
  decision-dependence check, not a robustness proof.
- **Supervised expert pilot: READY as a prototype.** All defects found
  in this pass are fixed and verified; the audit ledger, vault, and
  sensitivity exports are tamper-evident (not tamper-proof); actor
  names are self-entered and unauthenticated; data is browser-local.
  An expert team must review the scientific content and configure the
  qualitative risk matrix before any operational use.
- **Operational deployment: NOT READY.** No multi-user authority, no
  authenticated identity, the Supabase migration is unconnected and
  has two nullability divergences to reconcile before activation (see
  `DEPLOYMENT_READINESS.md`), no field validation, no external WASH/
  laboratory review.

## 9. Unresolved issues / not tested

- Live Supabase migration tests: BLOCKED (no test database, no
  credentials used). The migration file is static SQL only.
- Screen-reader testing, Windows/macOS browsers, Node 20 / Python
  3.10 minimum-version checks, remote CI: NOT TESTED.
- Field validation with real investigators, external WASH/laboratory
  review, and user testing: NOT TESTED (required before any
  operational claim).
- The qualitative severity/likelihood screening matrix is an
  unvalidated aid by design; an expert team must replace or configure
  it before operational use.
- Environment note: the Playwright full run is sensitive to memory
  pressure — the test server died once under <1 GB free RAM during an
  18-minute run; the final run was done on a fresh server, and a quiet
  machine is recommended before a demo.
