"""Regression tests for the Step 18 comparative evaluation harness.

These tests run the developer-authored comparison set and assert the engine's
core guardrail invariants, plus structural properties of the report. They do
not establish real-world accuracy.
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from step18_compare import build_cmp18_scenarios, compare


class Step18ComparisonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = compare()

    def test_scenario_count(self):
        self.assertEqual(self.report["waterchain"]["cases"], 13)
        self.assertEqual(len(build_cmp18_scenarios()), 13)

    def test_no_unsupported_attributions(self):
        """Guardrail invariant: never name an attribution where abstention is required."""
        self.assertEqual(self.report["waterchain"]["unsupported_attribution_rate"], 0.0)

    def test_abstention_on_all_should_abstain_cases(self):
        self.assertEqual(self.report["waterchain"]["correct_abstention_rate"], 1.0)
        self.assertEqual(self.report["waterchain"]["should_abstain"], 9)

    def test_invalid_evidence_always_detected(self):
        self.assertEqual(self.report["invalid_evidence_detection_rate"], 1.0)

    def test_omission_sensitivity_matches_expected(self):
        for entry in self.report["omission_sensitivity"]:
            self.assertTrue(
                (entry["post_omission_prediction"] or None) == entry["expected_post_omission"],
                entry["scenario_id"],
            )

    def test_recommendation_rubric_passes(self):
        self.assertEqual(self.report["recommendation_quality_mean"], 1.0)
        for scenario in self.report["scenarios"]:
            for check, value in scenario["action_quality"]["checks"].items():
                self.assertTrue(value, f"{scenario['scenario_id']}.{check}")

    def test_baseline_is_documented_as_naive(self):
        self.assertIn("naive", self.report["baseline_description"].lower())
        self.assertIn("fixture conformance", self.report["disclosure"])

    def test_source_identity_conflict_produces_reconcile_action(self):
        """Step 18 fix: legacy-mode source identity conflict now yields a reconcile action."""
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from diagnose import diagnose
        scenario = next(s for s in build_cmp18_scenarios() if s.scenario_id == "cmp18-unrelated-source")
        actions = diagnose(scenario.records)["next_actions"]
        self.assertTrue(any(a["id"] == "reconcile-source-id" for a in actions))


if __name__ == "__main__":
    unittest.main()
