"""Mutation-oriented invariant tests against adversarial edits to synthetic fixtures."""
import copy
import unittest
from datetime import timedelta

from diagnose import diagnose
from holdout_validation import BASE, build_holdout_cases, records_for, STAGES, make_record


def candidate_stage(report):
    if report.get("confidence_label") == "candidate transition only" and report.get("attribution_permitted"):
        for item in report.get("hypotheses", []):
            if item.get("status") == "observed_positive":
                return item.get("stage")
    return None


class AdversarialMutationTests(unittest.TestCase):
    def setUp(self):
        case = next(c for c in build_holdout_cases() if c.case_id == "holdout_clean_collection_transition")
        self.clean = copy.deepcopy(case.records)
        self.assertEqual(candidate_stage(diagnose(self.clean)), "collection")

    def assert_mutation_blocks_attribution(self, mutation, expected_finding=None):
        rows = copy.deepcopy(self.clean)
        mutation(rows)
        report = diagnose(rows)
        self.assertFalse(report["attribution_permitted"])
        self.assertIsNone(candidate_stage(report))
        if expected_finding:
            self.assertIn(expected_finding, [finding["code"] for finding in report["findings"]])

    def test_duplicate_identifier_mutation_blocks(self):
        self.assert_mutation_blocks_attribution(lambda rows: rows[1].update(recordCode=rows[0]["recordCode"]), "duplicate_record_identifier")

    def test_qc_unknown_mutation_blocks(self):
        self.assert_mutation_blocks_attribution(lambda rows: rows[1].update(blankControl="not_recorded"), "record_excluded")

    def test_batch_swap_mutation_blocks(self):
        self.assert_mutation_blocks_attribution(lambda rows: rows[2].update(batchId="HOLDOUT-OTHER-BATCH"), "lineage_unproven")

    def test_analyte_swap_mutation_blocks(self):
        self.assert_mutation_blocks_attribution(lambda rows: rows[2].update(analyte="e_coli_concentration", result="quantified", numericValue=1.0, unit="MPN/100mL"), "mixed_analyte_pathway")

    def test_sample_identity_reuse_mutation_blocks(self):
        self.assert_mutation_blocks_attribution(lambda rows: rows[2].update(sampleCode=rows[0]["sampleCode"]), "sample_identity_reused_across_stages")

    def test_equal_time_mutation_blocks(self):
        self.assert_mutation_blocks_attribution(lambda rows: rows[1].update(collectedAt=rows[0]["collectedAt"]), "timeline_conflict")

    def test_discordant_repeat_mutation_blocks(self):
        def mutate(rows):
            rows.append(make_record("collection", "not_detected", 99, timestamp=BASE + timedelta(hours=1, minutes=5)))
        self.assert_mutation_blocks_attribution(mutate, "discordant_stage_results")

    def test_reordering_records_does_not_change_decision(self):
        original = diagnose(self.clean)
        reversed_report = diagnose(list(reversed(self.clean)))
        self.assertEqual(original["conclusion"], reversed_report["conclusion"])
        self.assertEqual(original["confidence_label"], reversed_report["confidence_label"])
        self.assertEqual(original["attribution_permitted"], reversed_report["attribution_permitted"])
        self.assertEqual([h["status"] for h in original["hypotheses"]], [h["status"] for h in reversed_report["hypotheses"]])

    def test_off_lineage_result_cannot_change_all_negative_pathway(self):
        rows = records_for({stage: "not_detected" for stage in STAGES})
        before = candidate_stage(diagnose(rows))
        rows.append(make_record("storage", "detected", 90, batch="UNRELATED-BATCH", timestamp=BASE + timedelta(hours=2, minutes=20)))
        after_report = diagnose(rows)
        self.assertIsNone(before)
        self.assertIsNone(candidate_stage(after_report))
        self.assertIn("off_lineage_records", [finding["code"] for finding in after_report["findings"]])

    def test_same_stage_positive_and_negative_are_not_resolved_by_positive_wins(self):
        rows = copy.deepcopy(self.clean)
        rows.append(make_record("collection", "not_detected", 91, timestamp=BASE + timedelta(hours=1, minutes=5)))
        report = diagnose(rows)
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("discordant_stage_results", [finding["code"] for finding in report["findings"]])


if __name__ == "__main__":
    unittest.main()
