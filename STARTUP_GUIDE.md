# WaterChain — Startup Guide (corrected package)

Verified on 2026-10-28 with Node 24.22.1 / npm 10.9.4 and Python
3.12.3. The documented minima are Node 20.9+ and Python 3.10+;
if you run exactly those minima and anything differs, tell the
maintainer — the audit matrix did not cover them (see
`docs/history/TEST_REPORT.md`).

## 1. Prerequisites

- Node.js 20.9+ and npm (check: `node --version`, `npm --version`).
- Python 3.10+ with no third-party Python packages needed
  (check: `python --version` on Windows, `python3 --version`
  on macOS/Linux).
- A Chromium-based browser or Firefox/Safari for the UI.
  Case data lives in that browser's `localStorage` only.

## 2. Install and run (all platforms)

From the unzipped project folder (the folder containing
`package.json`):

```bash
npm ci
npm run dev
```

`npm ci` (clean install from `package-lock.json`) is the
verified install path for this package; plain `npm install`
also works. Do not use `--legacy-peer-deps`: the pinned
Playwright version satisfies Next's peer range, so a
plain `npm ci` succeeds in a clean directory.

Open <http://localhost:3000>. That is the development server.
For the production build instead:

```bash
npm run build
npm run start
```

`npm run start` also serves on <http://localhost:3000> by
default. To use another port: `npm run start -- -p 3100`
(Windows PowerShell: `npm run start -- -p 3100` works the same).

## 3. Checks (run these before a demo)

```bash
npm run typecheck
npm run lint
npm run build
```

Python checks — **Windows** (PowerShell or Command Prompt):

```powershell
python -m unittest discover -s engine -p "test_*.py" -v
python engine/evaluate.py
python engine/run_holdout_validation.py
```

Python checks — **macOS / Linux** (if `python` does not exist,
use `python3`; the npm scripts say `python` because Windows
and CI provide that name):

```bash
python3 -m unittest discover -s engine -p "test_*.py" -v
python3 engine/evaluate.py
python3 engine/run_holdout_validation.py
```

Step 12 includes the engine suite plus explicit-journey tests and a separate dataset-adapter suite. Run both commands below; the exact count can change as regression tests are added. The 15-case evaluation and 16-case holdout scores are expected-decision conformance on developer-authored synthetic scenarios, not real-world diagnostic accuracy.

Browser tests (Playwright — see `tests/README.md` for current specs and environment prerequisites):

```bash
npm run build
npm run start -- -p 3106   # or let the Playwright webServer start it
npx playwright install chromium   # first run only
npm run test:e2e
```

Screenshots of the actual running app land in
`tests/screenshots/` (workspace, pathway states,
diagnostic results/limitations, mobile, stale). Every
browser case is a synthetic QA fixture in an isolated
browser context.

## 4. Making the API find Python

The Next.js server spawns Python for every diagnostic review.
It looks, in order, at the `PYTHON_EXECUTABLE` environment
variable, then `python` on Windows, then `python3` elsewhere.

- **Windows, if `python` is not on PATH** (PowerShell, in the
  same terminal before starting the server):

  ```powershell
  $env:PYTHON_EXECUTABLE = "C:\Path\To\Python\python.exe"
  npm run dev
  ```

  Use the full path printed by `py -0p` or by
  `where.exe python` if you installed Python from python.org
  or the Microsoft Store.

- **macOS / Linux, if only `python3` exists** (the usual case):

  ```bash
  export PYTHON_EXECUTABLE="$(which python3)"
  npm run dev
  ```

  If reviews fail with "The diagnostic engine could not
  complete this review", check the server terminal: it logs
  `[WaterChain diagnostic <requestId>] <message>` — a
  "Could not start Python" message means this step is wrong.
  No evidence records are ever written to that log.

- Do **not** set `PYTHON_EXECUTABLE` to a wrapper that ignores
  its arguments or prints extra output: the server expects the
  engine's single JSON line on stdout.

## 5. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `npm run build` fails with `Cannot find module 'autoprefixer'` | You are on the pre-audit ZIP. Use this corrected package, or run `npm install` after the `autoprefixer` dependency was added. |
| `npm run lint` fails on `eslint-config-next/core-web-vitals` | Same: use this corrected package (FlatCompat fix). |
| `npm install` is slow or times out | Registry/network issue, as in the original authoring environment. Retry; `package-lock.json` is now included, so `npm ci` is an alternative once the cache is warm. |
| Diagnostic review fails, homepage works | Python not found by the server — see section 4. |
| "Browser storage is unavailable or full" | The browser blocked or filled `localStorage`. Export evidence (CSV / JSON backup) before clearing site data; the view is read-only to protect what is stored. |
| Fonts look different / console shows a fonts error | Google Fonts could not be reached (offline/sandboxed network). The app still works with fallback fonts. |
| A restored bundle is rejected for a fingerprint mismatch | The bundle's records were edited after export. Re-export a fresh bundle from the source investigation; do not hand-edit bundles. |
| `python -m unittest …` says `python: command not found` (Linux/macOS) | Use the `python3` commands in section 3. |

