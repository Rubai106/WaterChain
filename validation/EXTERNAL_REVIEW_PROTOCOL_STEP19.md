# WaterChain Step 19 — independent synthetic-case review protocol

**Status: materials ready; external review not started.** No reviewer has been recruited or submitted responses as of 2026-10-29.

## Purpose and boundaries

Review whether the evidence rules represented by the supplied cases support conservative case interpretation, and whether important ambiguities are clearly represented. Every case is developer-authored synthetic material. Agreement is only agreement on this packet, not real-world diagnostic accuracy, validation of a water-safety tool, or proof that the reviewer or developer answer key is correct.

## What the reviewer should receive

- `reviewer_packet_step18.json`
- this protocol
- `reviewer_response_template.csv`

Do **not** send the source code, comparison report, expected-decision logic, scoring script, or answer key before the response is frozen. The separate handoff archive is designed to contain only the minimum materials.

## Suggested reviewer qualifications

A reviewer with relevant experience in WASH, water-quality sampling, environmental health, laboratory method/QC, chain-of-custody, or evidence/data validation. Record a brief role/qualification description and conflicts of interest; do not request national ID, home address, date of birth, or other unnecessary personal information.

## Procedure

1. Record a pseudonymous reviewer code, review date, role/experience category, conflict-of-interest statement, packet file hash, and protocol version in a separate administrative log.
2. Freeze a copy of the packet and calculate its SHA-256. Do not edit the supplied cases.
3. For every case, choose `candidate_transition`, `abstain`, or `cannot_assess`. If choosing `candidate_transition`, name one candidate stage (`source`, `collection`, `storage`, or `serving`). A candidate transition is not a causal attribution.
4. Cite relevant record IDs and explain data-quality, QC, identity, timing, repeat, analyte, and lineage issues. Explicitly flag any rule that seems too permissive or unnecessarily restrictive.
5. Return the completed CSV. Keep a read-only original and timestamp it before any discussion with the developers.
6. Only after that frozen response exists may the team run the separate scoring script or reveal expected decisions.
7. Review every disagreement qualitatively. Record reviewer rationale, developer response, adjudication, whether a rule change is proposed, and regression tests required. Do not erase the original response after adjudication.

## Response values

- `decision`: `candidate_transition`, `abstain`, or `cannot_assess`.
- `candidate_stage`: one of source, collection, storage, serving only for `candidate_transition`; otherwise blank.
- `supporting_record_ids`: IDs separated by semicolons.
- `limitations_or_conflicts`: missing information, contradictory metadata, QC issues, or ambiguity.
- `rationale`: concise evidence-based rationale.
- `rule_issue`: `yes` or `no`; describe a concern in `rule_issue_description`.

## Analysis

The scoring script checks the packet record hashes, response completeness, allowed values, and reviewer agreement with the developer-prewritten rubric. It reports determinate-response agreement, disagreements on abstention, candidate stage, and any rule issues flagged. It must not be described as accuracy or as proof the author rubric is true. `cannot_assess` remains its own category and is excluded from determinate agreement, but the count must be reported.

One reviewer provides formative critique, not validation. Multiple independent reviewers and a prespecified adjudication process are preferable. Synthetic-case review does not replace field or laboratory validation.

## Current status

- Step 18 packet: 13 synthetic cases, expected decisions omitted.
- Packet records SHA-256: generated per case; scorer rechecks hashes before interpreting responses.
- Reviewer handoff ZIP: created separately from the full source package.
- Reviewer contacted: no evidence available; pending.
- Completed independent responses: none.
- User evaluation: not run.
- Operational deployment: not ready.
