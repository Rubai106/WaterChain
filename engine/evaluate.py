"""Reproducible evaluation harness for the WaterChain rule-based prototype.

All cases generated here are synthetic controlled fixtures with explicitly assigned
expected decisions. They are NOT field measurements, a public dataset, or evidence of
real-world diagnostic performance. No random numbers are used.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from diagnose import diagnose

STAGES = ("source", "collection", "storage", "serving")
BASE_TIME = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)

@dataclass
class Scenario:
    scenario_id: str
    description: str
    records: list[dict[str, Any]]
    expected_decision: str | None
    latent_ground_truth_entry_stage: str | None
    identifiability: str


def make_record(stage: str, result: str, index: int, *, batch: str = "B-SYN-001",
                source: str = "S-SYN-001", method: str = "synthetic test method",
                qc: str = "pass", timestamp: datetime | None = None,
                analyte: str = "e_coli_presence", result_override: str | None = None) -> dict[str, Any]:
    """Construct a synthetic record. SYN IDs are purposely unmistakable fixtures."""
    return {
        "id": f"SYN-REC-{index:03d}",
        "recordCode": f"SYN-REC-{index:03d}",
        "sampleCode": f"SYN-SAMPLE-{index:03d}",
        "stage": stage,
        "collectedAt": (timestamp or (BASE_TIME + timedelta(hours=STAGES.index(stage)))).isoformat(),
        "waterSourceId": source,
        "batchId": batch,
        "analyte": analyte,
        "result": result_override or result,
        "numericValue": None,
        "unit": None,
        "method": method,
        "labName": "SYNTHETIC FIXTURE ONLY",
        "positiveControl": qc,
        "negativeControl": qc,
        "blankControl": qc,
        "sourceReference": "SYNTHETIC-NOT-A-REAL-REPORT",
        "notes": "Generated test fixture; not a real sample or laboratory result.",
    }


def base_records(results: dict[str, str], **overrides: Any) -> list[dict[str, Any]]:
    out = []
    for i, stage in enumerate(STAGES, start=1):
        kwargs = dict(overrides.get(stage, {}))
        result = results.get(stage, "not_tested")
        out.append(make_record(stage, result, i, **kwargs))
    return out


def build_scenarios() -> list[Scenario]:
    scenarios: list[Scenario] = []

    # Positive, identifiable scenarios: generated fixtures have a known stage pattern,
    # complete linked metadata and a clean chronology. This checks behavior, not reality.
    clean_patterns = [
        ("clean_collection_transition", "Source is negative; the earliest positive is collection.",
         {"source":"not_detected", "collection":"detected", "storage":"detected", "serving":"detected"}, "collection"),
        ("clean_storage_transition", "Source and collection are negative; storage and serving are positive.",
         {"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"}, "storage"),
        ("clean_serving_transition", "Source, collection, and storage are negative; serving is positive.",
         {"source":"not_detected", "collection":"not_detected", "storage":"not_detected", "serving":"detected"}, "serving"),
    ]
    for sid, desc, results, truth in clean_patterns:
        scenarios.append(Scenario(sid, desc, base_records(results), truth, truth, "identifiable_by_fixture_design"))

    scenarios.append(Scenario(
        "all_stages_negative", "All four eligible linked records report not detected.",
        base_records({s: "not_detected" for s in STAGES}), None, None, "no_positive_transition_observed"))

    scenarios.append(Scenario(
        "source_positive_origin_unresolved", "The earliest sampled stage is positive; this alone does not establish when contamination began.",
        base_records({s: "detected" for s in STAGES}), None, "source", "origin_not_identifiable_from_stage_sequence"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[3]["batchId"] = None
    scenarios.append(Scenario("missing_serving_batch", "Serving record has no batch identity; cross-stage continuity is not established.", recs, None, "storage", "not_identifiable_due_to_missing_lineage"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[2]["batchId"] = "B-SYN-DIFFERENT"
    scenarios.append(Scenario("mismatched_storage_batch", "The storage record refers to a different batch identifier.", recs, None, "storage", "not_identifiable_due_to_conflicting_lineage"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[2]["waterSourceId"] = "S-SYN-OTHER"
    scenarios.append(Scenario("conflicting_source_identity", "Records claim more than one source identity.", recs, None, "storage", "not_identifiable_due_to_source_conflict"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[0]["collectedAt"] = (BASE_TIME + timedelta(hours=8)).isoformat()
    scenarios.append(Scenario("chronology_conflict", "Source timestamp comes after downstream stages.", recs, None, "storage", "not_identifiable_due_to_timeline_conflict"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs.pop(0)
    scenarios.append(Scenario("source_stage_missing", "No source-stage record was supplied.", recs, None, "storage", "not_identifiable_due_to_missing_stage"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[2]["blankControl"] = "fail"
    scenarios.append(Scenario("qc_failed_at_storage", "The storage positive has a recorded blank-control failure.", recs, None, "storage", "not_identifiable_due_to_failed_qc"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[2]["method"] = ""
    scenarios.append(Scenario("storage_method_missing", "The storage positive lacks a recorded test method.", recs, None, "storage", "not_identifiable_due_to_missing_method"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[1]["result"] = "not_tested"
    scenarios.append(Scenario("collection_not_tested", "The collection-stage record has no reportable result.", recs, None, "storage", "not_identifiable_due_to_missing_stage_result"))

    recs = base_records({"source":"not_detected", "collection":"not_detected", "storage":"detected", "serving":"detected"})
    recs[2]["analyte"] = "turbidity"
    scenarios.append(Scenario("unsupported_storage_analyte", "Storage record tests turbidity, outside this engine's E. coli pathway scope.", recs, None, "storage", "not_identifiable_for_current_engine"))

    recs = base_records({"source":"not_detected", "collection":"detected", "storage":"detected", "serving":"detected"})
    recs[0]["collectedAt"] = "not-a-date"
    scenarios.append(Scenario("invalid_source_timestamp", "Source-stage timestamp cannot be parsed, so the source record is excluded.", recs, None, "collection", "not_identifiable_due_to_invalid_timestamp"))

    # Repeated positive records at a stage are not collapsed into a claim of independent
    # replication. The simple engine can still review the valid records but the protocol
    # keeps the one-record-per-stage fixtures to avoid claiming replicate handling here.
    return scenarios


def baseline_predict(records: list[dict[str, Any]]) -> str | None:
    """Intentionally naive baseline: earliest stage with a raw positive result.

    Deliberately ignores QC, test method, source/batch links, timestamps, and missing
    stages. This represents a simple comparison baseline, not a recommended workflow.
    """
    positive_stages = []
    for record in records:
        stage = record.get("stage")
        result = record.get("result")
        is_positive = result == "detected" or (result == "quantified" and
            isinstance(record.get("numericValue"), (float, int)) and record.get("numericValue", 0) > 0)
        if is_positive and stage in STAGES:
            positive_stages.append(stage)
    return min(positive_stages, key=STAGES.index) if positive_stages else None


def engine_predict(records: list[dict[str, Any]]) -> tuple[str | None, dict[str, Any]]:
    report = diagnose(records)
    # Only call a transition-stage prediction when the engine explicitly labels it a
    # candidate transition. A positive observed at the source is NOT treated as origin.
    if report.get("confidence_label") == "candidate transition only" and report.get("attribution_permitted"):
        for hypothesis in report.get("hypotheses", []):
            if hypothesis.get("status") == "observed_positive":
                return hypothesis.get("stage"), report
    return None, report


def score_predictions(scenarios: list[Scenario]) -> dict[str, Any]:
    detail = []
    methods = {"WaterChain": [], "Naive first-positive baseline": []}
    for scenario in scenarios:
        baseline = baseline_predict(scenario.records)
        candidate, report = engine_predict(scenario.records)
        expected = scenario.expected_decision
        for method, prediction in (("WaterChain", candidate), ("Naive first-positive baseline", baseline)):
            correct = prediction == expected
            attributed = prediction is not None
            methods[method].append({
                "correct_expected_decision": correct,
                "attributed": attributed,
                "expected_decision": expected,
                "prediction": prediction,
                "should_abstain": expected is None,
            })
        detail.append({
            "scenario_id": scenario.scenario_id,
            "description": scenario.description,
            "expected_decision": expected,
            "latent_ground_truth_entry_stage": scenario.latent_ground_truth_entry_stage,
            "identifiability": scenario.identifiability,
            "waterchain_prediction": candidate,
            "baseline_prediction": baseline,
            "waterchain_correct_expected_decision": candidate == expected,
            "baseline_correct_expected_decision": baseline == expected,
            "waterchain_confidence_label": report.get("confidence_label"),
            "waterchain_attribution_permitted": report.get("attribution_permitted"),
            "waterchain_finding_codes": [f.get("code") for f in report.get("findings", [])],
        })

    def metrics(observations: list[dict[str, Any]]) -> dict[str, Any]:
        n = len(observations)
        abstain_cases = [o for o in observations if o["should_abstain"]]
        identifiable = [o for o in observations if not o["should_abstain"]]
        predictions = [o for o in observations if o["attributed"]]
        correct_pred = [o for o in predictions if o["correct_expected_decision"]]
        unsupported_pred = [o for o in predictions if o["should_abstain"]]
        correct_abstentions = [o for o in abstain_cases if not o["attributed"]]
        correct_identifiable = [o for o in identifiable if o["correct_expected_decision"]]
        return {
            "scenario_count": n,
            "expected_decision_accuracy": round(sum(o["correct_expected_decision"] for o in observations) / n, 4) if n else None,
            "attribution_coverage": round(len(predictions) / n, 4) if n else None,
            "selective_accuracy_when_attributing": round(len(correct_pred) / len(predictions), 4) if predictions else None,
            "correct_attribution_rate_on_identifiable_cases": round(len(correct_identifiable) / len(identifiable), 4) if identifiable else None,
            "abstention_rate_on_cases_that_should_abstain": round(len(correct_abstentions) / len(abstain_cases), 4) if abstain_cases else None,
            "unsupported_attribution_rate_on_cases_that_should_abstain": round(len(unsupported_pred) / len(abstain_cases), 4) if abstain_cases else None,
            "incorrect_attribution_count": sum(1 for o in predictions if not o["correct_expected_decision"]),
            "abstention_count": n - len(predictions),
            "correct_abstention_count": len(correct_abstentions),
            "predicted_stage_count": len(predictions),
            "identifiable_case_count": len(identifiable),
            "abstention_expected_case_count": len(abstain_cases),
        }

    return {
        "title": "WaterChain controlled-scenario evaluation",
        "evaluation_type": "synthetic deterministic fixtures only",
        "not_real_world_performance": True,
        "scenario_count": len(scenarios),
        "methods": {name: metrics(obs) for name, obs in methods.items()},
        "scenario_results": detail,
        "metric_definitions": {
            "expected_decision_accuracy": "Fraction whose predicted stage/abstention matches the scenario's predeclared expected decision. This is fixture conformance, not real-world causal accuracy.",
            "attribution_coverage": "Fraction of scenarios where the method emits a stage attribution.",
            "selective_accuracy_when_attributing": "Fraction of emitted attributions that match the predeclared expected decision stage.",
            "correct_attribution_rate_on_identifiable_cases": "Fraction of scenarios designed with sufficient evidence for a stage decision that receive the expected stage.",
            "abstention_rate_on_cases_that_should_abstain": "Fraction of scenarios declared non-identifiable/no-transition-observed for which the method emits no stage attribution.",
            "unsupported_attribution_rate_on_cases_that_should_abstain": "Fraction of those non-identifiable/no-transition-observed scenarios where the method nonetheless emits a stage attribution.",
        },
        "limitations": [
            "Scenarios and values are synthetic test fixtures created in code, not household or laboratory observations.",
            "Expected decisions are predeclared for deterministic software conformance; they are not independently adjudicated field ground truth.",
            "The baseline is deliberately naive and is not a fair substitute for a validated operational method.",
            "This harness tests only the current four-stage rule engine and its defined constraints.",
            "No statistical significance, external validity, calibration, or real-world diagnostic efficacy can be inferred from these results.",
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# WaterChain controlled-scenario evaluation",
        "",
        "> **Synthetic fixtures only. Not field data, not laboratory results, and not a real-world performance study.**",
        "",
        f"Scenario count: **{report['scenario_count']}**",
        "",
        "## Methods compared",
        "",
        "| Metric | WaterChain | Naive first-positive baseline |",
        "|---|---:|---:|",
    ]
    metric_labels = [
        ("expected_decision_accuracy", "Expected-decision fixture accuracy"),
        ("attribution_coverage", "Attribution coverage"),
        ("selective_accuracy_when_attributing", "Selective accuracy when attributing"),
        ("correct_attribution_rate_on_identifiable_cases", "Correct attribution rate on identifiable fixtures"),
        ("abstention_rate_on_cases_that_should_abstain", "Correct abstention rate on should-abstain fixtures"),
        ("unsupported_attribution_rate_on_cases_that_should_abstain", "Unsupported attribution rate on should-abstain fixtures"),
        ("incorrect_attribution_count", "Incorrect attribution count"),
    ]
    methods = report["methods"]
    for key, label in metric_labels:
        a = methods["WaterChain"].get(key)
        b = methods["Naive first-positive baseline"].get(key)
        va = f"{a:.1%}" if isinstance(a, float) and 0 <= a <= 1 else str(a)
        vb = f"{b:.1%}" if isinstance(b, float) and 0 <= b <= 1 else str(b)
        lines.append(f"| {label} | {va} | {vb} |")
    lines += ["", "## Scenario-by-scenario results", "", "| Scenario | Expected decision | WaterChain | Baseline | Outcome |", "|---|---|---|---|---|"]
    for item in report["scenario_results"]:
        exp = item["expected_decision"] or "ABSTAIN"
        wc = item["waterchain_prediction"] or "ABSTAIN"
        bl = item["baseline_prediction"] or "ABSTAIN"
        outcome = "both match" if item["waterchain_correct_expected_decision"] and item["baseline_correct_expected_decision"] else (
            "WaterChain only" if item["waterchain_correct_expected_decision"] else (
                "baseline only" if item["baseline_correct_expected_decision"] else "neither matches"))
        lines.append(f"| `{item['scenario_id']}` | {exp} | {wc} | {bl} | {outcome} |")
    lines += ["", "## Interpretation guardrails", ""]
    lines.extend(f"- {lim}" for lim in report["limitations"])
    lines += ["", "These metrics describe only conformance on the listed synthetic fixtures. They must not be presented as real-world diagnostic accuracy, validated sensitivity/specificity, or proof that WaterChain outperforms existing water-quality workflows.", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-out", default="engine/evaluation_report.json", help="Path for JSON report (default: engine/evaluation_report.json)")
    parser.add_argument("--markdown-out", default="engine/evaluation_report.md", help="Path for Markdown report (default: engine/evaluation_report.md)")
    parser.add_argument("--stdout-json", action="store_true", help="Print the complete report as JSON to stdout")
    args = parser.parse_args()

    scenarios = build_scenarios()
    report = score_predictions(scenarios)
    json_path = Path(args.json_out)
    md_path = Path(args.markdown_out)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    if args.stdout_json:
        print(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False))
    else:
        print(f"Evaluated {len(scenarios)} synthetic controlled scenarios.")
        print(f"JSON report: {json_path}")
        print(f"Markdown report: {md_path}")
        for name, m in report["methods"].items():
            print(f"\n{name}")
            print(f"  expected-decision fixture accuracy: {m['expected_decision_accuracy']:.1%}")
            print(f"  attribution coverage: {m['attribution_coverage']:.1%}")
            print(f"  correct abstention on should-abstain cases: {m['abstention_rate_on_cases_that_should_abstain']:.1%}")
            print(f"  unsupported attribution on should-abstain cases: {m['unsupported_attribution_rate_on_cases_that_should_abstain']:.1%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