## 6. What is NOT included

No database, account, deployment, or cloud sync. Do not use
this prototype for real public-health decisions, and do not
paste personal household details into notes. Export a JSON
backup before clearing browser data — clearing it deletes
investigations, and the server keeps no copy.


## Step 11 notes — pathway linkage, stale hiding, record codes (read before demoing)

- A result counts as pathway evidence only when the engine marks it
  `on_pathway`. That requires one batch linking all four stages. An
  eligible result from another batch reads `Eligible positive — not
  linked to selected pathway` (or the negative equivalent), counts as
  `On pathway: 0` for its stage, and never supports a candidate
  transition. The workbench's "Pathway stages linked" and "Unique
  shared batch" fields show the same selection.
- A stale report's conclusion is hidden by default. Only the alert and
  a collapsed `View previous report` disclosure (labelled
  `STALE · NOT FOR CURRENT EVIDENCE`) remain, and no review-bundle
  export is available until a fresh review completes. Re-run the
  review after any evidence change.
- Manual records get a generated code (`EV-<timestamp>-<token>`) that
  is checked case-insensitively against the current investigation's
  codes, retrying up to 20 times before failing cleanly (never an
  infinite loop). The internal record id is a UUID and is what the
  pathway detail uses to join engine eligibility. CSV duplicate
  codes are rejected per investigation; the same code may legitimately
  appear in two different investigations with different internal ids.
- Full browser suite: `npm run test:e2e` — 33 tests (pathway,
  workflows, screenshots, Step 11 audit, Step 11 screenshots),
  Chromium, production server on port 3107 (see `playwright.config.ts`).

## Step 10 notes — evidence eligibility (read before demoing)

Pathway stage states come **only** from the current
diagnostic engine report, never from the register:

- `Unassessed` — no records at the stage.
- `Eligibility unresolved` — records exist but no
  current engine report (not run yet, stale after an
  evidence change, or a saved pre-Step-10 report).
- `Result excluded` — the engine excluded the record
  (failed QC, missing metadata, unsupported analyte,
  invalid numeric value, …); the engine's reason is
  shown on the stage and in the workbench's "Record
  eligibility (engine)" table.
- `Evidence limited` — conflicting results at the
  stage, or no reportable result.
- `Eligible positive observed` — an engine-eligible
  positive. This is an observation, **not** proof of
  origin; only a candidate transition (bracketed by
  negatives, single shared batch) is ever claimed, and
  the workbench says so explicitly.
- `Eligible negative observed` — an engine-eligible
  negative. This is **not** proof that contamination
  was absent at other times.

Register badges ("No register flags", "Limited",
"Blocked") are a separate local screen: the register
treats missing source/batch identity as a warning,
while the engine excludes such records. Click any
stage to see both checks side by side. If a stage
shows "Eligibility unresolved", run the diagnostic
review before interpreting it.

## Step 9 notes

The latest diagnostic report is saved locally per investigation. After switching cases or reloading, check the displayed evidence fingerprint and stale-report notice before using the report. A report cache is browser-local and can be deleted by clearing site data; it is not a server backup. CSV imports now refuse unsupported headers and skip duplicate `record_code` rows with a reported error rather than importing a duplicate silently. Re-run `npm run typecheck`, `npm run lint`, `npm run build`, and the manual checks in `JUDGE_DEMO_CHECKLIST.md` on this Step 9 package before demoing it.


## Step 11 notes — pathway relevance, stale result visibility, and record IDs

