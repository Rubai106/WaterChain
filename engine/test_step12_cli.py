"""CLI integration tests for the explicit journey relationship model."""
import json
import subprocess
import sys
import unittest
from pathlib import Path
from test_explicit_journey import model, record  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine" / "diagnose_cli.py"


class Step12CliTests(unittest.TestCase):
    def make_payload(self):
        records = [
            record("source", "not_detected", 1, None),
            record("collection", "not_detected", 2, "transport-01"),
            record("storage", "not_detected", 3, "storage-01"),
            record("serving", "detected", 4, "serving-01"),
        ]
        return {"records": records, "journey_model": model(records)}

    def invoke(self, payload):
        return subprocess.run(
            [sys.executable, str(ENGINE)], input=json.dumps(payload), text=True,
            capture_output=True, cwd=ROOT, timeout=10,
        )

    def test_cli_reviews_explicit_relationships_without_batch_id_conflation(self):
        result = self.invoke(self.make_payload())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["evidence_summary"]["lineage_mode"], "explicit_journey")
        self.assertTrue(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "candidate transition only")
        self.assertEqual(report["evidence_summary"]["pathway_batch_id"], None)

    def test_cli_abstains_when_source_identifier_mapping_disagrees(self):
        payload = self.make_payload()
        payload["journey_model"]["source"]["sourceIdentifier"] = "WRONG-SOURCE"
        result = self.invoke(payload)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "journey_source_identifier_mismatch" for f in report["findings"]))

    def test_cli_abstains_when_documented_transfer_has_no_reference(self):
        payload = self.make_payload()
        payload["journey_model"]["transferEvents"][0]["sourceReference"] = None
        result = self.invoke(payload)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "transfer_support_reference_missing" for f in report["findings"]))


if __name__ == "__main__":
    unittest.main()
