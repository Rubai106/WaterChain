"""Step 16 regression tests for single-record evidence-availability sensitivity.

These are controlled synthetic software fixtures, not real water-quality data.
"""
from __future__ import annotations
import copy
import unittest
from diagnose import diagnose


def clean_pathway_records():
    rows = []
    stages = ("source", "collection", "storage", "serving")
    results = ("not_detected", "not_detected", "not_detected", "detected")
    for index, (stage, result) in enumerate(zip(stages, results), start=1):
        rows.append({
            "id": f"step16-{index}",
            "recordCode": f"SENS-{index:02d}",
            "sampleCode": f"SENS-SAMPLE-{index:02d}",
            "stage": stage,
            "collectedAt": f"2026-01-01T{7 + index:02d}:00:00+00:00",
            "waterSourceId": "SRC-STEP16",
            "batchId": "BATCH-STEP16",
            "analyte": "e_coli_presence",
            "result": result,
            "numericValue": None,
            "unit": None,
            "method": "membrane filtration",
            "labName": "Synthetic QA fixture",
            "positiveControl": "pass",
            "negativeControl": "pass",
            "blankControl": "pass",
            "sourceReference": f"SYNTHETIC-REF-{index}",
            "notes": "Synthetic Step 16 software fixture; not a real sample.",
        })
    return rows


class Step16SensitivityTests(unittest.TestCase):
    def test_baseline_fixture_has_candidate_transition_not_causal_proof(self):
        report = diagnose(clean_pathway_records())
        self.assertTrue(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "candidate transition only")
        self.assertIn("not definitive causal proof", report["conclusion"])

    def test_omitting_each_single_record_withholds_candidate_transition(self):
        records = clean_pathway_records()
        baseline = diagnose(records)
        self.assertTrue(baseline["attribution_permitted"])
        for omitted in records:
            with self.subTest(record=omitted["recordCode"]):
                report = diagnose([record for record in records if record["id"] != omitted["id"]])
                self.assertFalse(report["attribution_permitted"])
                self.assertNotEqual(report["confidence_label"], "candidate transition only")

    def test_sensitivity_scenarios_do_not_mutate_original_evidence(self):
        records = clean_pathway_records()
        original = copy.deepcopy(records)
        for omitted in records:
            diagnose([record for record in records if record["id"] != omitted["id"]])
        self.assertEqual(records, original)

    def test_each_scenario_is_still_an_observation_review_not_a_probability(self):
        records = clean_pathway_records()
        report = diagnose([record for record in records if record["id"] != "step16-4"])
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any("observed result" in limitation.lower() and "contamination entered" in limitation.lower() for limitation in report["limitations"]))
        self.assertTrue(any("no calibrated probabilities" in limitation.lower() for limitation in report["limitations"]))

if __name__ == "__main__":
    unittest.main()
