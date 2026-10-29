# WaterChain Step 19 — readiness, evidence matrix, and scorecard

**Assessment date:** 2026-10-29  
**Status:** competition-demo candidate with precautions; supervised expert review prototype; not operationally deployable.  
**Score target:** 55+/60 is an aspiration under an illustrative six-dimension equal-weight rubric, not an official or guaranteed judge score.

## 1. Confirmed from supplied Step 18 artifacts

- Python engine suite: 91 tests reported by the Step 18 report; re-executed in this Step 19 environment.
- Dataset adapter suite: 12 tests reported; re-executed in this Step 19 environment.
- Step 18 comparative harness has 13 developer-authored adversarial cases. Its stored JSON report is `via_api: false`, indicating that particular stored artifact is the in-process run. The separate `../docs/history/TEST_REPORT_STEP18.md` reports a prior production API run with 12/12 JSON-carryable scenarios matching. Keep those two pieces of evidence separate; do not label the stored JSON itself as an API run.
- Stored fixture result: 0/9 unsupported attributions by WaterChain and 8/9 by the naive first-positive baseline (88.9%), on cases where the author rubric expects abstention. This baseline is deliberately weak and the fixtures were developer-authored with knowledge of the engine. The result is fixture conformance, not real-world accuracy and not a fair comparison against a competent manual workflow.
- Real-data profile describes published observational Water Quality Uganda data. Its joins/QC summaries are data-quality observations only and do not establish causal truth or field effectiveness.
- Blind reviewer packet has 13 Step 18 synthetic cases with per-case record hashes and no expected decisions exposed. Reviewer response remains pending.
- User-evaluation protocol plus two isomorphic synthetic task sets, planned balanced assignment matrix, standardized spreadsheet workflow, response capture template, and paired analysis tool are now prepared. No participants were recruited or tested.

## 2. Scorecard: evidence level, not marketing points

This scorecard is for internal planning, not official scoring.

| Dimension | Provisional estimate /10 | Evidence presently available | Biggest remaining gap |
|---|---:|---|---|
| Novelty | 7–8 | Integrated relationship/identity/QC gates, explicit abstention, traceable follow-up and audit workflow; limited prior-art note | Independent comparison to current tools/workflows; no global novelty claim defensible |
| Practicality | 7–8 | Repeatable local demo path; user workflow and manual comparator protocols prepared | Actual independent review and task-based usability evidence |
| Impact | 6.5–7.5 | Clear water-quality evidence-management problem and SDG 6 relevance | No measured reduction in unsupported decisions, time, cost, or field burden |
| Implementation | 8–9 | Engine, adapter, browser and build results documented; engine and adapter rerun in this environment | Re-run full npm typecheck/lint/build/E2E in this environment; production security/multi-user architecture remains absent |
| Presentation | 8–9 | Six-beat demo script, demo checklist, report draft and synthetic disclosures | Fresh-browser rehearsal on demo machine; final report polish and stable demo |
| SDG alignment | 8.5–9 | Directly framed around evidence discipline in drinking-water investigations and SDG 6 | Keep outcomes framed as potential contribution; do not claim measured SDG impact |

**Working equivalent estimate: roughly 48–50/60.** This estimate is not validated by judges and depends on the rubric being equally weighted. A 55+ result is not yet evidenced.

## 3. Evidence gates before any score increase

### Gate A — technical and workflow integrity

- [x] Engine tests rerun in Step 19 environment.
- [x] Dataset-adapter tests rerun in Step 19 environment.
- [ ] Dependency install, typecheck, lint, production build, and Playwright workflow re-run in Step 19 environment.
- [ ] Full five-minute demo replayed on the actual judging hardware from a fresh browser profile.

### Gate B — independent review

- [x] Reviewer-only handoff package prepared without implementation/source and answer key.
- [x] Scoring tool checks packet hashes, input consistency and completeness.
- [ ] At least one qualified independent reviewer returns a frozen response.
- [ ] Disagreements reviewed and documented; no rule changes without regression tests.

### Gate C — manual-workflow comparison

- [x] Two synthetic isomorphic task sets and structured spreadsheet baseline prepared.
- [x] Planned order/task assignment matrix balanced for 12 codes; it is not participant data.
- [x] Response capture and paired descriptive analysis scripts prepared.
- [ ] Domain reviewer inspects the developer-authored task answer keys.
- [ ] Recruit consenting participants and run the protocol; report null/negative findings, missingness, and descriptive intervals.

### Gate D — final submission

- [ ] Final concise report and 1-page evidence/limitations summary reviewed for claim consistency.
- [ ] Confirm that every quantitative claim cites an artifact and marks the result as synthetic, observational, or actual human evaluation.
- [ ] Avoid saying that WaterChain identifies a proven contamination cause, certifies water safety, or is production-ready.

## 4. Unresolved deployment blockers

- Browser-local storage is not a secure shared authority; multi-user authentication and authorization are not wired.
- Supabase migration is an unconnected reference rather than a verified production backend.
- Operational data governance, audit access controls, backup/restore, threat model, deployment smoke tests and incident response are incomplete.
- No field or laboratory validation exists. The application must not be used for operational drinking-water decisions without a qualified expert review and appropriate validated methods.

## 5. Next actions by value

1. Contact a qualified external reviewer using `INDEPENDENT_REVIEW_INVITATION.md` and send only the blind handoff ZIP.
2. Re-run the full frontend checks where npm dependencies and Playwright browsers are available, then perform the five-minute demo rehearsal.
3. Have a domain reviewer inspect the study answer keys before recruiting the pilot sample.
4. Only after actual review/session data exist, run the scoring tools and revise the scorecard based on those results.

## Claims that must not appear in the submission

- “WaterChain is 100% accurate.”
- “WaterChain is validated in the field.”
- “The tool proves which stage caused contamination.”
- “The product is operationally deployable.”
- “The 88.9% baseline failure proves superiority over experts or spreadsheet-based workflows.”
