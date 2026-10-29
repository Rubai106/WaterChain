# WaterChain Step 16 — Evidence Sensitivity Studio: Test Report

Supplied archive: `WaterChain_Step16_Decision_Sensitivity.zip`
(md5 `6634f5a3b9511c5f22830ccc0be6e7f0`), preserved untouched at
`~/workspace/waterchain-step16/original/`.
Working copy: the `waterchain-step16` project in this package.
Environment: Node v24.22.1, npm 10.9.4, Python 3.12.3, Ubuntu 24.04,
Chromium via Playwright `@playwright/test@1.55.0`, production server on
port 3107. All results below were executed in this pass; nothing is
carried over from the supplier's `STEP16_VERIFICATION.md` without
re-execution. Synthetic fixtures are developer-authored QA data, never
real water samples.

Status words: **PASS** = executed and passed; **FAIL** = executed and
failed; **BLOCKED** = could not run, with the reason; **NOT TESTED** =
not attempted.

The feature under test: `components/diagnostics/DecisionRobustnessStudio.tsx`
("Decision sensitivity", kicker "EVIDENCE STRESS TEST"). It lets a reviewer
select up to four currently engine-eligible, on-pathway positive/negative
records, then sends one temporary `/api/diagnose` request per selected
record with that record omitted (in explicit-journey mode the sampling
event referencing the omitted record is also removed). The original
evidence register and journey model are never modified. Results compare a
decision-category signature (attribution permission, confidence label,
first observed-positive stage, stage hypothesis states, lineage state)
between the baseline and each scenario.

## A. Basic operation — PASS

Verified against the running production app + real API + real Python
engine (`tests/e2e/decision-robustness.spec.ts`, 3/3 PASS in a real
Chromium):

1. Controlled investigation created; `clean.csv` imported (4 linked
   records, shared batch B-1, source SRC-1).
2. Baseline diagnostic review run through `/api/diagnose` → attribution
   permitted, "candidate transition only".
3. Sensitivity panel opened; eligible candidates listed as "Eligible
   positive/negative" with record codes QC-01…QC-04.
4. QC-01 and QC-04 selected (checkboxes labelled "Temporarily omit …").
5. "Run sensitivity test" → two scenarios complete (`2/2`).
6. Omission is by immutable internal record ID
   (`records.filter((item) => item.id !== record.id)`), not by display
   code; the sampling-event removal likewise keys on
   `event.evidenceRecordId !== record.id`. Confirmed by code inspection.
7. Original evidence unchanged after the run: the evidence register
   still lists QC-01 and QC-04 (asserted in the browser test).
8. Scenario results come from the actual `/api/diagnose` endpoint
   (real `fetch` POSTs, responses validated with
   `diagnosticApiResponseSchema`); no frontend approximation is used.
   A response that fails schema validation is surfaced as a failed
   scenario, not a result.
9. Baseline and scenario outputs include decision category
   ("Candidate transition permitted" / "Attribution withheld" /
   "Not assessed"), confidence label, conclusion text, stage hypothesis
   states, and lineage state; per-scenario cards show stage status
   diffs and the top findings.
10. Selection cap enforced: the checkbox disables once 4 are selected
    (`{selectedIds.length}/4 selected`); `toggleRecord` refuses a fifth
    (`if (current.length >= 4) return current`).

Wording audit (static inspection of the component, export payload, and
`STEP16_DECISION_ROBUSTNESS.md`): no invented probabilities, no
statistical-confidence language, no "robust" conclusion labels. Pills
read "Decision changed" / "Same decision category" / "Failed". The
method banner states: "This is a **single-record-omission analysis**,
not a physical-world counterfactual, probability, or statistical
robustness guarantee." The no-change interpretation reads: "This only
describes these specific tests; it is not a general robustness
guarantee." The export's `interpretation` field carries the same
limits. **PASS** — the feature does not describe an omission comparison
as a validated causal counterfactual.

## B. Decision-change cases — PASS (live API matrix)

