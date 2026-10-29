"""Step 18 comparative evaluation: WaterChain vs a documented naive baseline.

WHAT THIS IS
- A reproducible, developer-authored comparison of WaterChain's diagnostic
  engine against a deliberately naive baseline on synthetic fixture cases.
- The baseline ("naive first-positive") predicts the earliest stage with a raw
  positive result and never abstains unless no positive exists. It ignores
  lineage, QC, methods, timestamps, duplicates, and discordant results.

AUTHENTICITY AND LIMITS (read before citing any number)
- All scenarios are synthetic fixtures authored by the auditor in Step 18 with
  full knowledge of the engine's decision rules. The engine was designed and
  tuned on earlier fixtures (Steps 6-16), so high conformance here is fixture
  conformance, not real-world diagnostic accuracy.
- The blind independent-review packet (validation/reviewer_packet.json,
  engine/build_reviewer_packet.py) is the instrument for independent review;
  external reviewer results are pending and no external review is claimed.
- Do not report these figures as accuracy, validation, or evidence of product
  effectiveness.

SCENARIO TYPES COVERED
- clean transitions (anchor cases), all-negative, source-positive-origin
- duplicate record identifiers, discordant repeat observations at one stage
- omission sensitivity (removing the pivotal positive changes the decision)
- omission stability (removing one of two redundant positives keeps it)
- invalid numeric value (NaN), missing timestamp, unsupported analyte
- unrelated source identity, failed QC on the pivotal positive

METRICS
- unsupported_attribution_rate: share of should-abstain cases where a stage is
  named as an attribution anyway.
- correct_abstention_rate: share of should-abstain cases with no attribution.
- attribution_correctness: share of should-attribute cases where the predicted
  stage matches the expected stage.
- invalid_evidence_detection: share of records marked should_be_excluded that
  the engine's eligibility gate actually excludes.
- recommendation_quality: fraction of a fixed six-check rubric passing for the
  engine's next-action planner (applies to WaterChain only; the naive baseline
  has no recommendation mechanism).
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from copy import deepcopy
from datetime import timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
from diagnose import diagnose  # noqa: E402
from evaluate import (  # noqa: E402
    BASE_TIME,
    STAGES,
    Scenario,
    base_records,
    baseline_predict,
    engine_predict,
    make_record,
)

LAB = "STEP18 FIXTURE ONLY"
NOTE = "Step 18 synthetic comparison fixture; not a real sample or laboratory result."

BANNED_ASSERTION_PHRASES = (
    "originated", "caused by", "is the source of contamination", "proves",
    "probability of", "95%", "chance of", "guaranteed",
)


def cmp_record(stage: str, result: str, index: int, **overrides: Any) -> dict[str, Any]:
    rec = make_record(stage, result, 900 + index)
    rec["labName"] = LAB
    rec["notes"] = NOTE
    for key, value in overrides.items():
        rec[key] = value
    return rec


def cmp_base(results: dict[str, str], **overrides: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, stage in enumerate(STAGES):
        kw = dict(overrides.get(stage, {}))
        kw.setdefault("labName", LAB)
        rec = cmp_record(stage, results.get(stage, "not_tested"), i, **kw)
        out.append(rec)
    return out


class CmpScenario(Scenario):
    """Scenario plus Step 18 comparison metadata."""

    def __init__(
        self,
        scenario_id: str,
        description: str,
        records: list[dict[str, Any]],
        expected_decision: str | None,
        latent_ground_truth_entry_stage: str | None,
        identifiability: str,
        *,
        excluded_record_ids: list[str] | None = None,
        expected_action_ids: list[str] | None = None,
        omit_ids: list[str] | None = None,
        omit_expected_decision: str | None = None,
    ) -> None:
        super().__init__(scenario_id, description, records, expected_decision,
                         latent_ground_truth_entry_stage, identifiability)
        self.excluded_record_ids = excluded_record_ids or []
        self.expected_action_ids = expected_action_ids or []
        self.omit_ids = omit_ids or []
        self.omit_expected_decision = omit_expected_decision


def build_cmp18_scenarios() -> list[CmpScenario]:
    scenarios: list[CmpScenario] = []

    # Anchors -----------------------------------------------------------------
    scenarios.append(CmpScenario(
        "cmp18-clean-serving", "Source, collection, storage negative; serving positive.",
        cmp_base({"source": "not_detected", "collection": "not_detected",
                  "storage": "not_detected", "serving": "detected"}),
        "serving", "serving", "identifiable_by_fixture_design",
        expected_action_ids=["paired-follow-up"]))
    scenarios.append(CmpScenario(
        "cmp18-clean-collection", "Source negative; collection, storage, serving positive.",
        cmp_base({"source": "not_detected", "collection": "detected",
                  "storage": "detected", "serving": "detected"}),
        "collection", "collection", "identifiable_by_fixture_design",
        expected_action_ids=["paired-follow-up"]))

    # Duplicate record identifier ----------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "not_detected", "serving": "detected"})
    dup = deepcopy(recs[3])
    recs.append(dup)  # same recordCode and id: a duplicated import row
    scenarios.append(CmpScenario(
        "cmp18-duplicate-identifier", "Serving positive row duplicated with identical record identifier.",
        recs, None, "serving", "not_identifiable_due_to_duplicate_identifier",
        excluded_record_ids=[],
        expected_action_ids=["paired-follow-up"]))

    # Discordant repeats ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "not_detected", "serving": "detected"})
    repeat = cmp_record("serving", "not_detected", 40)
    recs.append(repeat)
    scenarios.append(CmpScenario(
        "cmp18-discordant-repeats", "Serving has one detected and one not_detected result.",
        recs, None, "serving", "not_identifiable_due_to_discordant_results",
        expected_action_ids=["repeat-discordant"]))

    # Omission sensitivity ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "not_detected", "serving": "detected"})
    pivotal = recs[3]["id"]
    scenarios.append(CmpScenario(
        "cmp18-omission-sensitive", "Clean serving transition; omitting the serving positive removes the transition.",
        recs, "serving", "serving", "identifiable_by_fixture_design",
        expected_action_ids=["paired-follow-up"],
        omit_ids=[pivotal], omit_expected_decision=None))

    # Omission stability ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "detected", "serving": "detected"})
    extra = cmp_record("storage", "detected", 41, sampleCode="CMP18-SAMPLE-EXTRA")
    recs.append(extra)
    scenarios.append(CmpScenario(
        "cmp18-omission-stable", "Clean storage transition with a second redundant storage positive.",
        recs, "storage", "storage", "identifiable_by_fixture_design",
        expected_action_ids=["paired-follow-up"],
        omit_ids=[extra["id"]], omit_expected_decision="storage"))

    # Invalid numeric value (NaN) ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "detected", "serving": "detected"})
    recs[2]["numericValue"] = float("nan")
    scenarios.append(CmpScenario(
        "cmp18-invalid-numeric", "Storage positive carries a NaN numeric value.",
        recs, None, "storage", "not_identifiable_due_to_invalid_value",
        excluded_record_ids=[recs[2]["id"]],
        expected_action_ids=["qc-method-review"]))

    # Missing timestamp ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "detected", "serving": "detected"})
    recs[2]["collectedAt"] = ""
    scenarios.append(CmpScenario(
        "cmp18-missing-timestamp", "Storage positive has no collection timestamp.",
        recs, None, "storage", "not_identifiable_due_to_missing_timestamp",
        excluded_record_ids=[recs[2]["id"]],
        expected_action_ids=["qc-method-review"]))

    # Unsupported analyte ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "detected",
                     "storage": "detected", "serving": "detected"})
    recs[1]["analyte"] = "turbidity"
    scenarios.append(CmpScenario(
        "cmp18-unsupported-analyte", "Collection positive tests an analyte outside engine scope.",
        recs, None, "collection", "not_identifiable_for_current_engine",
        excluded_record_ids=[recs[1]["id"]],
        expected_action_ids=["qc-method-review"]))

    # Unrelated source identity ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "not_detected",
                     "storage": "not_detected", "serving": "detected"})
    recs[3]["waterSourceId"] = "S-CMP18-OTHER"
    scenarios.append(CmpScenario(
        "cmp18-unrelated-source", "Serving positive claims a different source identity.",
        recs, None, "serving", "not_identifiable_due_to_source_conflict",
        expected_action_ids=["reconcile-source-id"]))

    # Failed QC on the pivotal positive ---------------------------------------------------------
    recs = cmp_base({"source": "not_detected", "collection": "detected",
                     "storage": "detected", "serving": "detected"})
    recs[1]["blankControl"] = "fail"
    scenarios.append(CmpScenario(
        "cmp18-failed-qc", "Collection positive has a recorded blank-control failure.",
        recs, None, "collection", "not_identifiable_due_to_failed_qc",
        excluded_record_ids=[recs[1]["id"]],
        expected_action_ids=["qc-method-review"]))

    # All positive at the earliest stage ---------------------------------------------------------
    scenarios.append(CmpScenario(
        "cmp18-source-positive-all", "Every stage positive; the earliest sampled stage cannot establish origin.",
        cmp_base({s: "detected" for s in STAGES}),
        None, "source", "origin_not_identifiable_from_stage_sequence",
        expected_action_ids=["paired-follow-up"]))

    # All negative ---------------------------------------------------------
    scenarios.append(CmpScenario(
        "cmp18-all-negative", "All four linked records report not detected.",
        cmp_base({s: "not_detected" for s in STAGES}),
        None, None, "no_positive_transition_observed",
        expected_action_ids=["paired-follow-up"]))

    return scenarios


def score_action_quality(report: dict[str, Any], scenario: CmpScenario) -> dict[str, Any]:
    """Fixed six-check rubric for the next-action planner (WaterChain only)."""
    actions = report.get("next_actions", []) or []
    excluded_ids = set(scenario.excluded_record_ids)
    checks: dict[str, bool] = {}
    texts = []
    for action in actions:
        text = " ".join(str(action.get(k, "")) for k in ("title", "why", "what_positive_would_mean", "what_negative_would_mean"))
        texts.append(text)
    checks["complete_fields"] = all(
        action.get("why") and action.get("what_positive_would_mean")
        and action.get("what_negative_would_mean") and action.get("prerequisites")
        for action in actions
    ) if actions else False
    checks["unique_ids_capped"] = (len({a.get("id") for a in actions}) == len(actions) and len(actions) <= 8)
    checks["no_origin_assertion"] = not any(
        phrase in text.lower() for phrase in BANNED_ASSERTION_PHRASES for text in texts
    )
    checks["no_excluded_citation"] = not any(rid in text for rid in excluded_ids for text in texts)
    checks["expected_actions_present"] = all(
        any(a.get("id") == expected for a in actions) for expected in scenario.expected_action_ids
    ) if scenario.expected_action_ids else True
    checks["addresses_case"] = bool(actions)
    return {"checks": checks, "score": sum(checks.values()) / len(checks), "action_count": len(actions)}


def predict(report: dict[str, Any]) -> str | None:
    if report.get("confidence_label") == "candidate transition only" and report.get("attribution_permitted"):
        for hypothesis in report.get("hypotheses", []):
            if hypothesis.get("status") == "observed_positive":
                return hypothesis.get("stage")
    return None


def assess_exclusions(report: dict[str, Any], scenario: CmpScenario) -> dict[str, Any]:
    eligibility = {entry.get("record_id"): entry.get("eligible", True) for entry in report.get("record_eligibility", [])}
    detected = sum(1 for rid in scenario.excluded_record_ids if eligibility.get(rid) is False)
    return {"expected_excluded": len(scenario.excluded_record_ids), "actually_excluded": detected}


def compare(api_url: str | None = None) -> dict[str, Any]:
    scenarios = build_cmp18_scenarios()
    results: list[dict[str, Any]] = []
    skipped_api: list[str] = []
    for scenario in scenarios:
        if api_url:
            if api_ready(scenario.records) is None:
                skipped_api.append(scenario.scenario_id)
                continue
            report = post_api(api_url, scenario.records)
        else:
            report = diagnose(deepcopy(scenario.records))
        wc_pred = predict(report)
        base_pred = baseline_predict(deepcopy(scenario.records))
        item: dict[str, Any] = {
            "scenario_id": scenario.scenario_id,
            "description": scenario.description,
            "expected_decision": scenario.expected_decision,
            "waterchain_prediction": wc_pred,
            "waterchain_matches_expected": wc_pred == scenario.expected_decision,
            "baseline_prediction": base_pred,
            "baseline_matches_expected": base_pred == scenario.expected_decision,
            "exclusions": assess_exclusions(report, scenario),
            "action_quality": score_action_quality(report, scenario),
        }
        if scenario.omit_ids:
            remaining = [r for r in scenario.records if r["id"] not in scenario.omit_ids]
            if api_url and api_ready(remaining) is None:
                item["omission"] = {"skipped_in_api_mode": True, "reason": "non-finite numeric value"}
            else:
                omit_report = post_api(api_url, remaining) if api_url else diagnose(deepcopy(remaining))
                omit_pred = predict(omit_report)
                item["omission"] = {
                    "omitted_ids": scenario.omit_ids,
                    "baseline_prediction": wc_pred,
                    "post_omission_prediction": omit_pred,
                    "expected_post_omission": scenario.omit_expected_decision,
                    "post_omission_matches_expected": omit_pred == scenario.omit_expected_decision,
                }
        results.append(item)

    def metrics(key: str, match_key: str) -> dict[str, Any]:
        abstain_cases = [r for r in results if r["expected_decision"] is None]
        attr_cases = [r for r in results if r["expected_decision"] is not None]
        unsupported = [r for r in abstain_cases if r[key] is not None]
        return {
            "cases": len(results),
            "should_abstain": len(abstain_cases),
            "should_attribute": len(attr_cases),
            "unsupported_attribution_rate": (len(unsupported) / len(abstain_cases)) if abstain_cases else None,
            "correct_abstention_rate": ((len(abstain_cases) - len(unsupported)) / len(abstain_cases)) if abstain_cases else None,
            "attribution_correctness": (sum(1 for r in attr_cases if r[match_key]) / len(attr_cases)) if attr_cases else None,
            "fixture_conformance": sum(1 for r in results if r[match_key]) / len(results),
        }

    exclusion_total = sum(r["exclusions"]["expected_excluded"] for r in results)
    exclusion_hit = sum(r["exclusions"]["actually_excluded"] for r in results)
    action_scores = [r["action_quality"]["score"] for r in results]

    return {
        "engine": "waterchain-rule-engine-v1",
        "baseline_description": "naive first-positive baseline (earliest raw positive; no abstention logic)",
        "via_api": bool(api_url),
        "waterchain": metrics("waterchain_prediction", "waterchain_matches_expected"),
        "baseline": metrics("baseline_prediction", "baseline_matches_expected"),
        "invalid_evidence_detection_rate": (exclusion_hit / exclusion_total) if exclusion_total else None,
        "recommendation_quality_mean": sum(action_scores) / len(action_scores) if action_scores else None,
        "omission_sensitivity": [
            {"scenario_id": r["scenario_id"], **r["omission"]} for r in results if "omission" in r
        ],
        "skipped_in_api_mode": skipped_api,
        "scenarios": results,
        "disclosure": (
            "Developer-authored comparison set (Step 18). The engine was designed and tuned on earlier fixtures, "
            "so conformance measures fixture conformance, not real-world accuracy. The naive baseline is deliberately "
            "naive. Independent blind review is pending via validation/reviewer_packet.json."
        ),
    }


def api_ready(records: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    """Adapt fixtures to the API's request schema without changing scenario semantics.

    - createdAt is a transport-required record-metadata field; it does not affect
      the diagnostic rules (the engine gates on collectedAt, not createdAt).
    - Non-finite numericValue cannot be expressed in JSON; the API intentionally
      rejects such payloads (z.number().finite()). Scenarios using them are
      skipped in API mode and remain covered in-process.
    """
    import math
    out: list[dict[str, Any]] = []
    for record in records:
        val = record.get("numericValue")
        if val is not None and (isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val)):
            return None
        adapted = dict(record)
        adapted.setdefault("createdAt", "2026-01-01T08:00:00+00:00")
        out.append(adapted)
    return out


def post_api(api_url: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    adapted = api_ready(records)
    if adapted is None:
        raise ValueError("scenario contains a non-finite numeric value that JSON cannot carry")
    payload = json.dumps({"records": adapted}).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/api/diagnose", data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read().decode("utf-8")
    parsed = json.loads(body)
    # The API wraps the engine report in an envelope; unwrap it so the
    # comparison reads the same DiagnosticReport shape as the in-process route.
    if isinstance(parsed, dict) and isinstance(parsed.get("report"), dict):
        return parsed["report"]
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-out", default="engine/step18_comparison_report.json")
    parser.add_argument("--markdown-out", default="engine/step18_comparison_report.md")
    parser.add_argument("--api", default=None, help="Run every scenario through the real /api/diagnose endpoint (e.g. http://localhost:3107)")
    args = parser.parse_args()
    report = compare(api_url=args.api)
    json_out = Path(args.json_out)
    json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    def row(label: str, key: str) -> str:
        m = report["waterchain"] if label == "WaterChain" else report["baseline"]
        pct = lambda v: "n/a" if v is None else f"{v * 100:.1f}%"
        return (f"| {label} | {pct(m['fixture_conformance'])} | {pct(m['unsupported_attribution_rate'])} | "
                f"{pct(m['correct_abstention_rate'])} | {pct(m['attribution_correctness'])} |")

    md = f"""# Step 18 comparative evaluation report

