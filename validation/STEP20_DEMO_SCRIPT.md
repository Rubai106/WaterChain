# WaterChain Step 20 — Competition demonstration script (repeatable, Step 20)

Time: ~5 minutes. Golden rule: **every record shown is a clearly labeled
synthetic fixture** (filenames and the fixture banner say so). Never present a
fixture as a real household or laboratory record. If authorized real records
are available, swap the fixtures but keep the same six beats.

Setup: `npm run build && npm run start -- -p 3107` (or `npm run dev`); open the
app; use a fresh browser profile or clear site data so no old investigations
appear. Fixtures live in `tests/e2e/fixtures/`.

## 1. A linked water journey (0:00-1:00)

- Open by naming the gap: "EPA's WQX standardizes water data sharing, mWater
  and LIMS tools collect and track samples — none of them tells a reviewer
  whether a handful of results jointly support a contamination claim. That
  review step, done informally in spreadsheets, is what WaterChain is."
- Create investigation "Demo — linked journey".
- Import `tests/e2e/fixtures/linked.csv` (4 stages, one batch B-1, source SRC-1).
- Run diagnostic review. Read the conclusion aloud: candidate transition at
  Serving, "not definitive causal proof". Point at the pathway ribbon and the
  eligible-record table.
- Say: "The engine only speaks when lineage, QC, method, and timestamps all
  check out — and even then it names a candidate, not a culprit."

## 2. An unrelated positive result (1:00-2:00)

- Create investigation "Demo — unrelated positive".
- Import `tests/e2e/fixtures/audit-offpath-plus-linked.csv` (or import
  `linked.csv` plus a serving positive with a different batch/source).
- Run review. Show that the off-pathway positive is listed as an observation,
  explicitly excluded from the pathway, and does not change the conclusion.
- Say: "A positive result is not automatically evidence of this pathway."

## 3. A failed-QC result (2:00-2:45)

- In the same or a new investigation, import
  `tests/e2e/fixtures/blocked-positive.csv` (the serving positive has
  blankControl=fail).
- Run review. Show the exclusion, the `record_excluded` blocker, and the
  abstention. Open the audit ledger entry.
- Say: "Failed lab QC removes the record from inference entirely. The correct
  answer here is 'I cannot conclude', not a forced suspect."

## 4. Sensitivity analysis (2:45-3:45)

- Return to "Demo — linked journey". Open the Evidence Sensitivity Studio
  (Decision Robustness panel).
- Select the serving positive record; run. Show "Decision changed" when it is
  omitted — the conclusion depends on that single observation.
- Then show the studio's wording: no probabilities, no "robust" label, and
  the explicit note that omission-only testing does not capture interactions.
- Say: "This answers 'what is this conclusion standing on?' — not 'how
  confident are we?'"

## 5. A justified follow-up action and a readable case report (3:45-4:30)

- Open the ActionLoop from the review (or the planner's "guided next action").
- Create an action from the failed-QC finding, assign an owner and due date,
  attach the record reference, and request independent verification.
- Show the action history: creation, verification request, and that a stale
  underlying report flags the action.
- Click "Export readable case report" and show the Markdown: conclusion,
  per-record eligibility with exclusion reasons, unresolved findings, and the
  engine's own limitations — the uncertainty travels with the conclusion.
- Say: "Every follow-up is traceable to evidence, actions go stale when the
  evidence changes, and the report a reviewer reads contains the unknowns,
  not just the headline."

## 6. Final limitation statement (4:30-5:00) — read verbatim

> "WaterChain is a research prototype. It checks whether documented evidence
> is sufficient to discuss a candidate contamination pathway; it does not
> certify water safety, prove causation, or replace laboratory or field
> expertise. Its checks were built and tested on synthetic fixtures — nothing
> you saw today is a real household sample or a real lab result, and the
> system must not be used to make operational decisions about drinking water
> without qualified human review. The comparison and review materials in the
> project package document exactly what was tested and what remains
> unvalidated."

## Demo checklist

- [ ] Machine quiet, >2 GB free RAM (the test/build pipeline is memory-hungry).
- [ ] `npm ci`, typecheck, lint (0 errors), and `npm run build` all pass on the
      demo machine; app served from the production build.
- [ ] Playwright suite green on the demo machine (sequential, 1 worker).
- [ ] Fresh browser profile; no old investigations visible.
- [ ] Fixtures verified present: linked.csv, blocked-positive.csv,
      audit-offpath-plus-linked.csv, single.csv.
- [ ] All fixture records show the synthetic-fixture banner; state this aloud
      at the start.
- [ ] "Export readable case report" produces the Markdown with eligibility,
      findings, and limitations sections.
- [ ] Each of the six beats rehearsed once end-to-end (dry run <= 5 min).
- [ ] Limitation statement (beat 6) read verbatim, not paraphrased.
- [ ] If judges ask about accuracy: answer only with the documented figures —
      "0% unsupported attributions on 9 should-abstain synthetic fixtures;
      field validation has not been performed."
- [ ] If judges ask "what's new vs existing tools": cite the prior-art matrix —
      integration of eligibility gates, identity/transfer reasoning, explicit
      abstention, and reviewable follow-ups for the interpretive step, not a
      claim that any single mechanism is unprecedented.
