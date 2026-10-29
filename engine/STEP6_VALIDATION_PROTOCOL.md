# Step 6 — Development holdout and adversarial protocol

## Purpose

This step checks whether the current deterministic engine keeps its guardrails when
records are altered in adversarial ways. The new cases are defined in
`holdout_validation.py`, separately from the original Step 5 scenario generator.
They are **developer-authored synthetic cases**, not an independently blinded or
externally adjudicated validation set.

## Coverage

The suite covers clean linked transitions; all-negative records; source-positive but
origin-unknown records; conflicting same-stage results; duplicate record identifiers;
sample IDs reused across stages; extra positive results from off-lineage batches;
multiple batch IDs common to all stages; incomplete/failed QC; equal timestamps;
conflicting sources; mixed analytes; a consistent quantitative concentration example;
and missing stage evidence.

`test_adversarial_mutations.py` also changes one condition at a time in an otherwise
valid fixture to check safety invariants and tests that reversing record order does not
change the decision.

## Run

```bash
python -m unittest discover -s engine -p "test_*.py" -v
python engine/run_holdout_validation.py
python engine/evaluate.py
```

The holdout runner writes `engine/holdout_report.json` and
`engine/holdout_report.md`. The Step 5 runner refreshes its own evaluation outputs under
`engine/evaluation_report.json` and `engine/evaluation_report.md` with the revised engine.

## Interpretation

Conformance means the engine behaved as expected on hand-authored software fixtures.
It does not mean real-world causal accuracy. The case set is not blind; developers know
the scenarios and expected decisions. Passing it cannot substantiate water safety,
public-health value, calibrated probability, novelty, or superiority to other systems.

## New conservative rules

- Cross-stage interpretation requires exactly one batch ID common to all four stages.
- When a unique shared batch exists, eligible records from other batches do not influence
  that pathway's hypotheses; they are disclosed in a finding.
- Different analytes are not combined into one transition claim.
- Both positive and not-detected results at the same stage cause abstention until reviewed.
- Reused record identifiers and sample IDs spanning stages block attribution.
- Each configured quality-control field must explicitly pass; `not_recorded` is not treated
  as equivalent to `pass`.
- Equal or overlapping timestamps do not establish strict stage order.