Each case below was executed against the real API + engine on port 3107
on 2026-10-29 (probe script `/tmp/api_probe16.py` pattern; fixtures are
synthetic):

| # | Case | Baseline | After omission | UI verdict |
|---|------|----------|----------------|------------|
| 1 | Clean linked 4-stage pattern, omit the serving positive | attribution permitted, "candidate transition only" | attribution withheld, "insufficient evidence" | "Decision changed" |
| 2 | Same pattern, omit the source negative | permitted | withheld, "insufficient evidence" | "Decision changed" |
| 3 | Same pattern, omit the storage negative | permitted | withheld | "Decision changed" |
| 4 | Redundant independent evidence: extra serving positive present, omit one serving positive | permitted, "candidate transition only" | permitted, "candidate transition only" | "Same decision category" (correct: redundant evidence absorbs the omission) |
| 5 | Baseline already abstains (all negatives), omit one negative | withheld, "insufficient evidence" | withheld, "insufficient evidence" | "Same decision category" |
| 6 | Investigation with no eligible records | — | — | Panel shows "No eligible on-pathway observations to test. … This is not evidence that the pathway is safe." No scenario can run. |
| 7 | Incomplete pathway (one stage missing) | withheld | — | omission scenarios run against the same withheld baseline; engine `test_step16_sensitivity.py` covers the controlled 4-record baseline where each single omission withholds the candidate transition |

