# WaterChain Step 12 — Scientific Validation Report

This report states what Step 12 actually demonstrates, what it does not, and
what would be needed to claim more. It is written from executed tests, not
from the feature list. Synthetic evaluation figures below are conformance to
developer-authored fixtures; they are not real-world accuracy.

## 1. The scientific question Step 12 answers

Can drinking-water evidence be connected into one defensible candidate
journey when separate sample bottles are linked by documented relationships,
instead of by assuming one batch ID persists across all four stages?

Step 12's answer is a workflow, not a discovery: a typed relationship model
(source, journey, sampling event, water/container entity, adjacent transfer,
provenance artifact, audit event), record-level eligibility gates, a bounded
0/1/2+ route resolver, abstention on missing or ambiguous relationships, and
a reasoned next-action planner. The potentially distinctive contribution is
the integration of those pieces with reproducible evidence bundles — not any
single piece, each of which has established precedent (see
`validation/STEP12_NOVELTY_AND_PRIOR_ART.md`). No global novelty,
patentability, or freedom-to-operate claim is made.

## 2. Relationship model vs the previous single-batch model

Direct comparison on controlled cases (all executed against
`engine/diagnose.py` in this audit):

| Case | Single-batch mode | Explicit-journey mode |
|---|---|---|
| Four stages, four different batch IDs, documented links and transfers | Abstains (no shared batch) | Candidate transition (path 1) |
| Four stages sharing one batch ID | Candidate transition | Candidate transition (legacy mode still available) |
| Positive from an unrelated batch/journey | Excluded from pathway, labelled off-pathway | Excluded from pathway hypotheses; conclusion names the outside positive explicitly |
| Two complete entity routes through one investigation | Abstains (multiple common batches) | Abstains (path_count 2 sentinel) |
| One complete route plus an incomplete extra branch | Attributes on the shared batch only | Attributes on the resolved path |
| One complete route plus a weakly linked extra event | Attributes on the shared batch only | Abstains (conservative: unresolved links are not masked) |
| Source ID on samples differs from the registered source | Warning only in legacy mode | Blocks attribution (`journey_source_identifier_mismatch`) |
| Sample bottle reused as two stages | Blocks (sample identity reused) | Blocks (same engine gate) |

The journey model is strictly more expressive on the first, fifth, and sixth
rows and strictly more conservative on source mismatch. It does not weaken
any legacy gate: QC, method, timestamp, analyte, duplicate-identity,
discordance, chronology, and bracketing rules apply identically in both
modes, and no diagnostic rule was changed to improve a test score in this
audit (the only engine changes flag previously silent transfer-row problems
as blockers).

## 3. What the synthetic evaluations prove — and what they do not

- `engine/evaluate.py` (15 controlled scenarios): expected-decision fixture
  accuracy 100%, attribution coverage 20%, correct abstention 100%,
  unsupported attribution 0%. A naive first-positive baseline scores 26.7%
  accuracy with 91.7% unsupported attribution on should-abstain cases.
- `engine/run_holdout_validation.py` (16 held-out scenarios): 100%
  expected-decision conformance, 0/13 unsupported attributions.

What this proves: the rule set behaves as specified on scenarios its own
authors wrote, and it abstains far more conservatively than a naive
positive-chasing baseline. What it does not prove: sensitivity,
specificity, calibration, or any real-world accuracy; the fixtures encode
the authors' own interpretation rules, so conformance is circular by
construction. The 20% attribution coverage is a feature, not a failure: the
engine is designed to say "insufficient evidence" most of the time.

## 4. Abstention and interpretation discipline (verified)

- A positive result is always reported as an *observation*, never as proof
  of origin. Candidate transitions require eligible negatives bracketing
  every earlier stage; a positive at source yields "origin timing
  unresolved", not attribution.
- A negative result is never reported as proof of cleanliness; every
  hypothesis explanation states this explicitly.
- Missing data is never shown as negative, clean, or verified; stages with
  no eligible record are "not_assessed".
- The UI takes stage states only from the engine's `record_eligibility`
  output; it never infers eligibility from raw results.
