# Reviewer handoff package

Use `WaterChain_Step19_Blind_Reviewer_Packet.zip` to contact an independent reviewer. It deliberately excludes application code, comparison outputs, expected decisions, answer keys, and the scorer. The reviewer should submit a completed `reviewer_response_template.csv` and freeze it before the development team scores it.

In the full Step 19 project directory, score only a frozen response file:

```bash
python validation/score_independent_review.py \
  --responses /path/to/frozen_reviewer_response.csv \
  --out validation/independent_review_scoring_report.json \
  --case-csv validation/independent_review_scored_cases.csv
```

The scorer verifies each packet case's SHA-256 hash, checks response fields and completeness, and reports agreement with the developer-prewritten expectations. It must not be described as real-world accuracy or proof that the author rubric is correct. A partial or invalid response is reported as incomplete/invalid and the script exits non-zero.

No independent-review response is included in this Step 19 package.
