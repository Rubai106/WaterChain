import unittest
from evaluate import build_scenarios, score_predictions


class ControlledEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.scenarios = build_scenarios()
        self.report = score_predictions(self.scenarios)

    def test_fixture_suite_is_explicitly_synthetic(self):
        self.assertEqual(self.report["evaluation_type"], "synthetic deterministic fixtures only")
        self.assertTrue(self.report["not_real_world_performance"])
        self.assertEqual(self.report["scenario_count"], 15)
        for scenario in self.scenarios:
            self.assertTrue(all("SYN" in str(r.get("id", "")) for r in scenario.records))

    def test_waterchain_predicts_all_three_identifiable_transitions(self):
        identifiable = [s for s in self.report["scenario_results"] if s["expected_decision"] is not None]
        self.assertEqual(len(identifiable), 3)
        self.assertTrue(all(s["waterchain_prediction"] == s["expected_decision"] for s in identifiable))

    def test_waterchain_abstains_on_every_predeclared_should_abstain_case(self):
        abstain_cases = [s for s in self.report["scenario_results"] if s["expected_decision"] is None]
        self.assertEqual(len(abstain_cases), 12)
        self.assertTrue(all(s["waterchain_prediction"] is None for s in abstain_cases))

    def test_naive_baseline_overattributes_in_adversarial_cases(self):
        baseline = self.report["methods"]["Naive first-positive baseline"]
        self.assertGreater(baseline["unsupported_attribution_rate_on_cases_that_should_abstain"], 0.8)
        self.assertGreater(baseline["attribution_coverage"], self.report["methods"]["WaterChain"]["attribution_coverage"])

    def test_waterchain_report_contains_scope_limitations(self):
        self.assertTrue(any("synthetic test fixtures" in x for x in self.report["limitations"]))
        self.assertTrue(any("real-world" in x for x in self.report["limitations"]))


if __name__ == "__main__":
    unittest.main()