- The pathway state uses only records where the Python engine says both `eligible: true` and `on_pathway: true`. A positive result that is eligible but from an unrelated/unselected batch is labeled `Eligible positive — not linked to selected pathway`; if no unique shared-batch pathway exists, the detail explains that no multi-stage pathway was established. Such results do not count toward the displayed `On pathway: X of N` count.
- Stage details join eligibility responses using the immutable internal `record_id`, not the human-visible `record_code`.
- Once evidence changes, the old result and hypothesis panels disappear from the default view. The stale report remains behind an explicit collapsed `View previous report` disclosure for audit context, and it cannot be exported as a current report. Run the diagnostic review again to show current results.
- Manual evidence codes are generated with collision checks against the current investigation, and the save path rejects duplicates defensively. Internal identity remains a UUID.
- Step 11's added browser checks are in `tests/e2e/pathway.spec.ts` and `tests/e2e/workflows.spec.ts`. (Superseded note: the Step 11 author's environment could not complete `npm ci` at the time, but the independent Step 12 pass ran the full browser suite in a dependency-enabled environment — see `docs/history/TEST_REPORT.md`.)

## Step 12 — Relationship model, local provenance and real-data adapter

New investigations can use the **Water Journey & Sampling Events** workspace. Register a source whose ID exactly matches the `water_source_id` values in the evidence records. Create a separate journey for each investigated household/site visit. Link each sample record to a sampling event with its real field/visit reference and water/container entity ID, then record adjacent-stage transfers with exact `from` and `to` entity IDs. The engine resolves 0, 1, or 2+ entity-connected routes; `2+` is a sentinel meaning multiple routes, not an exact count. It will not choose a route for convenience.

A directly documented sample relationship requires a reference. A documented transfer requires a source reference; an observed transfer requires a reference or note. These are recorded user assertions; the prototype does not authenticate documents. Candidate-transition review remains blocked when the source mapping, evidence eligibility, or graph is incomplete/ambiguous.

### Provenance file vault

When an original lab/field file is attached, the app calculates SHA-256 and attempts to keep the bytes in this browser's IndexedDB (10 MB maximum per file). The file is hashed and size-checked again before download. If browser storage is unavailable/full, WaterChain retains only metadata and says so. Original file bytes are not sent to a server or embedded in JSON relationship-ledger exports. Export or separately back up the original file if it must be reviewed on another device.

### Public dataset adapter (manual download required)

See `research/datasets/README.md`. Download the original `samples.csv`, `borehole_visits.csv`, `household_visits.csv`, and `labblanks.csv` files from the official Water Quality Uganda page, keep them unchanged, then run:

```bash
python research/datasets/waterqualityuganda_adapter.py --samples /path/to/samples.csv --borehole-visits /path/to/borehole_visits.csv --household-visits /path/to/household_visits.csv --labblanks /path/to/labblanks.csv --out research/output/waterqualityuganda-profile.json
```

The adapter creates a descriptive audit/profile; it does not load those records into the application and does not label causal contamination ground truth. The real dataset is not bundled, and the adapter should be run on the official files before making any claims about its full-dataset outputs.

### Step 12 test commands

```bash
python -m unittest discover -s engine -p "test_*.py" -v
python -m unittest discover -s research/datasets -p "test_*.py" -v
python engine/evaluate.py
python engine/run_holdout_validation.py
python engine/build_reproducibility_manifest.py
```

