# Structured spreadsheet baseline — WaterChain user pilot

**Use this protocol only for the synthetic study sets under `validation/pilot_study/`. Do not use it for actual water-safety decisions.** The spreadsheet workflow is a meaningful comparator, not the naive first-positive algorithm used in the Step 18 synthetic code comparison.

## Fairness rules

- Participants receive one of two isomorphic synthetic task sets (A or B) in each workflow, never the same set twice.
- The same record, entity, and transfer information is available to both workflows.
- Assignment order and task-set mapping should follow `pilot_study/PLANNED_ASSIGNMENT_MATRIX_NOT_DATA.csv`; replace planned participant codes only when recruiting and assigning actual participants. This matrix is not evidence that participants were recruited.
- Use the same verbal instructions, time limit, response form, facilitator behavior, and allowed reference material in both conditions.
- Facilitators may explain interface mechanics but must not point to errors or expected conclusions.
- Participants should not discuss their first task with the facilitator or other participants before completing the second task.
- Do not share facilitator answer keys with participants.

## Spreadsheet condition

Use the participant's assigned `SET_A` or `SET_B` folder. The participant may use a blank spreadsheet to register and inspect the supplied `records.csv`, `entities.csv`, and `transfers.csv`. They should independently identify the core journey, assess quality and relationship issues, select a candidate transition or abstention, and record follow-up actions. Do not pre-sort rows into the expected answer.

Capture these fields in the same study response form used for WaterChain: task completion, elapsed time, unsupported conclusion count, unresolved-relationship detection, evidence-gap detection, next-action quality, exit quiz, and usability rating.

## WaterChain condition

Use the same task set, with the same files and instructions, in the WaterChain application. Start from a clean/empty investigation and use only documented records supplied in the case folder. Do not add unsupplied evidence, invent transfer references, or treat the demo as an operational water-safety workflow. Capture the same outcome fields.

## Score definitions

- **Unsupported conclusion count:** count candidate-stage claims that contradict the frozen facilitator key or assert causal origin as fact. A candidate transition phrased cautiously is not automatically an unsupported conclusion.
- **Relationship detection:** number of the 2 seeded unresolved relationships recognized (source identity conflict; missing-reference side transfer) divided by 2.
- **Evidence-gap detection:** number of the 4 seeded categories recognized (off-pathway record, failed QC, source identity conflict, missing transfer reference) divided by 4. Avoid double-counting the same issue within a category.
- **Next-action score:** three ratings from 0–2: targets a real gap, avoids unproven origin claims, names verifiable prerequisites. Sum 0–6.
- **Exit quiz:** three predefined items distinguishing a positive observation from pathway evidence and causality. Score 0–3. Use the same quiz after each workflow; do not give corrective feedback until both are complete.
- **Usability rating:** participant's subjective rating from 1–5. This is not a substitute for task performance.

## Limitations

Set A and B are developer-authored fixtures. The answer keys are author expectations, not independent scientific ground truth, and should be reviewed by a domain expert before any effectiveness claims. A small pilot is formative only. Report negative or null findings. Do not claim reduction in real-world contamination, improved health outcomes, or deployment safety from these tasks.

## Raw-response preservation

Capture the participant's submitted conclusion and actions in `pilot_study/PARTICIPANT_RESPONSE_TEMPLATE.csv` before the facilitator assigns rubric scores. Keep raw responses immutable after initial scoring; corrections or adjudications should be recorded separately. The aggregate capture file is derived from these responses and facilitator-observed timing, not a substitute for them.
