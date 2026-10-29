# WaterChain Redesign — Test Report (Wavy Tidal Depth, Phase 2)

Date: 2026-10-28. Base: supplied Step 9 package. Environment:
Node 24.22.1, npm 10.9.4, Python 3.12.3 (`python3`), Chromium
138 via Playwright. Production server on port 3103 for all
live checks. QA fixtures only (QA-/RT- prefixes); no real
samples, no real diagnoses claimed.

## Automated / command checks

| Check | Result | Evidence |
|---|---|---|
| `npm install` (lockfile) | PASS | 384 packages |
| `npm run typecheck` | PASS | `tsc --noEmit`, exit 0 |
| `npm run lint` | PASS | 0 errors, 1 pre-existing warning (`react-hooks/exhaustive-deps`, `app/page.tsx` line ~128, unchanged from Step 8/9) |
| `npm run build` | PASS | `/` static, `/api/diagnose` dynamic; rebuilt again after the sidebar/stage-card colour correction, also PASS |
| Python `unittest discover -s engine` | PASS | 40/40 |
| `engine/evaluate.py` | PASS | WaterChain block: 100% fixture accuracy, 20.0% attribution coverage, 100% correct abstention, 0% unsupported; the second printed block is the naive first-positive baseline (26.7% / 93.3% / 8.3% / 91.7%) and is expected output, not a regression |
| `engine/run_holdout_validation.py` | PASS | 16/16 conformance, 0/13 unsupported in should-abstain cases |
| Homepage GET / | PASS | 200 |
| `/favicon.ico`, `/icon.svg`, `/favicon.svg` | PASS | 200 each (favicon.ico was 404 in Step 8/9) |
| Live API, linked 4-record QA case | PASS | `attribution_permitted: true`, confidence "candidate transition only", earliest positive at Serving, no findings |
| Live API, incomplete payload | PASS (negative control) | Missing required fields correctly returned 400 with zod path details (this caught a malformed test fixture of mine, not an app defect) |
| API with malformed timestamps (test-fixture bug) | PASS (engine behaviour) | Records with invalid timestamps (`T010:`) were correctly excluded by the engine; corrected fixture then passed — recorded here so the exclusion is not mistaken for a redesign regression |

## Browser checks (Chromium, redesigned production build)

Final full run: **26/26 PASS** (script:
`waterchain-redesign/e2e.js`; earlier runs surfaced three
script bugs of mine — a relabelled run button, a placeholder
dropdown option, and a misnamed backup button — each fixed
in the script and re-run; none was an app defect):

homepage loads; hero present + headline; 3 wave SVGs;
flowline; brand SVG; favicon 200; 0px desktop overflow;
case A created; empty review abstains; CSV preview 4;
4 QA records imported; browser candidate transition at
Serving; report persists across reload; stale banner after
evidence change; bundle export disabled while stale; case B
isolated; case B shows no A report; duplicate CSV rejected;
unknown-header CSV rejected; backup downloaded; restore
dialog offers separate investigation; restored copy active
without overwriting; mobile 390px 0px overflow; mobile
hero visible; waves off under reduced motion.

## Before / after screenshots

- Before: original Step 9 production build (dark grey
  dashboard, waves-icon tile, no hero) — screenshot taken
  from a production build of the supplied package.
- After: redesigned production build (Tidal blues, hero +
  waves, droplet-chain mark, flowline) — fresh homepage
  screenshot after the final colour correction.
Both are in the delivery folder alongside this report's
parent workspace (`waterchain-redesign/e2e-out/`:
`before-desktop.png`, `after-desktop.png`,
`after-mobile.png`). They show the same application at the
same viewport, not prototypes.

## Colour-correction note (honest rework)

After the first full browser pass, a screenshot review
showed the sidebar and stage cards still in their old
near-black tones (their backgrounds were `rgba()` values,
not hex, so the first recolour pass missed them). They
were corrected to Tidal blues (`rgba(12,51,87)` sidebar,
`rgba(15,53,87)` stage cards), the production build was
re-run (PASS), and the homepage was re-screenshotted and
its computed backgrounds verified
(`sidebar rgba(12,51,87,.97)`, `stage-card
rgba(15,53,87,.97)`). The full E2E suite ran before this
CSS-only correction; the correction touches no logic,
markup, or class names, and was verified by rebuild +
homepage + computed-style checks rather than a second
full E2E run. That distinction is stated, not hidden.

## Categories summary

- PASS: install, typecheck, lint, build, Python tests,
  evaluation, holdout, live API, all 26 browser checks,
  favicon, responsive overflow, reduced motion.
- FAIL: none in the final state.
- BLOCKED: none — no check was blocked by tooling or
  connectivity in this pass (the font host is unreachable
  in the sandbox, but that degrades to fallback fonts and
  does not block any check).
- NOT TESTED: CSV export end-to-end and review-bundle
  export end-to-end in this pass (code untouched, Step 8
  audit verified both); full keyboard walkthrough;
  screen-reader testing; Windows/macOS browsers; Node 20 /
  Python 3.10 minima; remote CI; any external or field
  validation. See FEATURE_PRESERVATION.md.
