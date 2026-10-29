import unittest
from holdout_validation import build_holdout_cases, evaluate_holdout


class HoldoutValidationTests(unittest.TestCase):
    def setUp(self):
        self.cases = build_holdout_cases()
        self.report = evaluate_holdout()

    def test_holdout_suite_is_separate_synthetic_development_set(self):
        self.assertGreaterEqual(len(self.cases), 12)
        self.assertTrue(self.report["not_real_world_performance"])
        self.assertIn("not independent or blinded", self.report["evaluation_type"])
        self.assertTrue(all("HOLDOUT" in str(record.get("recordCode", "")) for case in self.cases for record in case.records))

    def test_every_predeclared_holdout_decision_matches(self):
        failures = [case for case in self.report["cases"] if not case["matches_expected_decision"]]
        self.assertEqual(failures, [], msg=f"Holdout failures: {failures}")

    def test_discordant_repeats_are_blocked(self):
        case = next(c for c in self.report["cases"] if c["case_id"] == "holdout_discordant_storage_repeats")
        self.assertFalse(case["attribution_permitted"])
        self.assertIn("discordant_stage_results", case["finding_codes"])

    def test_off_lineage_positive_does_not_change_common_batch_prediction(self):
        case = next(c for c in self.report["cases"] if c["case_id"] == "holdout_off_lineage_positive")
        self.assertIsNone(case["prediction"])
        self.assertIn("off_lineage_records", case["finding_codes"])

    def test_multiple_common_batches_are_not_merged(self):
        case = next(c for c in self.report["cases"] if c["case_id"] == "holdout_two_common_batches")
        self.assertFalse(case["attribution_permitted"])
        self.assertIn("ambiguous_multiple_common_batches", case["finding_codes"])

    def test_results_include_no_real_world_claim(self):
        text = " ".join(self.report["limitations"]).lower()
        self.assertIn("real-world", text)
        self.assertIn("not independently blinded", text)


if __name__ == "__main__":
    unittest.main()
