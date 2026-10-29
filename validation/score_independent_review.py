#!/usr/bin/env python3
"""Score a completed Step 18 blind-review CSV against the prewritten author rubric.

Important: this reports reviewer/rubric agreement on developer-authored synthetic
cases. It does not estimate real-world accuracy or prove that the author rubric is
scientifically correct. Run only AFTER the reviewer's submitted response is frozen.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "engine"))
from step18_compare import build_cmp18_scenarios  # noqa: E402

ALLOWED_DECISIONS = {"candidate_transition", "abstain", "cannot_assess"}
ALLOWED_STAGES = {"source", "collection", "storage", "serving"}
REQUIRED_COLUMNS = {
    "review_case_id", "decision", "candidate_stage", "supporting_record_ids",
    "limitations_or_conflicts", "rationale", "rule_issue", "rule_issue_description",
}


def stable_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def load_packet(packet_path: Path) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    if packet.get("packet_id") != "step18-blind-comparison-cases":
        raise ValueError("Unexpected packet_id; this scorer only supports the Step 18 packet.")
    cases = packet.get("cases")
    scenarios = build_cmp18_scenarios()
    if not isinstance(cases, list) or len(cases) != len(scenarios):
        raise ValueError(f"Packet/scenario count mismatch: {len(cases) if isinstance(cases, list) else 'invalid'} vs {len(scenarios)}")
    case_map: dict[str, dict[str, Any]] = {}
    for i, (case, scenario) in enumerate(zip(cases, scenarios), start=1):
        case_id = str(case.get("review_case_id", ""))
        expected_id = f"WC18-R{i:03d}"
        if case_id != expected_id:
            raise ValueError(f"Packet ordering/ID mismatch at row {i}: expected {expected_id}, got {case_id!r}")
        actual_hash = hashlib.sha256(stable_json(case.get("records", []))).hexdigest()
        if actual_hash != case.get("records_sha256"):
            raise ValueError(f"Packet records hash mismatch for {case_id}; case changed after packet generation.")
        if case_id in case_map:
            raise ValueError(f"Duplicate packet case ID: {case_id}")
        expected_decision = "abstain" if scenario.expected_decision is None else "candidate_transition"
        expected_stage = "" if scenario.expected_decision is None else str(scenario.expected_decision)
        case_map[case_id] = {
            "expected_decision": expected_decision,
            "expected_stage": expected_stage,
            "scenario_id": scenario.scenario_id,
        }
    return packet, case_map


def read_responses(path: Path, case_map: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    errors: list[str] = []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns = set(reader.fieldnames or [])
        missing_cols = sorted(REQUIRED_COLUMNS - columns)
        if missing_cols:
            raise ValueError(f"Response CSV is missing required columns: {', '.join(missing_cols)}")
        seen: set[str] = set()
        for line, raw in enumerate(reader, start=2):
            case_id = (raw.get("review_case_id") or "").strip()
            if not case_id:
                errors.append(f"Line {line}: review_case_id is blank")
                continue
            if case_id not in case_map:
                errors.append(f"Line {line}: unknown review_case_id {case_id!r}")
                continue
            if case_id in seen:
                errors.append(f"Line {line}: duplicate response for {case_id}")
                continue
            seen.add(case_id)
            decision = (raw.get("decision") or "").strip().lower()
            stage = (raw.get("candidate_stage") or "").strip().lower()
            if decision not in ALLOWED_DECISIONS:
                errors.append(f"Line {line} ({case_id}): invalid decision {decision!r}; use {sorted(ALLOWED_DECISIONS)}")
                continue
            if decision == "candidate_transition" and stage not in ALLOWED_STAGES:
                errors.append(f"Line {line} ({case_id}): candidate_transition requires candidate_stage in {sorted(ALLOWED_STAGES)}")
                continue
            if decision != "candidate_transition" and stage:
                errors.append(f"Line {line} ({case_id}): candidate_stage must be blank unless decision is candidate_transition")
                continue
            if not (raw.get("rationale") or "").strip():
                errors.append(f"Line {line} ({case_id}): rationale is required")
                continue
            expected = case_map[case_id]
            rows.append({
                "review_case_id": case_id,
                "scenario_id": expected["scenario_id"],
                "decision": decision,
                "candidate_stage": stage,
                "expected_decision": expected["expected_decision"],
                "expected_stage": expected["expected_stage"],
                "decision_agreement": decision == expected["expected_decision"],
                "stage_agreement": decision == "candidate_transition" and stage == expected["expected_stage"] if decision == expected["expected_decision"] == "candidate_transition" else None,
                "supported_expectation_agreement": decision == expected["expected_decision"] and (decision != "candidate_transition" or stage == expected["expected_stage"]),
                "rationale": (raw.get("rationale") or "").strip(),
                "limitations_or_conflicts": (raw.get("limitations_or_conflicts") or "").strip(),
                "rule_issue": (raw.get("rule_issue") or "").strip().lower(),
                "rule_issue_description": (raw.get("rule_issue_description") or "").strip(),
            })
    missing = sorted(set(case_map) - {r["review_case_id"] for r in rows})
    if missing:
        errors.append("Missing valid reviewer responses for: " + ", ".join(missing))
    return rows, errors


def summarize(rows: list[dict[str, Any]], packet: dict[str, Any], errors: list[str]) -> dict[str, Any]:
    total = int(packet.get("case_count", len(packet.get("cases", []))))
    n = len(rows)
    determinate = [r for r in rows if r["decision"] != "cannot_assess"]
    full_agreement = [r for r in determinate if r["supported_expectation_agreement"]]
    expected_abstain = [r for r in determinate if r["expected_decision"] == "abstain"]
    expected_stage = [r for r in determinate if r["expected_decision"] == "candidate_transition"]
    false_attribution_disagreements = [r for r in expected_abstain if r["decision"] == "candidate_transition"]
    over_abstention_disagreements = [r for r in expected_stage if r["decision"] == "abstain"]
    stage_disagreements = [r for r in expected_stage if r["decision"] == "candidate_transition" and r["candidate_stage"] != r["expected_stage"]]
    status = "COMPLETE" if n == total and not errors else "INCOMPLETE_OR_INVALID"
    return {
        "report_schema": "waterchain-independent-review-scoring-v1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "packet_id": packet.get("packet_id"),
        "case_count_expected": total,
        "valid_responses": n,
        "cannot_assess_count": sum(r["decision"] == "cannot_assess" for r in rows),
        "determinate_responses": len(determinate),
        "author_rubric_agreement_count": len(full_agreement),
        "author_rubric_agreement_rate_among_determinate": round(len(full_agreement) / len(determinate), 4) if determinate else None,
        "expected_abstain_cases_reviewed": len(expected_abstain),
        "reviewer_attributions_where_author_rubric_expected_abstain": len(false_attribution_disagreements),
        "expected_candidate_cases_reviewed": len(expected_stage),
        "reviewer_abstentions_where_author_rubric_expected_candidate": len(over_abstention_disagreements),
        "candidate_stage_disagreements": len(stage_disagreements),
        "rule_issue_flagged_yes": sum(r["rule_issue"] in {"yes", "y", "true", "1"} for r in rows),
        "disclosure": (
            "Agreement against developer-prewritten expectations on developer-authored synthetic cases only. "
            "These figures are not real-world accuracy, scientific ground truth, or proof that either the reviewer or author rubric is correct. "
            "All disagreements require qualitative review and documented adjudication."
        ),
        "validation_errors": errors,
        "cases": rows,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--packet", type=Path, default=ROOT / "validation/reviewer_packet_step18.json")
    parser.add_argument("--responses", type=Path, required=True, help="Frozen, completed reviewer CSV")
    parser.add_argument("--out", type=Path, default=ROOT / "validation/independent_review_scoring_report.json")
    parser.add_argument("--case-csv", type=Path, default=None, help="Optional per-case scoring CSV output")
    args = parser.parse_args()
    try:
        packet, case_map = load_packet(args.packet)
        rows, errors = read_responses(args.responses, case_map)
        report = summarize(rows, packet, errors)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        if args.case_csv:
            args.case_csv.parent.mkdir(parents=True, exist_ok=True)
            fields = ["review_case_id", "scenario_id", "decision", "candidate_stage", "expected_decision", "expected_stage", "decision_agreement", "stage_agreement", "supported_expectation_agreement", "rule_issue", "rule_issue_description", "limitations_or_conflicts", "rationale"]
            with args.case_csv.open("w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
                writer.writeheader()
                writer.writerows(rows)
        print(f"Wrote {args.out}")
        print(f"Status: {report['status']}; valid responses {report['valid_responses']}/{report['case_count_expected']}; author-rubric agreement is descriptive only.")
        if errors:
            print("Validation issues:")
            for error in errors:
                print(f"- {error}")
            return 2
        return 0
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
