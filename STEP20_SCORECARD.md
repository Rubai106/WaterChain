# STEP20_SCORECARD.md — WaterChain evidence-linked scorecard

**Date:** 2026-10-29. **Internal model only:** 10 points per dimension, 60 total, equal weights.
The published criteria specify no numerical weights — this model is for planning, not an official score.
No point is awarded for a feature merely existing; each point cites executed evidence.

## Scores

| # | Dimension | Score /10 | Evidence (executed, this release unless noted) | Biggest weakness | What would raise it |
|---|---|---:|---|---|---|
| 1 | Novelty | **8** | `STEP20_PRIOR_ART_MATRIX.md`: 5 categories, 10+ documented alternatives (EPA WQX/WQP, mWater, LIMS/CoC, WHO WSP + sanitary inspection, KoboToolbox/Akvo FLOW, manual spreadsheets), all sources accessed 2026-10-29; differentiation argument = integration of eligibility gates + identity/transfer reasoning + explicit abstention + reviewable follow-ups for the interpretive review step, with no claim that any single mechanism is unprecedented | No independent expert has confirmed the differentiation; no patent search | External reviewer agreement (+1); a second independent prior-art confirmation (+0.5) |
| 2 | Practicality | **8** | Complete repeatable workflow (guided next action, CSV import with validation, readable case-report export new in Step 20); real published Uganda data profiled with provenance; blind-review packet + user-study protocol + analysis tooling all prepared and hash-verified; demo script with low-memory fallback | No independent reviewer response; no participant sessions; demo not yet rehearsed on judging hardware | One real external review (+1); pilot sessions with real descriptive results (+1–2) |
| 3 | Impact | **7** | 0% unsupported-attribution / 100% correct-abstention on 13 adversarial fixtures (fixture conformance, disclosed); plausible SDG 6 pathway (Target 6.3/6.1 wording verified from UN sources); honest potential-not-measured framing in all materials | No measured reduction in unsupported decisions, time, or cost by real users; no field or health outcomes | Real user-study data showing fewer unsupported conclusions (+2); expert review agreement (+1) |
| 4 | Implementation | **9** | Fresh: `npm ci` ✓, typecheck ✓, lint 0 errors ✓, production build ✓; engine 91/91; adapter 12/12; review tooling 8/8 + 12/12 Node; synthetic eval 100/100/0%; comparison reproduced in-process AND through the live API (12/12); adversarial API probes fail closed with no evidence leakage; Playwright vs supplied tree **running** (was 65/65 composed in Step 18) | Browser-local storage only; Supabase migration unconnected; no multi-user auth; ~1 GB RAM forced sequential runs | Full Playwright green on this tree (+0.5); none of the structural limits are fixable pre-submission |
| 5 | Presentation | **8** | 5-minute repeatable demo script (six beats + verbatim limitation statement + low-memory fallback); two-page report draft; registration abstract; one-page visual evidence summary; judging evidence matrix below | Not yet rehearsed live on demo hardware; report is Markdown, not a rendered 2-page A4 PDF | Live rehearsal with timing (+1); rendered 2-page PDF checked for fit (+0.5) |
| 6 | SDG alignment | **9** | SDG 6.3/6.1 target wording verified against UN sources (unstats.un.org, pacific.un.org); contribution framed as *potential* evidence-discipline improvement for contamination investigations; explicit non-claims (no pollution reduction, no safety certification) | No measured SDG impact exists or could exist for a prototype | Field or pilot evidence of use in a real program (+1, not feasible pre-submission) |

**Working total: 49/60.** Below the 55 target. The gap is external evidence (independent review, user study, live rehearsal), not missing code. The brief's improvement loop was applied: the highest-value feasible code change (readable case-report export, Phase D.C) was implemented with regression tests; remaining high-value items are external actions documented below.

## Judging evidence matrix

| Criterion | Product behavior supporting the claim | Source / artifact | Current weakness | Remaining work | Why the score is defensible |
|---|---|---|---|---|---|
| Novelty | Reviewer-facing integration: eligibility gates, identity/transfer reasoning, abstention with named reasons, unresolved-evidence explanations, traceable follow-ups, reproducible artifacts | `STEP20_PRIOR_ART_MATRIX.md`; `engine/diagnose.py`; `TEST_REPORT_STEP20.md` §comparison | No independent confirmation | External reviewer on differentiation | Differentiation is documented against real alternatives with a deliberately modest claim |
| Practicality | End-to-end investigation workflow usable offline; guided next actions; validated import; readable exports | App + `STEP20_DEMO_SCRIPT.md`; Playwright results | No real-user data | Recruit reviewers/participants | Workflow is complete and verified; usefulness to others is unmeasured |
| Impact | Withholds unsupported attributions (0% on adversarial fixtures); flags QC/identity/lineage gaps; plausible remediation-efficiency pathway | `engine/step18_comparison_report.json` (+fresh rerun); real-data profile | Synthetic-only evidence | User study, field pilot | The measured outcome is real but narrowly scoped; no overclaim |
| Implementation | Reproducible toolchain: clean install, typecheck, lint, build, 91 engine + 12 adapter + 8 tooling tests, API parity, fail-closed probes | `STEP20_BASELINE.md`; `TEST_REPORT_STEP20.md` | Single-user prototype architecture | None feasible pre-submission | Everything claimed was executed and observed on this tree |
| Presentation | Six-beat demo, 2-page report, abstract, evidence summary, verbatim limits | `validation/STEP20_*.md` | Not rehearsed on hardware | Live rehearsal | Materials are complete and claim-consistent |
| SDG alignment | Targets 6.3/6.1 correctly cited; offline design for low-resource settings; honest potential-not-measured scope | `STEP20_PROJECT_REPORT.md` §5; UN sources | No measured impact | Field evaluation | Alignment is specific, correctly worded, and honestly bounded |

## Improvement loop log (this pass)

1. **Weakness addressed:** no human-readable case export (Phase D.C gap) → implemented `lib/case-report.ts` + workbench export button; regression spec `tests/e2e/case-report.spec.ts` (R1 content, R2 stale-disable). Typecheck + lint clean; browser test pending.
2. **Weakness addressed:** novelty argument rested on a Step 12 note → `STEP20_PRIOR_ART_MATRIX.md` built from fresh 2026-10-29 research across 5 categories.
3. **Weakness addressed:** Step 19 frontend verification was BLOCKED → closed: `npm ci`, typecheck, lint, build all PASS on this tree; comparison re-run in-process AND via live API.
4. **Next highest-value tasks (external, pending):** send blind-review handoff to a qualified reviewer; recruit pilot participants; rehearse demo on judging hardware; render the 2-page report to A4 PDF and check fit.
5. **Not done (by design):** no new dashboard/AI/cloud features; no diagnostic rule changes; no score inflation — the 49/60 stands until external evidence exists.
