# Step 17 — Blinded independent-review workbench

## Purpose

The workbench prepares de-identified evidence packets for an external WASH, public-health, or laboratory-method reviewer. It does not claim that an external review has already happened. The post-review tool checks whether a returned response belongs to the exact packet, validates reviewer-selected evidence aliases, and compares reviewer decisions with the local rule-based engine.

Reviewer-engine and inter-reviewer agreement are descriptive only. The engine is not a gold standard; agreement is not diagnostic accuracy, causality, or proof of product effectiveness.

## Prepare a blinded packet

1. Create one or more investigations, enter/import records, map the water journey when relevant, and run a diagnostic review.
2. Open **Blind validation** in the left-side Tools navigation.
3. Select investigations. Each included case must have a stored diagnostic report whose exact evidence/journey fingerprint still matches the current case. Stale or unreviewed cases are skipped and explained.
4. Choose **Prepare blinded packet**.
5. Download the JSON packet and blank response CSV.
6. Give the reviewer only the JSON, the review instructions included in the packet, and the blank CSV. Do not share source code, the private comparison key, or engine results until the reviewer response is frozen.

The packet removes workspace names, original record IDs/codes, sample codes, raw source/batch/lab names, locations, free-text notes, raw source references, and absolute collection times. It keeps relative timing, result/analyte/method/QC information, aliases for equivalence and the transfer graph, because reviewers need these to judge the supplied evidence. Those details may still be sensitive; only share with authorized reviewers.

Each packet has a unique packet ID, and case IDs are scoped to that packet. The private local key stores expected engine categories, candidate stages, evidence fingerprints, and alias-to-record mappings. The public packet does not contain expected engine conclusions. The private key is a convenience for local comparison, not an authenticated or tamper-proof store.

## Reviewer CSV requirements

The response template columns are:

`reviewer_code,reviewer_role,review_date,packet_id,review_case_id,decision,candidate_stage,supporting_record_ids,limitations_or_conflicts,rationale,rule_issue,rule_issue_description`

Rules:

- `reviewer_code`: pseudonymous code, 2–32 letters/numbers/hyphens/underscores; do not enter a personal name.
- `reviewer_role`: 2–80 characters describing reviewer role (for example, `WASH specialist`).
- `review_date`: valid ISO date, `YYYY-MM-DD`.
- `packet_id`: exactly the ID shown in the provided JSON packet on every row. A response from a different packet is rejected.
- `review_case_id`: exactly one response for every case in this packet; duplicates and unknown IDs are rejected.
- `decision`: `candidate_transition`, `abstain`, or `cannot_assess`.
- `candidate_stage`: `source`, `collection`, `storage`, or `serving` only for `candidate_transition`; otherwise blank.
- `supporting_record_ids`: optional semicolon-separated aliases from that particular case (for example `R001;R002`). Unknown aliases are rejected. A candidate transition requires at least one valid alias.
- `rationale`: at least eight characters for each response.
- `rule_issue`: `yes`, `no`, or blank. If `yes`, the description must contain at least eight characters.
- Role, pseudonymous code, and review date must be consistent across the response file.

The application permits one submitted session per reviewer code per packet; it rejects duplicates rather than silently replacing an earlier response. If a reviewer needs to correct a frozen response, preserve the original and prepare a new packet/review round with documented versioning rather than overwriting the original session.

## Packet and response integrity

- The private key stores a SHA-256 fingerprint of the exact public packet JSON. On reload and before download/import, the stored packet is rechecked. A missing or changed packet disables download and reviewer-response import.
- Every imported response row must carry the expected packet ID and a known case ID.
- Supporting record aliases are validated against that case's private alias map.
- CSV parsing rejects duplicate rows/headers, malformed quoting, unsupported decisions, invalid dates, missing rationale, and inconsistent reviewer metadata.
- Invalid imports do not overwrite prior reviewer sessions.

These controls detect common accidental mismatch and local corruption; a browser-local store is not a security boundary. A user with access to the browser profile may modify localStorage, so this is not suitable for sensitive multi-user review infrastructure without server-side authentication and immutable storage controls.

## Compare and interpret

Decision agreement is the fraction of reviewer case decisions equal to the local prototype's category. Exact-stage agreement applies only when both the engine and reviewer selected `candidate_transition`. Inter-reviewer decision agreement counts pairwise matching decisions for the same cases.

Differences are prompts for review, not automatic false positives/false negatives. `candidate_transition` is not a claim that the contamination origin was proven. `cannot_assess` differs from `abstain`: the former means the reviewer cannot assess the case; the latter means evidence exists but does not justify a candidate transition.

## Stronger validation protocol

To use this for meaningful validation:

1. Pre-register the review questions, decision definitions, inclusion criteria, and analysis before reviewers see the cases.
2. Use cases not authored by the implementation team where possible; document which cases are synthetic and which originate from real records.
3. Obtain at least two independent reviewers for the same cases. Keep their initial responses separate and frozen before any discussion/adjudication.
4. Have a qualified WASH/laboratory-method specialist adjudicate major disagreements without treating WaterChain as the default truth.
5. Report sample size, missingness, reviewer experience, inter-reviewer agreement, disagreement categories, and limitations.
6. For claims about actual localization, obtain defensible reference labels or controlled scenarios with independently known ground truth. Observational source/household sample data alone do not establish the true point at which contamination entered the water.

No external review is implied by preparing a packet. Record the reviewer/date and a separate signed/dated protocol record if an actual review occurs.
