# Step 19 validation tools

## Independent review

1. Send only the contents of `WaterChain_Step19_Blind_Reviewer_Packet.zip` to the reviewer.
2. Freeze the returned CSV before unblinding expected decisions.
3. Run `python validation/score_independent_review.py --responses <frozen.csv> --out <report.json> --case-csv <cases.csv>`.
4. Read all flagged disagreements before interpreting the summary. This is author-rubric agreement on synthetic cases only.

## Spreadsheet vs WaterChain formative pilot

- Task sets: `validation/pilot_study/SET_A/` and `SET_B/`. Each contains synthetic `records.csv`, `entities.csv`, `transfers.csv`, participant task instructions, and a facilitator key. The participant-only handoff kits `WaterChain_Step19_Pilot_Task_Set_A.zip` and `_B.zip` exclude the answer key and assignment matrix. Give only the currently assigned set to participants; never give facilitator-key files to participants.
- Planned allocation matrix: `validation/pilot_study/PLANNED_ASSIGNMENT_MATRIX_NOT_DATA.csv`. It is a balanced plan, not participant data. Use coded participant IDs only.
- Capture template: `validation/user_evaluation_capture_template.csv`.
- Manual baseline: `validation/MANUAL_WORKFLOW_BASELINE.md`.
- Protocol: `validation/USER_EVALUATION_PROTOCOL.md`.
- Analysis: `python validation/analyze_user_evaluation.py --input <completed_capture.csv> --out <analysis.json>`.

Do not run an impact/effectiveness claim unless actual sessions occurred. The script reports paired descriptive differences and exploratory bootstrap percentile intervals; it does not compute p-values and does not justify broad claims from a small formative sample.

## Data hygiene

Use the pseudonymous code in the assignment matrix, not a person's name/email. Store consent/administrative records separately from outcome rows. Do not record sensitive health or household data; this study uses synthetic cases only.
