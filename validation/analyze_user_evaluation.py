#!/usr/bin/env python3
"""Descriptive paired analysis for the WaterChain vs spreadsheet pilot.

No participant data are bundled. The script intentionally reports descriptive
paired differences and deterministic bootstrap intervals, not p-values or claims
of effectiveness. Do not run this until sessions are actually completed.
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = {
    "participant_code", "order", "workflow", "task_set", "completed", "gap_list_completed",
    "time_to_identify_gaps_min", "time_to_complete_min", "unsupported_conclusions",
    "unresolved_relationships_seeded", "unresolved_relationships_flagged",
    "evidence_gaps_seeded", "evidence_gaps_flagged",
    "next_action_gap_score_0_2", "next_action_no_origin_score_0_2",
    "next_action_prerequisites_score_0_2", "quiz_correct_0_3", "usability_rating_1_5",
}
NUMERIC_RANGES = {
    "time_to_identify_gaps_min": (0, 240),
    "time_to_complete_min": (0, 240),
    "unsupported_conclusions": (0, 50),
    "unresolved_relationships_seeded": (0, 50),
    "unresolved_relationships_flagged": (0, 50),
    "evidence_gaps_seeded": (0, 50),
    "evidence_gaps_flagged": (0, 50),
    "next_action_gap_score_0_2": (0, 2),
    "next_action_no_origin_score_0_2": (0, 2),
    "next_action_prerequisites_score_0_2": (0, 2),
    "quiz_correct_0_3": (0, 3),
    "usability_rating_1_5": (1, 5),
}


def parse_bool(value: str) -> bool:
    value = value.strip().lower()
    if value in {"yes", "y", "true", "1", "completed"}:
        return True
    if value in {"no", "n", "false", "0", "incomplete", "abandoned"}:
        return False
    raise ValueError(f"invalid completed value {value!r}; use yes/no")


def load_rows(path: Path) -> tuple[list[dict[str, Any]], list[str]]:
    errors: list[str] = []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        missing = sorted(REQUIRED - set(reader.fieldnames or []))
        if missing:
            raise ValueError("Input CSV missing columns: " + ", ".join(missing))
        seen: set[tuple[str, str]] = set()
        for line, raw in enumerate(reader, start=2):
            code = (raw.get("participant_code") or "").strip()
            workflow = (raw.get("workflow") or "").strip().lower()
            order = (raw.get("order") or "").strip().lower()
            task_set = (raw.get("task_set") or "").strip().upper()
            if not code:
                errors.append(f"Line {line}: participant_code is required; use a pseudonym, not a name/email")
                continue
            if workflow not in {"spreadsheet", "waterchain"}:
                errors.append(f"Line {line} ({code}): workflow must be spreadsheet or waterchain")
                continue
            if order not in {"spreadsheet_first", "waterchain_first"}:
                errors.append(f"Line {line} ({code}): order must be spreadsheet_first or waterchain_first")
                continue
            if task_set not in {"A", "B"}:
                errors.append(f"Line {line} ({code}): task_set must be A or B")
                continue
            key = (code, workflow)
            if key in seen:
                errors.append(f"Line {line}: duplicate workflow row for participant {code}")
                continue
            seen.add(key)
            row: dict[str, Any] = {"participant_code": code, "workflow": workflow, "order": order, "task_set": task_set}
            try:
                row["completed"] = parse_bool(raw["completed"])
                row["gap_list_completed"] = parse_bool(raw["gap_list_completed"])
                for field, (low, high) in NUMERIC_RANGES.items():
                    value = float(raw[field])
                    if not (low <= value <= high):
                        raise ValueError(f"{field}={value} outside {low}..{high}")
                    if field not in {"time_to_identify_gaps_min", "time_to_complete_min"} and not value.is_integer():
                        raise ValueError(f"{field} must be a whole number")
                    row[field] = int(value) if field != "time_to_complete_min" else value
                for field, seeded_field in (("unresolved_relationships_flagged", "unresolved_relationships_seeded"), ("evidence_gaps_flagged", "evidence_gaps_seeded")):
                    if row[field] > row[seeded_field]:
                        raise ValueError(f"{field} cannot exceed {seeded_field}")
            except (TypeError, ValueError) as exc:
                errors.append(f"Line {line} ({code}/{workflow}): {exc}")
                continue
            rows.append(row)
    return rows, errors


def percentile(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    pos = (len(ordered) - 1) * p
    lo = int(pos)
    hi = min(lo + 1, len(ordered) - 1)
    frac = pos - lo
    return ordered[lo] * (1 - frac) + ordered[hi] * frac


def bootstrap_ci(values: list[float], *, seed: int, reps: int = 10000) -> list[float] | None:
    if len(values) < 2:
        return None
    rng = random.Random(seed)
    means = []
    n = len(values)
    for _ in range(reps):
        sample = [values[rng.randrange(n)] for _ in range(n)]
        means.append(statistics.fmean(sample))
    return [round(percentile(means, 0.025), 3), round(percentile(means, 0.975), 3)]


def metric_value(row: dict[str, Any], metric: str) -> float:
    if metric == "time_to_identify_gaps_min":
        return float(row[metric]) if row["gap_list_completed"] else 240.0  # cap tasks where gaps were never fully listed
    if metric == "time_to_complete_min":
        return float(row[metric]) if row["completed"] else 240.0  # cap uncompleted tasks at 240-minute upper bound
    if metric == "unsupported_conclusions":
        return float(row[metric])
    if metric == "relationship_detection_rate":
        denominator = row["unresolved_relationships_seeded"]
        return row["unresolved_relationships_flagged"] / denominator if denominator else 1.0
    if metric == "evidence_gap_detection_rate":
        denominator = row["evidence_gaps_seeded"]
        return row["evidence_gaps_flagged"] / denominator if denominator else 1.0
    if metric == "next_action_score_0_6":
        return float(row["next_action_gap_score_0_2"] + row["next_action_no_origin_score_0_2"] + row["next_action_prerequisites_score_0_2"])
    if metric == "quiz_correct_0_3":
        return float(row[metric])
    if metric == "usability_rating_1_5":
        return float(row[metric])
    raise KeyError(metric)


def analyze(rows: list[dict[str, Any]], errors: list[str]) -> dict[str, Any]:
    by_participant: dict[str, dict[str, dict[str, Any]]] = {}
    for row in rows:
        by_participant.setdefault(row["participant_code"], {})[row["workflow"]] = row
    paired = []
    missing_pairs = []
    for code, pair in sorted(by_participant.items()):
        if set(pair) != {"spreadsheet", "waterchain"}:
            missing_pairs.append(code)
            continue
        a, b = pair["spreadsheet"], pair["waterchain"]
        if a["order"] != b["order"]:
            errors.append(f"Participant {code}: order differs between paired rows")
            continue
        if a["task_set"] == b["task_set"]:
            errors.append(f"Participant {code}: spreadsheet and WaterChain must receive different task sets")
            continue
        paired.append((code, a, b))
    metrics = {
        "time_to_identify_gaps_minutes": {"field": "time_to_identify_gaps_min", "direction": "lower_is_better"},
        "completion_adjusted_time_minutes": {"field": "time_to_complete_min", "direction": "lower_is_better"},
        "unsupported_conclusions_count": {"field": "unsupported_conclusions", "direction": "lower_is_better"},
        "unresolved_relationship_detection_rate": {"field": "relationship_detection_rate", "direction": "higher_is_better"},
        "evidence_gap_detection_rate": {"field": "evidence_gap_detection_rate", "direction": "higher_is_better"},
        "next_action_quality_score_0_6": {"field": "next_action_score_0_6", "direction": "higher_is_better"},
        "pathway_understanding_quiz_0_3": {"field": "quiz_correct_0_3", "direction": "higher_is_better"},
        "usability_rating_1_5": {"field": "usability_rating_1_5", "direction": "higher_is_better"},
    }
    results: dict[str, Any] = {}
    for index, (name, spec) in enumerate(metrics.items(), start=1):
        diffs = []
        spreadsheets = []
        waterchains = []
        for code, srow, wrow in paired:
            sval = metric_value(srow, spec["field"])
            wval = metric_value(wrow, spec["field"])
            difference = (sval - wval) if spec["direction"] == "lower_is_better" else (wval - sval)
            diffs.append(difference)
            spreadsheets.append(sval)
            waterchains.append(wval)
        results[name] = {
            "n_paired": len(diffs),
            "spreadsheet_mean": round(statistics.fmean(spreadsheets), 3) if spreadsheets else None,
            "waterchain_mean": round(statistics.fmean(waterchains), 3) if waterchains else None,
            "mean_paired_difference_favoring_waterchain": round(statistics.fmean(diffs), 3) if diffs else None,
            "median_paired_difference_favoring_waterchain": round(statistics.median(diffs), 3) if diffs else None,
            "paired_difference_range": [round(min(diffs), 3), round(max(diffs), 3)] if diffs else None,
            "bootstrap_95pct_percentile_ci_mean_difference": bootstrap_ci(diffs, seed=20261029 + index) if len(diffs) >= 2 else None,
            "positive_difference_interpretation": "favors WaterChain; descriptive only" if diffs else "no complete pairs",
        }
    order_counts = {k: sum(1 for _, s, _ in paired if s["order"] == k) for k in ("spreadsheet_first", "waterchain_first")}
    task_map_counts = {"spreadsheet_A_waterchain_B": 0, "spreadsheet_B_waterchain_A": 0}
    for _, srow, wrow in paired:
        key = "spreadsheet_A_waterchain_B" if srow["task_set"] == "A" and wrow["task_set"] == "B" else "spreadsheet_B_waterchain_A"
        task_map_counts[key] += 1
    return {
        "report_schema": "waterchain-user-evaluation-analysis-v1",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "NO_PARTICIPANT_DATA" if not rows else ("READY_FOR_REVIEW" if paired and not errors else "INCOMPLETE_OR_INVALID"),
        "input_rows": len(rows),
        "unique_participant_codes": len(by_participant),
        "complete_pairs": len(paired),
        "incomplete_pairs": missing_pairs,
        "workflow_order_counts_among_complete_pairs": order_counts,
        "task_set_assignment_counts_among_complete_pairs": task_map_counts,
        "metrics": results,
        "disclosure": (
            "No effectiveness claim is warranted by this script alone. Results are descriptive pilot estimates; "
            "bootstrap intervals are exploratory percentile intervals for paired mean differences, not a substitute for a prespecified analysis. "
            "Do not claim statistical significance, causality, or generalizability from a small formative pilot; the script does not calculate p-values. "
            "Time to identify gaps is capped at 240 minutes when the list is not completed; task completion time is capped at 240 minutes when the task is unfinished. Report these conventions."
        ),
        "validation_errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "validation/user_evaluation_capture_template.csv")
    parser.add_argument("--out", type=Path, default=ROOT / "validation/user_evaluation_analysis.json")
    args = parser.parse_args()
    try:
        rows, errors = load_rows(args.input)
        report = analyze(rows, errors)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {args.out}")
        print(f"Status: {report['status']}; input rows={report['input_rows']}; complete paired participants={report['complete_pairs']}")
        if errors:
            for error in errors:
                print(f"- {error}")
            return 2
        return 0
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
