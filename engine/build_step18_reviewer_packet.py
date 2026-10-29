"""Build the Step 18 blind independent-review packet.

Separate from validation/reviewer_packet.json (16 holdout cases). This packet
covers the adversarial case types added in Step 18 (duplicate identifiers,
discordant repeats, omission variants, invalid numerics, unrelated source
identities) and intentionally OMITS WaterChain's expected decisions, latent
ground truth, and any engine output.

All records are synthetic software fixtures. External reviewer results are
pending; this packet being prepared is NOT an external review.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from step18_compare import build_cmp18_scenarios

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "validation" / "reviewer_packet_step18.json"


def stable_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def review_record(record: dict[str, Any]) -> dict[str, Any]:
    """Project one fixture record for reviewers, keeping semantics but dropping IDs."""
    rec = deepcopy(record)
    value = rec.get("numericValue")
    if isinstance(value, float) and not math.isfinite(value):
        # JSON cannot carry NaN/Infinity; the human reviewer must still see that
        # the value was invalid, so it is replaced with an explicit label.
        rec["numericValue"] = "NaN - invalid (non-finite); engine eligibility rule: 'Numeric value is not a finite number'"
    return {
        "record_id": rec["id"],
        "record_code": rec["recordCode"],
        "sample_code": rec["sampleCode"],
        "stage": rec["stage"],
        "collected_at": rec["collectedAt"],
        "water_source_id": rec["waterSourceId"],
        "batch_id": rec["batchId"],
        "analyte": rec["analyte"],
        "result": rec["result"],
        "numeric_value": rec["numericValue"],
        "unit": rec["unit"],
        "test_method": rec["method"],
        "laboratory": rec["labName"],
        "positive_control": rec["positiveControl"],
        "negative_control": rec["negativeControl"],
        "blank_control": rec["blankControl"],
        "source_reference": rec["sourceReference"],
        "notes": rec["notes"],
    }


def build_packet() -> dict[str, Any]:
    reviewer_cases = []
    for index, scenario in enumerate(build_cmp18_scenarios(), start=1):
        records = [review_record(r) for r in scenario.records]
        reviewer_cases.append({
            "review_case_id": f"WC18-R{index:03d}",
            "case_description": scenario.description,
            "synthetic_only": True,
            "records_sha256": hashlib.sha256(stable_json(records)).hexdigest(),
            "records": records,
            "review_questions": [
                "Based only on these records, should a cautious investigator name a candidate contamination-entry stage, or abstain?",
                "Which records are ineligible or unreliable, and why?",
                "What is missing, contradictory, or ambiguous in the lineage (source identity, batch links, timestamps)?",
                "Does the case distinguish an observed positive from evidence of where contamination entered?",
            ],
        })
    return {
        "packet_schema": "waterchain-independent-review-packet-v1",
        "packet_id": "step18-blind-comparison-cases",
        "purpose": "Independent reviewer assessment of the adversarial Step 18 fixtures: duplicates, discordant repeats, invalid values, unrelated identities, omission variants.",
        "status": "Awaiting external review; no reviewer responses are included. Preparing this packet is not an external review.",
        "synthetic_notice": "Every record in this packet is synthetic and clearly labeled as a software fixture. It is not a real household sample or laboratory result and cannot validate field performance.",
        "blinding_note": "WaterChain's expected decisions, latent ground truth, and all engine outputs are intentionally omitted. Do not show the reviewer engine/step18_compare.py, engine/step18_comparison_report.md, or the expected decisions in engine/holdout_validation.py until their response is submitted and frozen.",
        "case_count": len(reviewer_cases),
        "cases": reviewer_cases,
    }


def main() -> None:
    packet = build_packet()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} with {packet['case_count']} synthetic cases; no expected decisions included.")


if __name__ == "__main__":
    main()
