# WaterChain Step 11 — Browser Test Report (historical baseline)

> **Historical snapshot, superseded for Step 12.** This report describes the Step 11 browser baseline (33 passing tests) and is retained for provenance. It is not the final Step 12 browser result. For Step 12, read `TEST_REPORT.md` §6, which documents the complete run plus targeted reruns and carefully states that the composed total is 45/45; no single 45-test run is claimed.


Browser: Chromium via Playwright 1.55.0 (headless shell 1187),
Linux. App: production build (`npm run build` + `npm run start`),
port 3107, real Python engine through `/api/diagnose`. One
Playwright worker (serial), isolated browser contexts per test,
so no test touches another test's or a real user's investigations.
Command: `npm run test:e2e`. Full run: **33 passed, 0 failed,
12.6 minutes**. Every browser case below is a synthetic QA
fixture; screenshots are of the actual running app, not mockups.

## Viewports

- Desktop: 1280×720 default (Playwright desktop), plus 1280×900
  for the Step 11 screenshots.
- Mobile: 390px wide (supplied responsive test) — pathway ribbon
  hidden, stage nodes stacked, hero visible, 0px horizontal
  overflow.
- Reduced motion: `prefers-reduced-motion: reduce` emulated —
  pathway animations resolve to `none`.

## Test counts by file

| File | Tests | Result |
|---|---|---|
| `tests/e2e/pathway.spec.ts` (supplied) | 8 | 8 passed |
| `tests/e2e/workflows.spec.ts` (supplied) | 9 | 9 passed |
| `tests/e2e/screenshots.spec.ts` (supplied) | 1 (produces 8 shots) | passed |
| `tests/e2e/step11-audit.spec.ts` (this pass) | 14 | 14 passed |
| `tests/e2e/step11-screenshots.spec.ts` (this pass) | 1 (produces 2 shots) | passed |
| Total | 33 | 33 passed |

## What the browser tests actually covered

- Homepage, navigation, empty pathway (`Unassessed` everywhere).
- Records without a review: `Eligibility unresolved` everywhere.
- Clean eligible positive: candidate transition at Serving, no
  proven-source wording, stage detail shows the eligible record.
- Blocked positive (failed blank control): `Result excluded` +
  `Quality-control failure`; no candidate transition.
- Valid negatives: `Eligible negative observed`, conclusion
  contains `not proof`.
- Incomplete evidence: only the recorded stage assessed.
- Conflicting evidence: `Evidence limited`, discordant finding,
  attribution not permitted.
- Lineage failure: `Eligible positive — not linked to selected
  pathway`, detail `Eligible · off selected pathway`, no
  transition claim.
- Off-pathway alone / off-pathway + linked / different source /
  missing batch / investigation switching / new-report updates
  (audit A1–A5).
- Stale: hidden conclusion, closed disclosure, no export,
  unresolved fallback, reload persistence, switch-back fidelity,
  re-run restoration, rapid-edit/rapid-rerun settling (audit
  B1–B2; supplied stale test).
- Manual entry: distinct codes on empty cases, 8 rapid adds with
  unique codes and UUID ids (audit C1; supplied distinct-codes
  test).
- CSV: valid import, duplicate rejection (same case / different
  case / whitespace), unknown columns, quoted commas, Unicode
  lab name and notes, blank lines, rejected imports preserving
  saved evidence (audit C2–C3, D1; supplied duplicate test).
- CSV export download (`.csv` filename) and review-bundle export
  download (`.json`, fingerprint present) (audit D2).
- Tampered review bundle: fingerprint-mismatch rejection, no
  restore modal, no new investigation (audit D3).
- JSON backup, restore-as-separate (existing investigations
  untouched), malformed and wrong-schema backups (supplied).
- Keyboard focus to stage cards with visible focus outline,
  `aria-label` on stage cards and signals (supplied).
- Responsive pathway and reduced motion (supplied).
- Console: 0 page errors, 0 unexpected console errors in the
  console test and in the audit branding test (offline font
  failures filtered; fallback fonts render).

## Screenshots (`tests/screenshots/`, all from this run)

- `workspace-light.png` — light workspace, hero, pathway.
- `pathway-empty.png` — empty pathway, all unassessed.
- `pathway-blocked-positive.png` — Serving excluded.
- `pathway-eligible-positive.png` — linked positive at Serving.
- `pathway-off-pathway-positive.png` — NEW (Step 11): Serving
  `Eligible positive — not linked to selected pathway`,
  `On pathway: 0 of 1`, detail `Eligible · off selected pathway`,
  workbench `Pathway stages linked 0/4`, `Unique shared batch:
  Not established`, conclusion `attribution is not permitted`.
- `diagnostic-blocked-positive.png` — blocked-positive results.
- `diagnostic-results-limitations.png` — results + limitations.
- `diagnostic-stale.png` — stale state (Step 10 shot, regenerated).
- `diagnostic-stale-disclosure.png` — NEW (Step 11): stale alert
  plus the opened `View previous report` disclosure.
- `workspace-mobile.png` — mobile workspace, stacked layout.

## Browser-level failures found during the pass (all resolved)

First full supplied-suite run: 5 failures. Root causes, all
established by reading the failure output (not assumed):
stale-export assertion against a hidden block (B2), two
outdated pathway-label expectations plus one wording substring
(B1), and a modal-open timeout from the ambiguous `Add evidence`
button (B3) / a disabled-Import click on rejected CSVs (B4).
Details and fixes: BUG_FIX_SUMMARY_STEP11.md. Final full run
after the fixes: 33/33, including re-runs of every previously
failing test.

## Not covered in a browser here

Screen readers; Windows/macOS browsers; Node 20 / Python 3.10
minima; remote CI; field validation. See TEST_REPORT.md
section 7 and READINESS_ASSESSMENT.md.
