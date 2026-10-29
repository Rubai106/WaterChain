from __future__ import annotations
import csv
import json
import sys
import tempfile
import unittest
import zipfile
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import score_independent_review as reviewer
import analyze_user_evaluation as user_eval


class IndependentReviewScoringTests(unittest.TestCase):
    def test_fully_completed_synthetic_review_scores_only_author_rubric_agreement(self):
        packet, case_map = reviewer.load_packet(HERE / "reviewer_packet_step18.json")
        with tempfile.TemporaryDirectory() as temp:
            responses = Path(temp) / "responses.csv"
            with responses.open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=sorted(reviewer.REQUIRED_COLUMNS))
                writer.writeheader()
                for case_id, expected in case_map.items():
                    writer.writerow({
                        "review_case_id": case_id,
                        "decision": expected["expected_decision"],
                        "candidate_stage": expected["expected_stage"],
                        "supporting_record_ids": "SYN-REC-900",
                        "limitations_or_conflicts": "Synthetic case only",
                        "rationale": "Test-only deterministic response",
                        "rule_issue": "no",
                        "rule_issue_description": "",
                    })
            rows, errors = reviewer.read_responses(responses, case_map)
            report = reviewer.summarize(rows, packet, errors)
        self.assertEqual(errors, [])
        self.assertEqual(report["status"], "COMPLETE")
        self.assertEqual(report["valid_responses"], 13)
        self.assertEqual(report["author_rubric_agreement_rate_among_determinate"], 1.0)
        self.assertIn("not real-world accuracy", report["disclosure"])

    def test_packet_hash_tampering_is_rejected(self):
        packet = json.loads((HERE / "reviewer_packet_step18.json").read_text(encoding="utf-8"))
        packet["cases"][0]["records"][0]["notes"] = "modified"
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "packet.json"
            path.write_text(json.dumps(packet), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                reviewer.load_packet(path)

    def test_incomplete_reviewer_responses_are_not_marked_complete(self):
        packet, case_map = reviewer.load_packet(HERE / "reviewer_packet_step18.json")
        rows = [{"review_case_id": next(iter(case_map)), "decision": "abstain", "candidate_stage": "",
                 "expected_decision": "abstain", "expected_stage": "", "supported_expectation_agreement": True,
                 "rule_issue": "no"}]
        report = reviewer.summarize(rows, packet, ["Missing valid reviewer responses for 12 cases"])
        self.assertEqual(report["status"], "INCOMPLETE_OR_INVALID")


class UserEvaluationAnalysisTests(unittest.TestCase):
    def _row(self, code, workflow, time, set_name, order="spreadsheet_first"):
        return {
            "participant_code": code, "workflow": workflow, "order": order, "task_set": set_name,
            "completed": True, "gap_list_completed": True, "time_to_identify_gaps_min": time + 2, "time_to_complete_min": time, "unsupported_conclusions": 1 if workflow == "spreadsheet" else 0,
            "unresolved_relationships_seeded": 2, "unresolved_relationships_flagged": 1 if workflow == "spreadsheet" else 2,
            "evidence_gaps_seeded": 4, "evidence_gaps_flagged": 2 if workflow == "spreadsheet" else 4,
            "next_action_gap_score_0_2": 1, "next_action_no_origin_score_0_2": 1,
            "next_action_prerequisites_score_0_2": 1 if workflow == "spreadsheet" else 2,
            "quiz_correct_0_3": 2 if workflow == "spreadsheet" else 3,
            "usability_rating_1_5": 3 if workflow == "spreadsheet" else 4,
        }

    def test_paired_analysis_uses_consistent_direction(self):
        rows = [self._row("P01", "spreadsheet", 12, "A"), self._row("P01", "waterchain", 8, "B")]
        report = user_eval.analyze(rows, [])
        self.assertEqual(report["complete_pairs"], 1)
        self.assertEqual(report["metrics"]["completion_adjusted_time_minutes"]["mean_paired_difference_favoring_waterchain"], 4.0)
        self.assertEqual(report["metrics"]["time_to_identify_gaps_minutes"]["mean_paired_difference_favoring_waterchain"], 4.0)
        self.assertEqual(report["metrics"]["unsupported_conclusions_count"]["mean_paired_difference_favoring_waterchain"], 1.0)
        self.assertEqual(report["metrics"]["evidence_gap_detection_rate"]["mean_paired_difference_favoring_waterchain"], 0.5)
        self.assertIn("does not calculate p-values", report["disclosure"])

    def test_same_task_set_for_both_workflows_is_reported_as_error(self):
        rows = [self._row("P02", "spreadsheet", 12, "A"), self._row("P02", "waterchain", 8, "A")]
        report = user_eval.analyze(rows, [])
        self.assertEqual(report["complete_pairs"], 0)
        self.assertTrue(any("different task sets" in e for e in report["validation_errors"]))


class PilotMaterialsTests(unittest.TestCase):
    def test_two_task_sets_have_balanced_seeded_gaps_and_transfer_schemas(self):
        base = HERE / "pilot_study"
        details = []
        for name in ("SET_A", "SET_B"):
            folder = base / name
            with (folder / "records.csv").open(encoding="utf-8", newline="") as f:
                records = list(csv.DictReader(f))
            with (folder / "transfers.csv").open(encoding="utf-8", newline="") as f:
                transfers = list(csv.DictReader(f))
            self.assertEqual(len(records), 7)
            self.assertEqual(len([r for r in records if r["stage"] in {"source", "collection", "storage", "serving"}][:4]), 4)
            self.assertTrue(any(r["blank_control"] == "fail" and r["result"] == "detected" for r in records))
            self.assertTrue(any("different source" in r["notes"].lower() for r in records))
            self.assertTrue(any("identity conflict" in r["notes"].lower() for r in records))
            self.assertEqual(len([t for t in transfers if not t["transfer_reference"].strip()]), 1)
            self.assertIn("SYNTHETIC", (folder / "records.csv").read_text(encoding="utf-8").upper())
            details.append((records, transfers))
        self.assertEqual([len(x[0]) for x in details], [7, 7])

    def test_planned_allocation_is_balanced_and_not_participant_data(self):
        path = HERE / "pilot_study" / "PLANNED_ASSIGNMENT_MATRIX_NOT_DATA.csv"
        with path.open(encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 12)
        self.assertEqual(len({r["participant_code"] for r in rows}), 12)
        self.assertEqual(Counter(r["order"] for r in rows), {"spreadsheet_first": 6, "waterchain_first": 6})
        self.assertEqual(Counter((r["spreadsheet_task_set"], r["waterchain_task_set"]) for r in rows), {("A", "B"): 6, ("B", "A"): 6})
        self.assertTrue(all("NO_PARTICIPANT_RECRUITED" in r["allocation_status"] for r in rows))

    def test_participant_kit_excludes_keys(self):
        script = HERE / "build_pilot_task_kits.py"
        import subprocess
        with tempfile.TemporaryDirectory() as temp:
            subprocess.run([sys.executable, str(script), "--out-dir", temp], check=True, capture_output=True, text=True)
            for set_name in ("A", "B"):
                archive_path = Path(temp) / f"WaterChain_Step19_Pilot_Task_Set_{set_name}.zip"
                with zipfile.ZipFile(archive_path) as archive:
                    names = archive.namelist()
                    self.assertEqual(len(names), 4)
                    self.assertFalse(any("ANSWER_KEY" in name.upper() or "ASSIGNMENT" in name.upper() for name in names))


if __name__ == "__main__":
    unittest.main(verbosity=2)