> Developer-authored fixtures; fixture conformance only. Not real-world accuracy.
> See engine/COMPARATIVE_EVALUATION_PROTOCOL.md.

- Engine: {report['engine']}
- Baseline: {report['baseline_description']}
- Route: {"real /api/diagnose at " + args.api if args.api else "in-process diagnose() (same function the API shells out to)"}
- Scenarios: {report['waterchain']['cases']}

| Method | Fixture conformance | Unsupported attribution rate | Correct abstention | Attribution correctness |
| --- | --- | --- | --- | --- |
{row("WaterChain", "")}
{row("Naive baseline", "")}

- Invalid-evidence detection rate (engine eligibility gate): {report['invalid_evidence_detection_rate'] if report['invalid_evidence_detection_rate'] is None else f"{report['invalid_evidence_detection_rate']*100:.1f}%"}
- Recommendation-quality rubric mean (WaterChain only): {report['recommendation_quality_mean'] if report['recommendation_quality_mean'] is None else f"{report['recommendation_quality_mean']*100:.1f}%"}

## Omission sensitivity

"""
    for om in report["omission_sensitivity"]:
        md += (f"- {om['scenario_id']}: baseline {om['baseline_prediction']} -> post-omission {om['post_omission_prediction']} "
               f"(expected {om['expected_post_omission']}); match={om['post_omission_matches_expected']}\n")

    md += "\n## Per-scenario results\n\n| Scenario | Expected | WaterChain | Baseline | WC match | BL match | Action quality |\n| --- | --- | --- | --- | --- | --- | --- |\n"
    for r in report["scenarios"]:
        md += (f"| {r['scenario_id']} | {r['expected_decision']} | {r['waterchain_prediction']} | "
               f"{r['baseline_prediction']} | {r['waterchain_matches_expected']} | {r['baseline_matches_expected']} | "
               f"{r['action_quality']['score']*100:.0f}% |\n")
    md += f"\n{report['disclosure']}\n"
    Path(args.markdown_out).write_text(md, encoding="utf-8")
    print(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
