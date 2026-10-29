# WaterChain independent review protocol (Step 7)

**Status: pending. No independent reviewer has yet completed this protocol.**

## Purpose and scope

Ask a reviewer who did not implement the rules to assess whether WaterChain's declared evidence requirements are understandable, internally consistent, and appropriately conservative. This is a review of a research prototype and its software decision policy. It is not a certification of water safety, a clinical/public-health instrument, or proof that any contamination source is identified.

The packet is in `reviewer_packet.json`. It contains synthetic records only; it intentionally omits expected decisions. The packet's cases are software fixtures, not field observations, and are not evidence of real-world performance. Do not submit the full project ZIP or implementation source before the reviewer returns their independent labels if preserving a blinded decision review is desired.

## Review steps

1. Send the reviewer `reviewer_packet.json`, this protocol, and `reviewer_response_template.csv` only.
2. Ask them to make a decision for each case without inspecting the implementation or the development report: `candidate_transition`, `abstain`, or `cannot_assess`.
3. Ask for a short rationale citing the record IDs and applicable limitations. They should specifically challenge lineage, source identity, time ordering, repeat/discordant results, QC completeness, analyzer consistency, and sample identity.
4. Ask them to flag cases where a permitted candidate transition still reads too strongly or where an abstention is unnecessarily restrictive.
5. Record reviewer qualifications relevant to water quality/microbial testing/data validation, conflicts of interest, date, software packet hash, and protocol version. Do not collect unnecessary personal information.
6. Freeze the reviewer's completed response before comparing it with the expected decisions in `engine/holdout_validation.py` or running the implementation. Keep both the original response and any adjudicated response.
7. Document every disagreement. Update the engine only after the response is frozen; then rerun the test suite and retain the previous version/manifest.

## Reviewer response fields

- `review_case_id`: ID from the packet.
- `decision`: `candidate_transition`, `abstain`, or `cannot_assess`.
- `candidate_stage`: one of source, collection, storage, serving, or blank if no stage should be named.
- `supporting_record_ids`: semicolon-separated source record codes, if any.
- `limitations_or_conflicts`: what could invalidate the decision.
- `rationale`: concise explanation.
- `rule_issue`: `yes` or `no`, plus a description if yes.

## Interpretation and reporting

A reviewer agreement percentage on these cases only measures agreement on synthetic software scenarios. It is not predictive accuracy against real contamination events. Report raw agreement, decision-specific disagreements, false-attribution disagreements, abstention disagreements, and qualitative comments; do not report only a single score.

A single external review is formative. Stronger validation would require multiple independent reviewers, scenario authors blinded to implementation, transparent adjudication, and eventually controlled sample studies with defensible reference labels and a prespecified protocol.

## Current completion status

- Reviewer packet generated: yes (`validation/reviewer_packet.json`, 16 holdout cases).
- Step 18 packet generated: yes (`validation/reviewer_packet_step18.json`, 13 adversarial cases:
  duplicate identifiers, discordant repeats, invalid numerics, missing timestamps,
  unsupported analytes, unrelated source identities, omission variants).
- Expected decisions withheld from both reviewer packets: yes (verified by leak
  scan: no `expected_decision`, `attribution_permitted`, or engine confidence
  labels; per-case record SHA-256 hashes included for integrity).
- Review materials available: packet JSON + this protocol + reviewer response
  template CSV. Do not include engine source, expected-decision reports, or the
  private packet manifest until the reviewer's response is submitted and frozen.
- External reviewer contacted/completed: **no / pending**.
- Reviewer response or endorsement included: **no**.
- Field validation: **not performed**.

Preparing and verifying these packets is an instrument for review. It is not an
external review and must not be described as one.