Frontend checks remain `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Mark any check BLOCKED if dependencies/browser binaries cannot be installed; don't infer a passing build from Python tests.


## Step 12 — field relationship model and provenance

The Step 12 relationship workbench is the preferred workflow for new multi-sample journeys. Register/map a source using the exact `water_source_id` values on evidence records. Link each existing evidence record to a separate sampling event, enter its field/visit reference and water/container entity ID, then record adjacent-stage transfers using the exact entity IDs and actual field/document references. Water bottles are observations; they are not treated as one physical sample carried unchanged across the pathway.

The route resolver emits 0, 1, or 2+ complete entity-connected paths. Two (`path_count = 2`) means “two or more”; it's a bounded multiple-route sentinel. Only one complete path can be considered for candidate-transition review. Missing/ambiguous relationships should be resolved using source documents, not by editing IDs to force the path to connect.

### Attachments and audit

Provenance files up to 10 MB are attempted in browser-local IndexedDB; SHA-256 and byte length are checked before download. Files are not uploaded or included in JSON ledger exports. The relationship audit is locally hash-chained, but it does not authenticate the user or provide server-side audit.

### Profile the public Water Quality Uganda dataset

Download the original `samples.csv`, `borehole_visits.csv`, `household_visits.csv`, and `labblanks.csv` from https://openwashdata.github.io/waterqualityuganda/ and run the adapter command in `research/datasets/README.md`. Do not treat `visit_id` as a physical transfer or causal label. The adapter profiles joins/QC and descriptive sample pairs; it does not automatically import rows into a diagnosis case. The real dataset is not shipped with this project.

## Step 12 regression commands

```bash
python -m unittest discover -s engine -p "test_*.py" -v
python -m unittest discover -s research/datasets -p "test_*.py" -v
python engine/evaluate.py
python engine/run_holdout_validation.py
python engine/build_reproducibility_manifest.py
```

## Step 12 independent audit — what changed in this TestVerified package

This package was independently re-verified end to end (see
`docs/history/BUG_FIX_SUMMARY_STEP12.md` for the full list). In the supplied Step 12
archive, `npm run typecheck` and `npm run build` failed and `npm run lint`
reported errors; all three now pass (lint: 0 errors, 1 pre-existing
`react-hooks/exhaustive-deps` warning in `app/page.tsx`). Engine tests grew
from 75 to 79 with transfer-hygiene regressions (duplicate transfer IDs and
reversed/non-adjacent/foreign-journey transfers are now flagged as blockers
instead of silently ignored). Adapter tests grew from 11 to 12 with a
sample/visit date-mismatch check. New browser tests
(`tests/e2e/step12-audit.spec.ts`) cover cross-journey link warnings,
vault size/empty/unicode handling, IndexedDB tamper detection, live and
exported ledger verification, and mobile/reduced-motion rendering.

Run the Python suites with `python3` on systems where only `python3`
exists (the npm script names use bare `python`; the API route itself already
defaults to `python3` outside Windows, and `PYTHON_EXECUTABLE` overrides it).

Demo precautions carried from Step 11 still apply: pre-import a linked case
and an off-pathway contrast case, keep JSON backups ready, re-run review
after any live evidence edit, and state the one-complete-path rule aloud
once. A competition demo can be ready while scientific validation remains
incomplete — do not present synthetic evaluation conformance (100% /
20% / 100% / 0%) as real-world accuracy, and do not present the
browser-local audit ledger as tamper-proof or authenticated.


## Step 13 — ActionLoop

After running a current diagnostic review, use **ActionLoop** to create an action from a finding or recommendation, or create a manual follow-up. Assign an owner, record the intended outcome, and optionally set a due date. Actions remain open until work is submitted with evidence references and a differently named reviewer records verification. Names are self-entered and unauthenticated. ActionLoop uses a separate localStorage key; use **Export action log** separately from the evidence backup before clearing browser data. See `ACTIONLOOP_GUIDE.md` and `docs/history/STEP13_VERIFICATION.md`.


## 7. Step 14 Risk & Control Register

In an active investigation, select **Risk & controls** in the left navigation. Record a real observation, its basis, links/references, and self-entered recorder. Leave severity or likelihood unknown unless there is a defensible basis. Screening priority is a qualitative prototype matrix, not a validated health-risk score.

Controls start as Proposed or Documented. Record implementation separately, then use a differently named reviewer and evidence reference/record to review effectiveness. If selected evidence records are edited or removed later, their saved SHA-256 snapshot no longer matches; the control review is flagged stale and cannot satisfy administrative risk-review closure until reviewed again.

The register can create linked corrective tasks in ActionLoop. Risk/control records and ActionLoop tasks have separate browser-local stores and separate exports; the main evidence backup does not include them. Save the risk-register export and ActionLoop export as well as the evidence backup before clearing browser data. Names are self-entered and not authenticated; this prototype must not be treated as a certified water safety plan or an operational public-health system.

Step 14 Playwright regression scenarios live in `tests/e2e/risk-control-register.spec.ts`. The authoring environment could run the Python suites and TypeScript/TSX syntax parser, but `npm ci` timed out, so the frontend typecheck/lint/build and browser suite were unverified there (see `docs/history/STEP14_VERIFICATION.md`). **Superseded:** the independent Step 16 verification pass (2026-10-29) executed them — typecheck/lint/build PASS, and the risk-control suite passes 4/4 after test-side corrections documented in `docs/history/BUG_FIX_SUMMARY_STEP16.md` (D6).


## Step 15 temporal evidence checks

After the app dependencies and Playwright Chromium are installed, run:

```bash
npm run test:temporal-e2e
```

These tests cover empty-state behavior, chronological ordering, undated-record handling, repeat-result interpretation, stale-report behavior, and the ActionLoop draft handoff. The fixtures are synthetic and stay under `tests/e2e/fixtures/`; they are not seeded into real investigations.


## Step 16 — Decision Sensitivity Studio

After a current diagnostic review, the **Decision sensitivity** panel
("Evidence stress test") lets a reviewer select up to four
engine-eligible, on-pathway records and run one omission scenario per
record against the real diagnostic API. Each scenario temporarily
omits that record (and its sampling event in explicit-journey mode)
from the request; the evidence register is never modified. Results
compare the decision-category signature and are labelled "Decision
changed" or "Same decision category" — never "robust". A same-category
outcome across the tested omissions is not a general robustness
guarantee; the panel states this explicitly.

The JSON export binds scenarios to a SHA-256 fingerprint of the tested
evidence snapshot plus a content fingerprint, and excludes raw evidence
rows. Use **Verify an exported sensitivity report** in the panel to
check a previously exported file against the currently loaded
evidence; tampered or out-of-date files are flagged. Results become
stale if the evidence or journey changes, and stale results cannot be
exported. Sensitivity results are session-local and are not persisted
across reloads.

Step 16 regression tests: `engine/test_step16_sensitivity.py` (run
with the engine suite) and `tests/e2e/decision-robustness.spec.ts`
(run `npx playwright test tests/e2e/decision-robustness.spec.ts` after
dependencies and Chromium are installed). Full method, decision-change
matrix, and interpretation limits: `docs/history/SENSITIVITY_docs/history/TEST_REPORT.md`.
Defects fixed in the independent Step 16 pass:
`docs/history/BUG_FIX_SUMMARY_STEP16.md`.

## Step 18 additions (2026-10-29)

- Comparative evaluation: `python3 engine/step18_compare.py` (in-process)
  or `python3 engine/step18_compare.py --api http://localhost:3107`
  (through the real endpoint; needs the production server running).
  Protocol: `engine/COMPARATIVE_EVALUATION_PROTOCOL.md`. Reports:
  `engine/step18_comparison_report.{json,md}`. Regression guardrails:
  `python3 -m unittest engine.test_step18_compare`.
