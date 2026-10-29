# WaterChain Refinement Pass 2 — Test Report

Date: 2026-10-28. Base: delivered Pass 1 ZIP
(`WaterChain_Step9_WavyTidal_Redesign.zip`). Environment:
Node 24.22.1, npm 10.9.4, Python 3.12.3 (`python3`),
Chromium via Playwright. Production server on port 3105
for all live checks. QA fixtures only (QA-/QD-/QS-
prefixes); no real samples, no real diagnoses claimed.

## Automated / command checks

| Check | Result | Evidence |
|---|---|---|
| `npm install` (lockfile) | PASS | 384 packages |
| `npm run typecheck` | PASS | `tsc --noEmit`, exit 0 |
| `npm run lint` | PASS | 0 errors, 1 pre-existing warning (`react-hooks/exhaustive-deps`, `app/page.tsx` line 129 — same warning as Pass 1, line shifted by one added state line) |
| `npm run build` | PASS | `/` static, `/api/diagnose` dynamic |
| Python `unittest discover -s engine` | PASS | 40/40 |
| `engine/evaluate.py` | PASS | WaterChain block: 100% fixture accuracy, 20.0% attribution coverage, 100% correct abstention, 0% unsupported; second printed block is the naive first-positive baseline (26.7% / 93.3% / 8.3% / 91.7%) and is expected output, not a regression |
| `engine/run_holdout_validation.py` | PASS | 100% conformance, 0/13 unsupported in should-abstain cases |
| Homepage GET / | PASS | 200 |
| `/favicon.ico` | PASS | 200 |
| Live API, linked 4-record QA case | PASS | `attribution_permitted: true`, confidence "candidate transition only", serving hypothesis `observed_positive`, others `no_positive_observed` |
| Live API, discordant 5-record QA case | PASS | `attribution_permitted: false`, finding `discordant_stage_results` |
| Live API, empty records | PASS (negative control) | Abstention conclusion "No evidence records supplied", `attribution_permitted: false` |
| API with wrong payload (my test bug) | PASS (app behaviour) | `id: null` correctly returned 400 per `evidenceRecordSchema` (`id` must be a non-empty string); corrected fixture then passed — recorded so the 400 is not mistaken for a regression |

## Browser checks (Chromium, refined production build)

Full run: **37/37 PASS** (script:
`waterchain-refine/e2e2.js`): homepage loads; light
background computed `rgb(244, 248, 251)`; hero title
deep navy `rgb(23, 50, 74)`; hero + headline; 3 hero
waves; flowline; brand SVG; favicon 200; 0px desktop
overflow; case A created; empty pathway all
"Unassessed"; ribbon visible on desktop; empty review
abstains; 4 QA records imported; linked pathway
signals (Limited ×3, Positive on file at Serving);
pathway never labels a stage as proven source;
Serving stage selectable; browser candidate transition
at Serving; report persists across reload; stale banner
after evidence change; bundle export disabled while
stale; conflicting case attribution NOT permitted;
discordant finding shown; conflicting pathway Serving
still only "Positive on file"; incomplete pathway only
Source assessed; incomplete case abstains; case A
isolated on switch-back; duplicate CSV rejected;
unknown-header CSV rejected; backup downloaded;
restore dialog offers separate investigation; restored
copy active without overwriting; mobile 390px 0px
overflow; mobile hero visible; mobile ribbon hidden;
waves + ribbon off under reduced motion; 0 page errors.

## Before / after screenshots

- Before: Pass 1 dark Tidal homepage, screenshot of
  the delivered Pass 1 production build (same 1280×900
  viewport, fresh homepage).
- After: refined light homepage (same viewport, fresh
  homepage), plus a pathway close-up (ribbon, four
  dimensional nodes, Unassessed signals, legend) and a
  mobile full-page shot. All in the delivery folder
  (`waterchain-refine/e2e-out/`: `before-dark-desktop.png`,
  `after-light-desktop.png`, `after-light-pathway.png`,
  `after-light-mobile.png`). They show the same
  application at the same viewport, not prototypes.

## Categories summary

- PASS: install, typecheck, lint, build, Python tests,
  evaluation, holdout, live API (linked, discordant,
  empty), all 37 browser checks, favicon, responsive
  overflow, reduced motion, 0 page errors.
- FAIL: none in the final state.
- BLOCKED: none — no check was blocked by tooling or
  connectivity in this pass (the font host is
  unreachable in the sandbox, but that degrades to
  fallback fonts and does not block any check).
- NOT TESTED: CSV export end-to-end and review-bundle
  export end-to-end in this pass (code untouched, Step
  8 audit verified both); full keyboard walkthrough;
  screen-reader testing; Windows/macOS browsers; Node
  20 / Python 3.10 minima; remote CI; any external or
  field validation. See FEATURE_PRESERVATION.md.

## Remaining defects (honest list)

1. Pre-existing `react-hooks/exhaustive-deps` warning
   in `app/page.tsx` (useMemo dependencies) — warning
   only, predates both redesigns, behaviour unchanged.
2. No focus trap / Escape handling in dialogs —
   pre-existing, unchanged.
3. Google Fonts fail on offline/sandboxed networks —
   fallback fonts render; cosmetic only, pre-existing.
4. No dark theme in this package — deliberate scope
   decision (see DESIGN_SYSTEM.md), not a defect in
   the light experience.
5. Stage signals are record-level observations; they
   cannot express engine-only nuances (e.g. a stage
   whose records are all excluded by the stricter
   engine still shows "Records on file" / "No register
   flags" from the register's view). The pathway
   legend and the workbench conclusion carry the
   authoritative verdict; this gap is by design (the
   frontend must not re-infer the diagnosis), but
   judges should be told the pathway is not the
   verdict — the diagnostic panel is.
