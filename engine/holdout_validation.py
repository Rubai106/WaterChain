"""Separately defined developer holdout suite for adversarial rule-engine checks.

These are synthetic records, not real water-quality observations. This separate
module is not used by the original Step 5 scenario generator. It is a development
holdout, not an independent or blinded scientific evaluation.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from diagnose import diagnose

STAGES = ("source", "collection", "storage", "serving")
BASE = datetime(2026, 2, 10, 8, 0, tzinfo=timezone.utc)

@dataclass
class HoldoutCase:
    case_id: str
    purpose: str
    records: list[dict[str, Any]]
    expected_stage: str | None
    rationale: str


def make_record(stage: str, result: str, index: int, *, batch: str = "HOLDOUT-B1",
                source: str = "HOLDOUT-S1", sample: str | None = None,
                timestamp: datetime | str | None = None, qc: str = "pass",
                analyte: str = "e_coli_presence", numeric_value: float | None = None,
                unit: str | None = None, record_code: str | None = None) -> dict[str, Any]:
    collected = timestamp or BASE + timedelta(hours=STAGES.index(stage))
    if isinstance(collected, datetime):
        collected = collected.isoformat()
    code = record_code or f"HOLDOUT-REC-{index:03d}"
    return {
        "id": code,
        "recordCode": code,
        "sampleCode": sample or f"HOLDOUT-SAMPLE-{index:03d}",
        "stage": stage,
        "collectedAt": collected,
        "waterSourceId": source,
        "batchId": batch,
        "analyte": analyte,
        "result": result,
        "numericValue": numeric_value,
        "unit": unit,
        "method": "synthetic method listed for software test only",
        "labName": "SYNTHETIC HOLDOUT FIXTURE",
        "positiveControl": qc,
        "negativeControl": qc,
        "blankControl": qc,
        "sourceReference": "SYNTHETIC-NOT-A-REPORT",
        "notes": "Synthetic software test fixture; not a real sample or laboratory result.",
    }


def records_for(results: dict[str, str], **overrides: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for index, stage in enumerate(STAGES, 1):
        args = dict(overrides.get(stage, {}))
        rows.append(make_record(stage, results.get(stage, "not_tested"), index, **args))
    return rows


def build_holdout_cases() -> list[HoldoutCase]:
    cases: list[HoldoutCase] = []

    cases.append(HoldoutCase(
        "holdout_clean_collection_transition", "A new clean linked transition pattern at collection.",
        records_for({"source": "not_detected", "collection": "detected", "storage": "detected", "serving": "detected"}),
        "collection", "All stage records are eligible, share one batch and source, use the same analyte, and follow strict chronology."))

    cases.append(HoldoutCase(
        "holdout_clean_serving_transition", "Negative source/collection/storage and positive serving result.",
        records_for({"source": "not_detected", "collection": "not_detected", "storage": "not_detected", "serving": "detected"}),
        "serving", "One fully linked synthetic pathway with negative observations before the earliest positive."))

    cases.append(HoldoutCase(
        "holdout_no_positive", "All linked results are not detected.",
        records_for({stage: "not_detected" for stage in STAGES}), None,
        "No positive transition is observed; no stage attribution should be emitted."))

    # Discordant outcomes in the same stage and same batch.
    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows.append(make_record("storage", "not_detected", 5, timestamp=BASE + timedelta(hours=2, minutes=5)))
    cases.append(HoldoutCase("holdout_discordant_storage_repeats", "Storage has both detected and not-detected outcomes.", rows, None,
        "Discordant findings at a stage should be reviewed rather than letting a positive result automatically win."))

    # Duplicate evidence record identifiers, while keeping stage labels and samples distinct.
    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[1]["recordCode"] = rows[0]["recordCode"]
    cases.append(HoldoutCase("holdout_duplicate_record_id", "Two distinct rows share a record identifier.", rows, None,
        "Duplicate identifiers can indicate duplicated imports or misidentified records, so attribution must stop."))

    # A single physical sample identifier must not silently appear at all stages.
    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[2]["sampleCode"] = rows[0]["sampleCode"]
    cases.append(HoldoutCase("holdout_reused_sample_id", "Source and storage rows use the same sample ID.", rows, None,
        "Distinct pathway stages must have traceable, distinct physical samples for stage comparisons."))

    # A non-common batch positive must not contaminate the selected common batch's analysis.
    rows = records_for({stage: "not_detected" for stage in STAGES})
    rows.append(make_record("storage", "detected", 5, batch="HOLDOUT-B2", timestamp=BASE + timedelta(hours=2, minutes=5)))
    cases.append(HoldoutCase("holdout_off_lineage_positive", "A positive record exists only on a different batch from the shared pathway.", rows, None,
        "The engine should use only the unique batch linked across all four stages, not the unrelated batch's result."))

    # Two common batches represent two possible journeys and should not be merged.
    rows = records_for({stage: "not_detected" for stage in STAGES})
    rows.extend(make_record(stage, result, i + 5, batch="HOLDOUT-B2", timestamp=BASE + timedelta(hours=STAGES.index(stage), minutes=10))
                for i, (stage, result) in enumerate((("source", "not_detected"), ("collection", "not_detected"), ("storage", "detected"), ("serving", "detected"))))
    cases.append(HoldoutCase("holdout_two_common_batches", "Every stage contains evidence for two common batch identifiers.", rows, None,
        "The engine must not merge multiple possible water journeys into one transition claim."))

    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[2]["positiveControl"] = "not_recorded"
    cases.append(HoldoutCase("holdout_qc_incomplete", "A positive storage result has an undocumented control.", rows, None,
        "QC fields must explicitly pass for the result to be eligible for cross-stage inference."))

    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[2]["negativeControl"] = "fail"
    cases.append(HoldoutCase("holdout_qc_failed", "A positive storage result has a failed negative control.", rows, None,
        "A QC failure excludes the result from inference."))

    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[0]["collectedAt"] = BASE.isoformat()
    rows[1]["collectedAt"] = BASE.isoformat()
    cases.append(HoldoutCase("holdout_equal_adjacent_timestamps", "Source and collection timestamps are indistinguishable.", rows, None,
        "Equal timestamps do not establish strict order for the conceptual pathway."))

    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[2]["waterSourceId"] = "HOLDOUT-OTHER-SOURCE"
    cases.append(HoldoutCase("holdout_conflicting_sources", "A batch-associated record names a conflicting water source.", rows, None,
        "Source identity conflict prevents attribution across the purported path."))

    # Consistency of measurement target across stage records is required for comparison.
    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows[2]["analyte"] = "e_coli_concentration"
    rows[2]["result"] = "quantified"
    rows[2]["numericValue"] = 12.0
    rows[2]["unit"] = "MPN/100mL"
    cases.append(HoldoutCase("holdout_mixed_analytes", "Only the storage record switches from presence/absence to concentration.", rows, None,
        "Different analytes/results cannot be combined into one stage-transition claim."))

    # Quantitative result pattern with one consistent analyte across all stages.
    rows = records_for({stage: "not_detected" for stage in STAGES}, **{stage: {"analyte": "e_coli_concentration"} for stage in STAGES})
    rows[3]["result"] = "quantified"
    rows[3]["numericValue"] = 15.0
    rows[3]["unit"] = "MPN/100mL"
    cases.append(HoldoutCase("holdout_consistent_quantitative_serving", "One consistent quantitative analyte, positive serving concentration, negatives upstream.", rows, "serving",
        "The supported concentration format can be used when all stages use the same analyte and the quantitative value/unit are present."))

    # If the source stage is already positive, a later positive sequence cannot reveal origin time.
    cases.append(HoldoutCase(
        "holdout_source_positive_origin_unknown", "Source and downstream stages all report positive.",
        records_for({stage: "detected" for stage in STAGES}), None,
        "An observed source positive is not a claim that contamination originated there."))

    # Missing stage record should always cause abstention.
    rows = records_for({"source": "not_detected", "collection": "not_detected", "storage": "detected", "serving": "detected"})
    rows = [r for r in rows if r["stage"] != "collection"]
    cases.append(HoldoutCase("holdout_missing_collection", "Collection-stage evidence is absent.", rows, None,
        "A four-stage transition cannot be discussed when one stage lacks an eligible result."))

    return cases


def predict_candidate_stage(records: list[dict[str, Any]]) -> tuple[str | None, dict[str, Any]]:
    report = diagnose(records)
    if report.get("confidence_label") == "candidate transition only" and report.get("attribution_permitted"):
        for hypothesis in report.get("hypotheses", []):
            if hypothesis.get("status") == "observed_positive":
                return hypothesis.get("stage"), report
    return None, report


def evaluate_holdout() -> dict[str, Any]:
    cases = build_holdout_cases()
    results = []
    for case in cases:
        prediction, report = predict_candidate_stage(case.records)
        results.append({
            "case_id": case.case_id,
            "purpose": case.purpose,
            "expected_stage": case.expected_stage,
            "prediction": prediction,
            "matches_expected_decision": prediction == case.expected_stage,
            "attribution_permitted": report.get("attribution_permitted"),
            "confidence_label": report.get("confidence_label"),
            "finding_codes": [finding.get("code") for finding in report.get("findings", [])],
            "rationale": case.rationale,
        })
    total = len(results)
    correct = sum(1 for result in results if result["matches_expected_decision"])
    should_abstain = [result for result in results if result["expected_stage"] is None]
    unsupported = sum(1 for result in should_abstain if result["prediction"] is not None)
    should_attribute = [result for result in results if result["expected_stage"] is not None]
    return {
        "title": "WaterChain Step 6 development holdout and adversarial validation",
        "evaluation_type": "separately authored synthetic development holdout; not independent or blinded",
        "not_real_world_performance": True,
        "scenario_count": total,
        "expected_decision_conformance": round(correct / total, 4) if total else None,
        "correct_stage_decisions": correct,
        "abstention_cases": len(should_abstain),
        "unsupported_attributions_in_abstention_cases": unsupported,
        "unsupported_attribution_rate_in_abstention_cases": round(unsupported / len(should_abstain), 4) if should_abstain else None,
        "attribution_cases": len(should_attribute),
        "correct_attribution_cases": sum(1 for result in should_attribute if result["matches_expected_decision"]),
        "cases": results,
        "limitations": [
            "Every case is synthetic and authored by the developer; no real samples or lab results are present.",
            "The test set is separate from the Step 5 scenario generator but is not independently blinded or externally adjudicated.",
            "Conformance measures software behavior against hand-declared expected decisions, not real-world causal accuracy.",
            "The rule engine does not model intermittent contamination, sample sensitivity, transfer/refill graphs, or probabilistic uncertainty.",
            "Passing this suite does not establish safety, public-health utility, scientific validation, novelty, or superiority over other tools.",
        ],
    }
