# WaterChain user-evaluation protocol (spreadsheet vs WaterChain)

**Status: protocol only. No participants have been recruited, no sessions have
been run, and no user results exist. User-impact validation is PENDING.**

## Purpose

Measure, on a realistic water-investigation task, whether WaterChain helps a
WASH or laboratory-method reviewer reach fewer unsupported conclusions and
identify evidence gaps faster than a basic spreadsheet workflow, without
teaching the tool's expected answers.

## Design

- **Within-subject, counterbalanced**: each participant completes two
  isomorphic investigations (same structure, different fixtures), one with a
  spreadsheet template and one with WaterChain. Half start with the
  spreadsheet, half with WaterChain.
- **Fixtures**: synthetic only, clearly labeled. Each investigation contains
  one clean linked transition, one off-pathway positive, one failed-QC
  record, one ambiguous source identity, and one missing transfer reference.
  Fixture sets are balanced so neither workflow sees the same records twice.
- **Participants**: WASH practitioners, water-laboratory analysts, or
  environmental-health students. Target n = 8-12 for a pilot. Record role and
  domain experience only; no unnecessary personal data.
- **No coaching on expected answers**: facilitators may explain UI mechanics
  but not the engine's decision rules.

## Tasks

For each investigation, the participant must:
1. Identify every evidence gap (missing stage, missing transfer, missing QC/method/timestamp).
2. Name any unresolved relationships (ambiguous source, conflicting batch).
3. State a conclusion for the pathway: candidate transition at a named stage,
   or explicit abstention with reasons.
4. List follow-up actions in priority order.

## Metrics

- **Time to identify evidence gaps**: minutes from first view to a complete
  gap list (facilitator-observed, same rubric both workflows).
- **Unsupported conclusions**: count of conclusions naming a contamination
  stage that the evidence does not support per a pre-written answer key.
- **Correct identification of unresolved relationships**: share of the seeded
  ambiguities the participant flags.
- **Next-action decision quality**: each proposed action scored 0-2 on
  (a) targeting a real gap, (b) not asserting unproven origin,
  (c) naming verifiable prerequisites.
- **Positive-vs-pathway understanding**: 3-question exit quiz distinguishing
  "a recorded positive result" from "evidence of a contamination pathway".
- **Usability notes**: think-aloud themes, friction points, misinterpreted
  labels (qualitative, quoted anonymously).

## Analysis and reporting

- Report paired differences with confidence intervals; with n = 8-12, treat
  this as a formative pilot, not a confirmatory trial.
- Publish the fixture sets, answer keys, quiz, and anonymized response
  tables alongside any reported numbers.
- Pre-register the hypothesis that WaterChain reduces unsupported conclusions;
  report null or negative results with equal prominence.

## Guardrails

- Do not run this protocol on real patient or household data; fixtures only.
- Do not present pilot results as clinical, regulatory, or procurement-grade
  evidence.
- If a participant's day job involves the evaluation fixtures' real-world
  analogues, screen for conflicts of interest.

## Step 19 execution materials

- Two isomorphic, clearly synthetic task sets are prepared at `validation/pilot_study/SET_A/` and `SET_B/`. Each contains records, entity and transfer registers, participant instructions, and a facilitator-only answer key.
- The facilitator key is developer-authored, not independent ground truth. Ask a relevant domain reviewer to inspect it before using the pilot to support any effectiveness claim.
- `validation/MANUAL_WORKFLOW_BASELINE.md` standardizes the spreadsheet workflow and equalizes available information and facilitator help.
- `validation/pilot_study/PLANNED_ASSIGNMENT_MATRIX_NOT_DATA.csv` balances order and task-set assignment for 12 potential coded participants. It is a planned allocation only; no participants are implied or claimed. Use the assignment only after consent and recruitment, and keep the administrative/consent log separately from outcome rows.
- Enter one row per participant per workflow in `validation/user_evaluation_capture_template.csv`. Use a pseudonymous code, never names/emails. The two workflow rows must have the same `order` and different task sets.
- Analyze actual completed sessions with `python validation/analyze_user_evaluation.py --input <completed_capture.csv> --out <analysis.json>`. The script reports paired means/differences and exploratory bootstrap percentile intervals, without p-values.

**Status remains pending:** no participants were recruited, no sessions were conducted, and no participant response data are supplied by this package.