Cases 1–3 were additionally asserted end-to-end in the browser:
`decision-robustness.spec.ts` expects two `.pill-changed` ("Decision
changed") pills for the QC-01/QC-04 omissions — **PASS**.

The UI never labels a same-category outcome "robust"; the
interpretation text explicitly withholds any general robustness claim.
A stable categorical conclusion is presented as what it is — the
outcome of the tested omissions only.

## C. Record eligibility and pathway membership — PASS

Candidate selection is derived from the engine's own
`report.record_eligibility` array, filtered on
`eligible && on_pathway && (result_kind === 'positive' || 'negative')`
and joined to register records by immutable `record_id`. Verified by
code inspection of `DecisionRobustnessStudio.tsx`:

- Eligible positive on the selected pathway → selectable.
- Eligible positive NOT on the selected pathway (`on_pathway: false`)
  → excluded by the filter; cannot be selected.
- Positive with failed lab QC / missing required metadata /
  unsupported analyte / invalid quantitative value → the engine marks
  `eligible: false` (its own gate), so the record never appears as a
  candidate. A positive result the engine excludes is therefore not
  selectable as an eligible observation.
- Missing source / ambiguous journey / duplicate identifiers /
  unassessed stage → engine-excluded or off-pathway → not selectable.
- Omission is keyed on internal record ID, never on the display code.
- The API contract (`recordEligibilitySchema` in `lib/diagnostics.ts`)
  carries `record_id`, `eligible`, `on_pathway`, and `result_kind`
  from the engine itself — no eligibility or pathway membership is
  guessed from labels in the frontend.

Stale-report protection: the studio only renders inside the
`{report && !isStale}` branch of `DiagnosticWorkbench`; a stale report
unmounts the panel entirely (asserted: `#decision-robustness` count 0
after an evidence edit).

## D. Concurrency, stale data, and integrity — PASS

- **Double / repeated trigger:** the "Run sensitivity test" button is
  disabled while running; `runStressTest` additionally guards on a
  `runningRef` ref (added in this pass, D3) so two clicks within one
  render frame cannot start duplicate scenario runs.
- **Second analysis before the first completes:** blocked by the same
  guard; after completion, a new run resets results first
  (`setResults([])`).
- **Evidence change mid-run:** scenario payloads are built from the
  records/journey captured at run start; `testedFingerprint` is the
  input fingerprint at start. If evidence changes during the run,
  `isStale` becomes true, results render under a stale banner, and
  export is blocked.
- **Investigation switch mid-run:** `DiagnosticWorkbench` resets its
  report state on `workspaceId` change, which unmounts the studio;
  in-flight promises resolve against an unmounted component (no-op).
  Scenario requests are read-only POSTs to the stateless
  `/api/diagnose` endpoint and cannot write another investigation's
  state.
- **Edit immediately after results arrive / reload after a report:**
  any evidence or journey change flips `isStale`; the export button is
  disabled while stale. Sensitivity results are not persisted across
  reloads (only the diagnostic report cache is) — after reload the
  reviewer must re-run the test. This fails closed: no result can be
  mistaken for an analysis of a newer snapshot.
- **Tampered export:** the export now carries `contentSha256` over the
  scenario payload in addition to `evidenceSnapshotSha256` (added in
  this pass, D4). The in-app "Verify an exported sensitivity report"
  control recomputes both fingerprints: altered scenario content is
  reported as "altered after export"; a fingerprint that does not match
  the currently loaded evidence is reported as not current. Browser
  test: genuine export → "Verified:"; conclusion-tampered export →
  "altered after export" (**PASS**).
- **Diagnostic result change between requests:** each scenario is an
  independent request; results are compared against the baseline
  signature captured at run start, and stage diffs render per scenario.
- **API failure modes:** timeout (503 at ~15.3 s against a hanging
  engine), malformed engine output (503), missing Python (503), and
  schema-invalid responses all surface as failed scenarios
  ("Failed" pill + "Treat the sensitivity review as incomplete…"
  banner). A timeout is never interpreted as an abstention or a changed
  diagnosis — failed scenarios carry no decision category.

## E. Algorithm and report accuracy (Phase 3) — PASS by inspection + tests

- Baseline is the actual diagnostic API response already displayed in
  the workbench (`report` prop), not a re-derived approximation.
- Every omission scenario starts from the same baseline snapshot
  except the explicitly omitted record (and its sampling event in
  explicit-journey mode).
- Omission by immutable internal record ID (see §A.6).
- Deterministic for identical input and software version: the engine
  is a pure function of its input; `Promise.all` preserves scenario
  order.
- Failed/malformed/timeout responses never appear as valid scenario
  results (see §D).
- The report lists exactly which record IDs were omitted
  (`omittedRecordId` + `omittedRecordCode` + stage + result kind).
- Original evidence is never deleted or modified (asserted in browser).
- The SHA-256 fingerprint is computed over the tested input snapshot
  (`{records, journeyModel}`); export is blocked unless the current
  snapshot still matches the tested one.
- The export contains method, interpretation limits, per-scenario
  conclusions/findings/errors, and both fingerprints — understandable
  without the UI. Raw evidence values are not duplicated
  (`evidenceRecords` asserted absent in the browser test).
- The UI labels the method precisely as single-record-omission
  analysis; when more than four candidates exist it says: "choose at
  most four records per run… rerun with different selections to examine
  other records." No exhaustive-subset analysis is implied. Each
  omission is evaluated independently; combinations are not tested and
  the UI does not claim otherwise. Omission-only testing does not
  capture interactions between untested combinations — stated in the
  method banner.

## F. Regression tests added in this pass

- `engine/test_step16_sensitivity.py` (supplied, 4 tests) — re-run:
  **4/4 PASS** as part of the 83-test engine suite.
- `tests/e2e/decision-robustness.spec.ts` — extended: asserts two
  "Decision changed" pills end-to-end, and a new third test covers
  export verification (genuine export verifies; tampered export
  flagged). **3/3 PASS** in real Chromium against the production build.

## G. Known limits (not defects)

- At most four omission scenarios per run; combinations of omissions
  are not evaluated.
- The same deterministic rule engine is used for baseline and
  scenarios — this is a sensitivity check on the engine's evidence
  dependence, not independent scientific validation.
- Sensitivity results are session-local; they do not persist across
  reloads and cannot be attached as structured follow-up actions —
  they can be referenced manually via the exported file's fingerprint.
- No probabilities, confidence intervals, costs, or causal claims are
  produced by design.
