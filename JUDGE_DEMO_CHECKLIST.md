# WaterChain — Judge-Demo Checklist (repeatable, truthful)

Time: about 3 minutes live, plus the setup checks below. The
golden rule, from `validation/JUDGE_DEMO_GUIDE.md`, still
applies: **never present a synthetic fixture, QA test record,
or imported example as a real household or laboratory record.**
If you have no records you are authorised to show, demo the
empty-investigation path and the terminal synthetic evaluation
— that is a complete, honest demo.

## Setup (do this before the audience arrives)

- [ ] `npm install`, `npm run typecheck`, `npm run lint`,
      `npm run build` all pass (see `STARTUP_GUIDE.md`).
- [ ] Python checks pass: 40 tests, evaluation 15 fixtures,
      holdout 16/16 (synthetic only — say so if asked).
- [ ] Start the app (`npm run dev` or `npm run build` +
      `npm run start`) and open <http://localhost:3000>.
- [ ] Confirm Python is found: create a throwaway empty
      investigation, run a diagnostic review, and expect the
      abstention "No evidence records supplied" — not an
      engine error. Delete the throwaway investigation
      afterwards by clearing site data, or simply leave it
      empty and name it clearly as a check.
- [ ] If you will show real records, confirm you have
      permission to show them and that household-identifying
      details are omitted. Otherwise, stay on the empty path.

## Live walkthrough (3 minutes)

### 0:00–0:30 — The problem, in one sentence

"WaterChain checks whether documented water-sample evidence is
sufficient to discuss a candidate contamination pathway —
source → collection → storage → serving — and it abstains
when it is not. It is not a water-safety certification tool
and it does not prove causation."

### 0:30–1:10 — Case isolation (no fabricated data needed)

1. Create investigation "Demo — household review" (or your
   authorised case name). Note aloud: "No samples or results
   are generated — the register starts empty."
2. Create a second empty investigation, switch to it, and
   show it is empty. Switch back: the first case is
   untouched. Reload the page: both cases persist.
3. Point to the inspector: "Missing information stays
   missing. The system does not invent results."

### 1:10–2:10 — Run a diagnostic review

- **With authorised records:** run the review on the current
  investigation. Read the conclusion aloud exactly as written,
  including its limits. If it abstains, say so proudly:
  "Abstention is the correct outcome for incomplete evidence."
  Show eligible vs excluded records, the shared-batch lineage
  note, and the recommended next evidence step.
- **Without authorised records:** run the review on the empty
  investigation and show the abstention. Then, in the
  terminal, run `python engine/evaluate.py` and explain:
  "These 15 scenarios are developer-authored software tests
  only. They are not real samples and they do not measure
  real-world accuracy."

### 2:10–2:40 — Traceability (and the stale-report guard)

1. With a fresh (non-stale) report, export the review bundle.
   Show: investigation name/ID, request ID, engine name,
   evidence SHA-256, and the exact submitted records.
   Say: "The hash detects changes to this snapshot; it does
   not authenticate the truth of a record."
2. Add or remove one record (on a rehearsal copy, not on
   real evidence you must preserve) and show the stale banner
   and the disabled export button. Re-run to clear it.
   This is the guard that stops an old report being exported
   as current.

### 2:40–3:00 — Limits, stated plainly

- "Validation so far is synthetic fixtures and adversarial
  tests. No independent external reviewer and no field study
  has been completed."
- "Batch IDs and source labels are user-entered metadata.
  They are not authenticated, and the four-stage model
  simplifies real journeys with refills, mixing, or branches."
- "Case data lives in this browser only. There is no
  server-side case database, sign-in, or sync."

## If something goes wrong live

- Diagnostic error box instead of a report → Python is not
  reachable by the server. Say so, show the setup step in
  `STARTUP_GUIDE.md` section 4, and fall back to the empty
  abstention + terminal evaluation. Do not improvise a result.
- A report disappears after switching investigations → that
  is by design (reports are not persisted; evidence is).
  Re-run the review on the selected investigation.
- A restored bundle is rejected for a fingerprint mismatch →
  its records were edited after export. Re-export from the
  source investigation; do not hand-edit bundles.

## Questions to expect (short answers)

- **Can it prove which stage introduced contamination?** No.
  At best a candidate transition interval under strict
  assumptions, still requiring independent review.
- **What is novel?** The integrated evidence-integrity and
  lineage gate with explicit abstention — not probabilistic
  source localisation, which is not claimed.
- **Is it production-ready?** No. Local prototype: browser
  storage plus a Next.js-to-Python subprocess bridge.
  Authentication, shared storage, deployment hardening, and
  field validation remain open.


## Step 9 additions to verify before judging

- Run a review in Investigation A, switch to B, then return to A; A's report should be restored and B should remain isolated.
- Reload the browser; the report should return with its original fingerprint.
- Change one evidence field; the stale banner should appear and review-bundle export should be disabled.
- Run a new review; the stale state should clear and export should use the current evidence snapshot.
- Import a CSV with a repeated record_code and verify the duplicate row is rejected with a row number.
- Import a CSV with an unknown header and verify the application refuses the import with an explicit message.
- Explain that “No register flags” is not the same as engine eligibility; the diagnostic findings identify actual exclusions.

## Step 16 — Decision Sensitivity Studio demo

1. Use an isolated, clearly labelled synthetic QA investigation with a current, linked four-stage review. Do not seed these fixtures into a normal project workspace.
2. Open the Decision Sensitivity Studio within the current diagnostic review.
3. Select one upstream negative result and the serving positive result for single-record omission tests.
4. Run the sensitivity test and show the resulting decision-category and stage-status changes. Explain that each scenario removes one record from a temporary API request; it does not edit the saved evidence or simulate a physical contamination event.
5. Export the compact sensitivity JSON and show its evidence snapshot SHA-256 fingerprint. The export includes record identifiers and conclusions but not raw evidence records.
6. Add or edit evidence and show that the previous diagnostic report becomes stale and the sensitivity view is no longer available as a current analysis until a new review runs.

Suggested explanation: “WaterChain does not just show a candidate transition. It also lets a reviewer see whether that conclusion depends on a particular sample being available. If the decision changes when that evidence is omitted, we highlight the dependency rather than inventing a confidence percentage.”

Do not claim global novelty, real-world accuracy, or a statistical robustness guarantee from the feature or synthetic tests.
