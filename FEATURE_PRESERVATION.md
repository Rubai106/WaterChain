# WaterChain Refinement Pass 2 — Feature Preservation Report

Method: the pass changed only `app/globals.css`,
`app/page.tsx` (pathway presentation only),
`components/BrandMark.tsx` (colours only), and docs.
`lib/`, `engine/`, `app/api/diagnose/route.ts`,
`components/diagnostics/`, and `components/evidence/`
are byte-identical to the Pass 1 ZIP (verified by diff).
Every workflow below was then re-checked live against
the refined production build.

| Workflow | How checked (refined build) | Result |
|---|---|---|
| Investigation create + select + switch | Browser: created QA Cases A, B, C; switched A→B→C→A via sidebar select | PASS — selection, breadcrumb, isolation correct |
| Case isolation (evidence + reports) | Case B/C created after A had records + a report; switch-back to A | PASS — B/C empty of A records; A records intact on return |
| Evidence manual entry | Browser: added QA-EXTRA (serving, not_detected, full QC pass) | PASS — record saved, register updated, stale triggered |
| CSV import (linked 4-record QA case) | Browser: imported linked.csv (QA-01…QA-04, shared batch B-1) | PASS — preview then 4 records in register |
| CSV import, conflicting case | Browser: imported discord.csv (5 records, Serving both detected + not_detected) | PASS — imported; engine blocker, not a UI error |
| CSV import, incomplete case | Browser: imported single.csv (Source only) | PASS — only Source assessed |
| CSV rejection: duplicate record codes | Browser: dup.csv (same code twice) | PASS — duplicate error shown, no import |
| CSV rejection: unknown header | Browser: badheader.csv (`surprise_column`) | PASS — "Unsupported CSV column" error |
| CSV export | Toolbar control, code untouched | NOT RE-TESTED end-to-end this pass (Step 8 audit verified it) |
| Diagnostic review, empty case | Browser: ran review with 0 records | PASS — abstention "No evidence records supplied" |
| Diagnostic review, linked case | Browser + API: 4 linked records | PASS — candidate transition at Serving, `attribution_permitted: true`, confidence "candidate transition only", hypotheses: source/collection/storage no_positive_observed, serving observed_positive |
| Diagnostic review, conflicting case | Browser + API: discordant Serving | PASS — `attribution_permitted: false`, finding `discordant_stage_results`, UI shows "has not permitted" + "Both positive and not-detected outcomes are present at Serving" |
| Diagnostic review, incomplete case | Browser: Source-only records | PASS — abstains, no candidate transition claimed |
| Pathway signals, empty | Browser, no records | PASS — all 4 stages "Unassessed" |
| Pathway signals, linked | Browser, linked case | PASS — Limited metadata ×3, "Positive on file" at Serving; no stage labelled contaminated/proven source |
| Pathway signals, conflicting | Browser, discordant case | PASS — Serving still only "Positive on file" (observation), engine blocker carries the verdict |
| Pathway signals, incomplete | Browser, Source-only case | PASS — only Source assessed, other 3 "Unassessed" |
| Pathway selection | Browser: clicked Serving card | PASS — `stage-selected` class + `aria-pressed`, existing notice text shown |
| Pathway ribbon | Browser, desktop 1280px + mobile 390px | PASS — visible on desktop, hidden on mobile (stacked nodes), flow animation off under reduced motion |
| Report persistence across reload | Browser: reloaded after a successful review | PASS — report reappeared (Step 9 cache) |
| Report persistence across switches | Browser: A→B→C→A | PASS — per-case reports preserved; no cross-case leakage observed |
| Stale-report protection | Browser: added a record after a review | PASS — stale banner shown, bundle export disabled |
| JSON backup export | Browser: "JSON backup" button in register toolbar | PASS — file downloaded |
| Backup restore as separate investigation | Browser: restored the downloaded backup | PASS — dialog offered separate investigation; restored copy became active, originals unchanged |
| Review-bundle export (fresh report) | Button enabled only when not stale; export path untouched | NOT RE-TESTED end-to-end this pass (Step 8 audit verified bundle + SHA; stale-disable verified here) |
| Python engine + evaluations | `unittest`, `evaluate.py`, `run_holdout_validation.py` | PASS — 40/40, evaluation 100% / 20.0% / 100% (WaterChain block; naive baseline block unchanged), holdout 100% conformance, 0/13 unsupported |
| Responsive layout | Chromium desktop 1280px + mobile 390×844 | PASS — 0px horizontal overflow both; hero visible on mobile; pathway stacks vertically |
| Reduced motion | `prefers-reduced-motion: reduce` emulation | PASS — hero wave and ribbon-flow animation computed as `none` |
| Keyboard focus | Stylesheet focus-visible outline `#0F6B8A` + offset, incl. stage cards | PARTIAL — focus ring present by stylesheet; no full keyboard walkthrough run this pass |
| Favicon / branding | HTTP + page head + source audit | PASS — `/favicon.ico` 200, brand SVG in sidebar + hero, no Claude/framework/template branding found |
| Console / page errors | Browser run, pageerror listener | PASS — 0 page errors (Google Fonts fetch fails offline in the sandbox; fallback fonts render, cosmetic only) |

## Known limitations carried over (not introduced by this pass)

- No focus trap / Escape handling in dialogs; no
  screen-reader walkthrough run; Windows/macOS browsers
  not exercised (Chromium only); Node 20 / Python 3.10
  minima not re-tested (this run: Node 24 / Python
  3.12); remote CI not run; no external review or
  field validation (unchanged claims).
- Diagnostic reports persist per investigation in this
  browser (Step 9 cache) but are not server-side;
  clearing site data still deletes investigations.
- The pre-existing `react-hooks/exhaustive-deps`
  warning in `app/page.tsx` (line shifted 127 → 129
  because a state line was added) is unchanged in
  nature; it is a lint warning, not an error, and the
  behaviour it warns about predates both redesigns.
