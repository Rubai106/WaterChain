# WaterChain Step 10 — Test Report

Date: 2026-10-28. Base: `WaterChain_Step9_Light_Refinement.zip`
(Pass 2). Environment: Node 24.22.1, npm 10.9.4, Python
3.12.3 (`python3`), Chromium via Playwright 1.55.0
(headless shell 1187). Production server on port 3106 for
all live checks. QA fixtures only; no real samples.

Categories used in this report, as required:

- **PASS** — the test was actually executed and passed.
- **FAIL** — the test was executed and failed.
- **BLOCKED** — the test could not run, with the reason.
- **NOT TESTED** — the test was not attempted.

## 1. Dependency installation and production build

| Check | Result | Evidence |
|---|---|---|
| `npm ci` in a clean directory (no flags) | PASS | 387 packages installed; includes `@playwright/test@1.55.0`. (An earlier attempt with Playwright 1.49.1 failed dependency resolution against Next 15.5's `peerOptional ^1.51.1`; 1.55.0 was chosen to satisfy it — see BUG_FIX_SUMMARY_STEP10.md.) |
| `npm run typecheck` | PASS | `tsc --noEmit`, exit 0, on the final tree including Playwright specs |
| `npm run lint` | PASS | 0 errors, 1 pre-existing warning (`react-hooks/exhaustive-deps`, `app/page.tsx` line 133; same warning as Pass 2, line shifted by added code). A second warning found during this step (unused import in `playwright.config.ts`, my own) was fixed and re-verified. |
| `npm run build` | PASS | `/` static, `/api/diagnose` dynamic |
| Production server homepage GET / | PASS | 200 on port 3106 |
| `/favicon.ico` | PASS | 200 |

## 2. Python engine, evaluation, holdout (baseline comparison)

| Check | Result | Evidence |
|---|---|---|
| `python3 -m unittest discover -s engine -p "test_*.py"` | PASS | 52 tests (40 original + 12 new Step 10 eligibility tests), OK |
| New `engine/test_record_eligibility.py` (12 tests) | PASS | Failed blank control; missing method/batch/timestamp/source; unsupported analyte; non-finite/boolean/string numerics; clean eligible positive; eligible negative with no-absence-proof conclusion; empty evidence; conflicting records; lineage as case-level; quantified zero; eligibility-count consistency; unknown stage |
| `engine/evaluate.py` | PASS, baseline unchanged | WaterChain block: 100% fixture accuracy, 20.0% attribution coverage, 100% correct abstention, 0% unsupported (identical to Pass 2). Second printed block is the naive first-positive baseline (26.7% / 93.3% / 8.3% / 91.7%), expected output, not a regression. |
| `engine/run_holdout_validation.py` | PASS, baseline unchanged | 100% conformance (16/16), 0/13 unsupported in should-abstain cases (identical to Pass 2) |
| `engine/build_reproducibility_manifest.py` | PASS | `validation/reproducibility_manifest.json` regenerated: tests=passed (52 tests), 40 files hashed, 0 missing |
| Engine decision-rule changes | None | Only additive `record_eligibility` output; gates, attribution, hypotheses, conclusions, findings unchanged. No engine output changed for any existing fixture. |

All evaluation figures are synthetic fixture conformance,
not real-world diagnostic performance.

## 3. Live API (browser-to-API-to-Python workflow)

| Check | Result | Evidence |
|---|---|---|
| Linked 4-record QA case via `/api/diagnose` | PASS | `attribution_permitted: true`, confidence "candidate transition only", serving entry `{eligible: true, result_kind: "positive", on_pathway: true}` |
| Blocked positive (blank control fail) via API | PASS | `attribution_permitted: false`, serving entry `{eligible: false, reason: "Quality-control failure", result_kind: "positive", on_pathway: false}`, findings include `record_excluded` |
| Empty records via API | PASS | Abstention conclusion "No evidence records supplied", `attribution_permitted: false` |
| API with wrong payload (my test bug) | PASS (app behaviour) | `id: null` correctly returned 400 per `evidenceRecordSchema`; corrected payload passed. (Also recorded in Pass 2; repeated here on the new build.) |
| Python invoked through the real API | PASS | API responses carry `engine: waterchain-rule-engine-v1`, request IDs, and SHA-256 evidence fingerprints; engine subprocess errors would surface as API errors (none observed) |

## 4. Browser tests (Playwright, in-project suite)

Command: `npm run test:e2e` (config reuses the port-3106
production server or starts one). First full run: 16
passed, 1 failed — the failure was a test-helper bug
(see section 6), not an app defect. After fixing the
helper, a full re-run passed everything.

| Check | Result | Evidence |
|---|---|---|
| 17 Playwright tests (`tests/e2e/*.spec.ts`) | PASS | 17 passed in the final full run (6.8 min): 8 pathway tests, 8 workflow tests, 1 screenshots test |
| Pathway: homepage, navigation, empty pathway | PASS | All 4 stages "Unassessed"; engine status "not run yet"; ribbon visible |
| Pathway: records without a review | PASS | All assessed stages "Eligibility unresolved" (the old "Positive on file" bug is gone) |
| Pathway: clean eligible positive | PASS | Candidate transition at Serving; signals eligible-negative ×3 + eligible-positive; no proven-source wording; stage detail shows QC-04 eligible; `aria-pressed` set |
| Pathway: blocked positive (failed blank control) | PASS | Serving "Result excluded" + "Quality-control failure"; attribution not permitted; no candidate transition at Serving |
| Pathway: valid negative evidence | PASS | All stages "Eligible negative observed"; conclusion contains "not proof" |
| Pathway: incomplete evidence | PASS | Only Source assessed; attribution not permitted |
| Pathway: conflicting evidence | PASS | Serving "Evidence limited"; discordant finding shown; attribution not permitted |
| Pathway: lineage failure | PASS | Serving stays "Eligible positive observed" (observation) while attribution is blocked by lineage findings; no candidate-transition claim |
| Workflows: creation, switching, isolation | PASS | Case A records absent in B, intact on switch-back |
| Workflows: report persistence | PASS | Report survives reload and case switches; absent in a fresh case |
| Workflows: manual entry + stale protection | PASS | Stale banner + pathway falls back to unresolved + bundle export disabled; re-run gives new current states (discordant → Evidence limited) |
| Workflows: duplicate IDs / unknown headers | PASS | Duplicate error; "Unsupported CSV column" error |
| Workflows: backup / restore / malformed backups | PASS | Backup downloads; restore-as-separate works; non-JSON backup → "not valid JSON"; wrong-schema JSON → "Unsupported JSON format" |
| Workflows: keyboard focus + accessible labels | PASS | Tab reaches a stage card with a visible (non-`none`) focus outline; stage cards and signals carry `aria-label`s |
| Workflows: responsive pathway | PASS | Desktop ribbon visible; mobile 390px 0px overflow, hero visible, ribbon hidden, 4 signals; reduced-motion animations `none` |
| Workflows: console / page errors | PASS | 0 page errors; 0 unexpected console errors (offline Google Fonts failures filtered — fallback fonts render) |
| Screenshots (8 files in `tests/screenshots/`) | PASS | workspace-light, pathway-empty, pathway-blocked-positive, pathway-eligible-positive, diagnostic-blocked-positive, diagnostic-results-limitations, workspace-mobile, diagnostic-stale — all of the actual running app, all synthetic QA fixtures |

## 5. Feature preservation (spot-verified in the same runs)

PASS: investigation creation/switching/isolation,
evidence entry and validation, CSV import, duplicate
rejection, JSON backup/restore, browser-local
persistence, diagnostic report persistence, evidence
fingerprints and stale handling, API validation and
limits, Python subprocess execution, competing
hypotheses, conservative abstention, integrity
findings, next-step recommendations, report export
(bundle export disabled while stale; fresh-bundle
export path unchanged from Step 8 verification),
synthetic evaluation, holdout evaluation,
reproducibility manifest, all existing unit/regression
tests (52/52).

## 6. Honest history of the suite

- First full Playwright run: **16 passed, 1 failed**.
  The failure was in `workflows.spec.ts` (stale test):
  the shared `runDiagnostic` helper waited only for
  `.diagnostic-result` to exist, so on a re-run it
  returned the still-visible stale report. The app
  behaved correctly (stale banner shown, old result
  labelled stale); the helper was wrong. It was fixed
  to wait for a fresh result (no "Evaluating…" text,
  no stale banner, result present), the single test
  was re-run and passed, and then the **full suite
  was re-run: 17 passed, 0 failed**. The 16/17 figure
  is preserved here, not overwritten.

## 7. FAIL / BLOCKED / NOT TESTED

- **FAIL:** none in the final state.
- **BLOCKED:** none — no check was blocked by tooling
  or connectivity in this pass (the Playwright
  browser download succeeded; the font host is
  unreachable in the sandbox but degrades to fallback
  fonts and blocks nothing).
- **NOT TESTED:** CSV export end-to-end and
  review-bundle export end-to-end in this pass (code
  untouched since Step 8 verification of both; the
  stale-disable of bundle export *was* tested);
  full keyboard walkthrough beyond the Tab-to-stage-
  card test; screen-reader testing; Windows/macOS
  browsers (Chromium only); Node 20 / Python 3.10
  minima (this run: Node 24 / Python 3.12); remote
  CI; any external or field validation; true
  localStorage quota exhaustion (write-failure
  handler only, as in Step 8).

## 8. Remaining limitations before a competition demonstration

1. Pathway signals are engine-authoritative, but the
   workbench still displays a stale report's old
   conclusion below its stale banner (pre-existing
   design; the banner, the disabled export, and the
   pathway's unresolved fallback are the guards).
   Judges should be told to re-run after any evidence
   change — the UI says so, but the old conclusion
   remains visible.
2. Stage detail matches records to eligibility entries
   by record code; two distinct rows sharing one code
   (a blocked case-level state) share one lookup.
   Duplicate codes are rejected at CSV import, but
   manual entry does not yet forbid them.
3. Pre-existing `react-hooks/exhaustive-deps`
   warning in `app/page.tsx` (warning only).
4. No focus trap / Escape handling in dialogs;
   no screen-reader walkthrough; no Windows/macOS
   browser runs; no remote CI; no external review
   or field validation.
5. Reports are browser-local only; clearing site
   data deletes investigations (backups are the
   safety net — demo with a backup file ready).
6. Google Fonts fail offline (fallback fonts render).