- No numerical confidence or probability is produced anywhere; the only
  confidence labels are qualitative ("candidate transition only",
  "insufficient evidence", "not assessed", "observed at source; origin
  timing unresolved").
- Documentation is treated as user-entered attestation, not authentication:
  the model records *what was reported and how it was supported*, and every
  report states that references and hashes do not authenticate a document,
  lab, person, or time.

## 5. Implemented, validated, and conceptual — kept separate

Implemented and tested in this audit: relationship model + route resolver +
abstention, eligibility gates, next-action planner, provenance vault
(IndexedDB, 10 MB, SHA-256 + size re-check before download), hash-linked
local audit ledger (live + exported-file verification), Uganda adapter
(descriptive profiling, join audit, TNTC censoring, blank QC signals).

Implemented but NOT validated: any claim about field performance,
investigator time saved, or decisions improved versus a manual baseline;
multi-user behaviour; the Supabase schema (reference migration only, never
applied to a live database).

Conceptual / not present: authenticated identity, server-signed audit,
digital-signature verification, cloud sync, probabilistic or ML diagnosis,
causal ground-truth labels for observational data.

## 6. The Uganda dataset — what it can and cannot support

The adapter profiles the published observational dataset (see
`RESEARCH_DATA_AUDIT.md` for the full-data run in this audit). What the
dataset supports: descriptive sample-type summaries, within-visit
transport/storage pair descriptions for exactly-matched pairs, join-quality
and laboratory-blank auditing, and data-quality robustness testing of the
adapter itself. What it cannot support: causal contamination-entry labels.
A `visit_id` joins a bottle to a field visit; it does not prove a physical
transfer between two bottles, and households sharing a borehole `source_name`
are not a verified unique water journey. Any future use of this dataset to
evaluate the diagnostic engine must use it only for descriptive and
robustness checks unless an independent reference method establishes ground
truth — which the dataset does not contain.

## 7. The most meaningful next evaluation

A blinded, controlled study with a WASH/laboratory collaborator, in this
order:

1. **Relationship reconstruction on known ground truth.** Field teams
   document real transfer histories (container IDs, handover times) for a
   set of household journeys; WaterChain's resolver is scored on whether it
   reconstructs the documented route, abstains on deliberately corrupted or
   ambiguous ledgers, and never invents a route. Success criterion: zero
   unsupported attributions on corrupted/ambiguous cases, not high
   attribution coverage.
2. **Baseline comparison.** The same investigators work matched cases with
   (a) their current spreadsheet/manual workflow and (b) WaterChain.
   Measure: investigator time per case, metadata errors caught before
   reporting, unsupported conclusions avoided, and whether the planner's
   recommended next action was the action actually taken and useful.
   WaterChain wins only if it reduces unsupported conclusions without
   increasing time or missing real positives.
3. **Independent review.** A WASH/public-health and a laboratory-method
   reviewer audit the eligibility gates and interpretation wording against
   WHO water-safety-plan practice before any operational use.

Until (1)–(3) exist, WaterChain Step 12 is a scientifically disciplined
prototype: credible for a competition demonstration and for a pilot with an
expert collaborator, not for operational deployment or public-health
decisions.

---

## Step 16 addendum — Decision Sensitivity Studio (2026-10-29)

The Step 16 sensitivity feature was independently audited (full report:
`SENSITIVITY_TEST_REPORT.md`). Scientific assessment:

- The feature is an **evidence-availability sensitivity check**, not a
  physical-world counterfactual, calibrated probability, statistical
  robustness guarantee, or proof of causation. It reruns the same
  deterministic rule engine with one eligible record removed and
  reports whether the decision-category signature changes. The UI,
  export payload, and documentation all state these limits explicitly;
  no "robust" conclusion labels and no invented probabilities were
  found in the wording audit.
- Omission is keyed on immutable internal record IDs from the engine's
  own per-record eligibility output — the frontend does not guess
  eligibility or pathway membership from labels.
- The evaluation figures are unchanged (synthetic evaluation 100.0% /
  20.0% / 100.0% / 0.0%; holdout 16/16, 0/13) because no diagnostic
  rule was modified. These figures measure conformance to
  developer-authored fixtures, not real-world accuracy — that
  limitation is unchanged by Step 16.
- The recommended next evaluation from Step 12 stands: a blinded
  reconstruction study on documented transfer histories, a baseline
  comparison on investigator time and unsupported conclusions avoided,
  and independent WASH/laboratory review before any operational use.
  The sensitivity studio does not substitute for any of these.

Until (1)–(3) from the Step 12 section exist, WaterChain Step 16
remains a scientifically disciplined prototype: credible for a
competition demonstration and for a pilot with an expert collaborator,
not for operational deployment or public-health decisions.