- Step 18 blind reviewer packet: `python3
  engine/build_step18_reviewer_packet.py` writes
  `validation/reviewer_packet_step18.json` (13 adversarial cases,
  expected decisions withheld). Reviewer protocol:
  `validation/INDEPENDENT_REVIEW_PROTOCOL.md`. User-evaluation
  protocol (no participants run): `validation/USER_EVALUATION_PROTOCOL.md`.
- Real-data quality re-profile: run
  `research/datasets/waterqualityuganda_adapter.py` against the published
  CSVs (see `research/REAL_DATA_QUALITY_STEP18.md` for hashes) and save
  the profile to `research/real-data-profile.json`.
- Competition demo: six-beat script and checklist in
  `validation/STEP18_DEMO_SCRIPT.md`; two-page report draft in
  `validation/STEP18_PROJECT_REPORT_DRAFT.md`. Serve the production
  build (`npm run build && npm run start -- -p 3107`) on a quiet machine
  with >2 GB free RAM.
- Defects fixed in the independent Step 18 pass:
  `docs/history/BUG_FIX_SUMMARY_STEP18.md`. Current verification:
  `docs/history/TEST_REPORT_STEP18.md`.

## Step 20 additions (2026-10-29)

- Fresh full verification on this tree: `npm ci` (387 packages), `npx tsc
  --noEmit`, `npx eslint .` (0 errors, 2 documented warnings), `npm run
  build` — all PASS. This closed the Step 19 BLOCKED frontend item.
- New feature: human-readable case-report export ("Export readable case
  report" in the Diagnostic Workbench; Markdown with conclusion, eligibility
  table, findings, limitations, provenance). Builder: `lib/case-report.ts`.
  Regression tests: `tests/e2e/case-report.spec.ts`.
- Prior-art matrix: `STEP20_PRIOR_ART_MATRIX.md` (fresh 2026-10-29 research
  across 5 categories; honest integration-not-invention differentiation).
- Submission materials: `validation/STEP20_PROJECT_REPORT.md` (two pages),
  `validation/STEP20_ABSTRACT.md`, `validation/STEP20_EVIDENCE_SUMMARY.md`
  (one page), `validation/STEP20_DEMO_SCRIPT.md` (5-minute script + checklist),
  `STEP20_SCORECARD.md` (evidence-linked, 49/60 — below the 55 target; the
  gap is external evidence, not code).
- Reviewer outreach is prepared but NOT performed: blind handoff builds via
  `python3 validation/build_reviewer_handoff.py --out <zip>` (now with a
  content-level leak scan); sender checklist in
  `validation/REVIEWER_OUTREACH_CHECKLIST.md`. No reviewer contacted.
- SDG 6.3/6.1 target wording verified against UN sources (unstats.un.org,
  pacific.un.org) — see `STEP20_PROJECT_REPORT.md` §5.
- Full current verification: `TEST_REPORT_STEP20.md`; baseline:
  `STEP20_BASELINE.md`.
