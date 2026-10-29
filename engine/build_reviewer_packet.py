"""Build a reviewer-facing packet without predeclared expected decisions.

All records are synthetic software fixtures. The output is meant for independent
review of the decision policy and fixture interpretation, not field validation.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from typing import Any
from holdout_validation import build_holdout_cases

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "validation" / "reviewer_packet.json"


def stable_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def build_packet() -> dict[str, Any]:
    reviewer_cases = []
    for index, case in enumerate(build_holdout_cases(), start=1):
        records = case.records
        reviewer_cases.append({
            "review_case_id": f"WC-R{index:03d}",
            "case_description": case.purpose,
            "synthetic_only": True,
            "records_sha256": hashlib.sha256(stable_json(records)).hexdigest(),
            "records": records,
            "review_questions": [
                "Based only on the records and stated evidence policy, should the engine attribute a candidate transition or abstain?",
                "What evidence is missing, contradictory, or ineligible?",
                "Does the rule wording overstate what this record pattern can establish?",
            ],
        })
    return {
        "packet_schema": "waterchain-independent-review-packet-v1",
        "purpose": "Independent reviewer assessment of software decision behavior and the conservativeness of the declared rules.",
        "status": "Awaiting external review; no reviewer responses are included.",
        "synthetic_notice": "Every record in this packet is synthetic and clearly labeled as a software fixture. It is not a real household sample or laboratory result and cannot validate field performance.",
        "blinding_note": "Expected decisions are intentionally omitted from this packet. To preserve independence, the reviewer should receive this packet and the review protocol, not the full implementation source or expected-decision report, until their response is submitted.",
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
