"""Step 10 regression tests: per-record diagnostic eligibility.

The engine's report now exposes `record_eligibility` for every submitted
record so the frontend never has to guess whether a result is usable.
Eligibility is exactly the engine's own _usable gate; these tests pin
that mapping for the acceptance cases in the Step 10 brief. They do not
change any decision rule: attribution, hypotheses, and findings keep
their existing behaviour, and the evaluation/holdout baselines must
stay unchanged.
"""
import math
import unittest

from diagnose import diagnose


def rec(code, stage, result, time="2026-01-01T08:00:00Z", **overrides):
    record = {
        "id": code,
        "recordCode": code,
        "sampleCode": code,
        "stage": stage,
        "collectedAt": time,
        "waterSourceId": "SRC-1",
        "batchId": "B-1",
        "analyte": "e_coli_presence",
        "result": result,
        "method": "Membrane filtration",
        "numericValue": None,
        "unit": None,
        "labName": "City Lab",
        "sourceReference": "REF-1",
        "positiveControl": "pass",
        "negativeControl": "pass",
        "blankControl": "pass",
        "notes": None,
        "createdAt": "2026-01-01T00:00:00Z",
    }
    record.update(overrides)
    return record


def linked(serving_result="detected", serving_overrides=None, times=None):
    times = times or ["2026-01-01T08:00:00Z", "2026-01-01T09:00:00Z",
                      "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"]
    rows = [
        rec("L1", "source", "not_detected", times[0]),
        rec("L2", "collection", "not_detected", times[1]),
        rec("L3", "storage", "not_detected", times[2]),
        rec("L4", "serving", serving_result, times[3], **(serving_overrides or {})),
    ]
    return rows


def entry_for(report, code):
    matches = [e for e in report["record_eligibility"] if e["record_code"] == code]
    assert len(matches) == 1, f"expected exactly one eligibility entry for {code}"
    return matches[0]


def hypothesis_for(report, stage):
    return next(h for h in report["hypotheses"] if h["stage"] == stage)


class TestRecordEligibility(unittest.TestCase):
    def test_failed_blank_control_positive_is_not_eligible_positive(self):
        report = diagnose(linked(serving_overrides={"blankControl": "fail"}))
        entry = entry_for(report, "L4")
        self.assertFalse(entry["eligible"])
        self.assertEqual(entry["reason"], "Quality-control failure")
        self.assertEqual(entry["result_kind"], "positive")
        self.assertFalse(entry["on_pathway"])
        self.assertNotEqual(hypothesis_for(report, "serving")["status"], "observed_positive")
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("record_excluded", [f["code"] for f in report["findings"]])

    def test_missing_required_metadata_positive_is_excluded(self):
        for overrides in ({"method": ""}, {"batchId": ""}, {"collectedAt": None},
                          {"waterSourceId": ""}):
            with self.subTest(overrides=overrides):
                report = diagnose(linked(serving_overrides=overrides))
                entry = entry_for(report, "L4")
                self.assertFalse(entry["eligible"])
                self.assertNotEqual(hypothesis_for(report, "serving")["status"],
                                    "observed_positive")

    def test_unsupported_analyte_positive_is_not_usable(self):
        report = diagnose(linked(serving_overrides={"analyte": "turbidity"}))
        entry = entry_for(report, "L4")
        self.assertFalse(entry["eligible"])
        self.assertEqual(entry["reason"], "Unsupported analyte for pathway diagnosis")

    def test_invalid_quantitative_value_cannot_appear_eligible(self):
        for value in (float("nan"), float("inf"), True, "12"):
            with self.subTest(value=value):
                report = diagnose(linked(
                    serving_result="quantified",
                    serving_overrides={"analyte": "e_coli_concentration",
                                       "numericValue": value, "unit": "CFU/100mL"}))
                entry = entry_for(report, "L4")
                self.assertFalse(entry["eligible"])

    def test_clean_eligible_positive_is_displayed_correctly(self):
        report = diagnose(linked())
        entry = entry_for(report, "L4")
        self.assertTrue(entry["eligible"])
        self.assertEqual(entry["result_kind"], "positive")
        self.assertTrue(entry["on_pathway"])
        self.assertEqual(hypothesis_for(report, "serving")["status"], "observed_positive")
        self.assertTrue(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "candidate transition only")

    def test_eligible_negative_is_not_proof_of_absence(self):
        report = diagnose(linked(serving_result="not_detected"))
        entry = entry_for(report, "L4")
        self.assertTrue(entry["eligible"])
        self.assertEqual(entry["result_kind"], "negative")
        self.assertEqual(hypothesis_for(report, "serving")["status"], "no_positive_observed")
        self.assertIn("not proof", report["conclusion"].lower())

    def test_no_records_means_unassessed_everywhere(self):
        report = diagnose([])
        self.assertEqual(report["record_eligibility"], [])
        for hyp in report["hypotheses"]:
            self.assertEqual(hyp["status"], "not_assessed")
        self.assertFalse(report["attribution_permitted"])

    def test_conflicting_records_remain_ambiguous_but_individually_eligible(self):
        rows = linked()
        rows.append(rec("L5", "serving", "not_detected", "2026-01-01T12:00:00Z"))
        report = diagnose(rows)
        self.assertTrue(entry_for(report, "L4")["eligible"])
        self.assertTrue(entry_for(report, "L5")["eligible"])
        self.assertIn("discordant_stage_results", [f["code"] for f in report["findings"]])
        self.assertFalse(report["attribution_permitted"])

    def test_lineage_failure_is_case_level_not_record_eligibility(self):
        rows = linked()
        rows[3] = rec("L4", "serving", "detected", "2026-01-01T11:00:00Z", batchId="B-2")
        report = diagnose(rows)
        # The serving record itself passes the metadata gate; lineage is a
        # case-level property, so it stays eligible but off-pathway, and
        # attribution is blocked by the lineage findings.
        entry = entry_for(report, "L4")
        self.assertTrue(entry["eligible"])
        self.assertFalse(entry["on_pathway"])
        self.assertFalse(report["attribution_permitted"])
        codes = [f["code"] for f in report["findings"]]
        self.assertTrue("no_shared_batch_link" in codes or "lineage_unproven" in codes)

    def test_quantified_zero_is_neither_positive_nor_negative(self):
        report = diagnose(linked(
            serving_result="quantified",
            serving_overrides={"analyte": "e_coli_concentration",
                               "numericValue": 0, "unit": "CFU/100mL"}))
        entry = entry_for(report, "L4")
        self.assertTrue(entry["eligible"])
        self.assertEqual(entry["result_kind"], "neither")

    def test_eligibility_counts_match_evidence_summary(self):
        rows = linked(serving_overrides={"blankControl": "fail"})
        report = diagnose(rows)
        eligible = [e for e in report["record_eligibility"] if e["eligible"]]
        self.assertEqual(len(eligible), report["evidence_summary"]["eligible_records"])
        self.assertEqual(report["evidence_summary"]["eligible_by_stage"]["serving"], 0)

    def test_unknown_stage_record_is_excluded_with_reason(self):
        rows = linked()
        rows.append(rec("LX", "tap", "detected", "2026-01-01T12:00:00Z"))
        report = diagnose(rows)
        entry = entry_for(report, "LX")
        self.assertFalse(entry["eligible"])
        self.assertEqual(entry["reason"], "Unsupported pathway stage")


if __name__ == "__main__":
    unittest.main()
