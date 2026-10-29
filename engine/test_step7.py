"""Step 7 checks for reviewer-packet hygiene and process-boundary behavior."""
from __future__ import annotations
import json
import subprocess
import sys
import unittest
from pathlib import Path
from build_reviewer_packet import build_packet

ROOT = Path(__file__).resolve().parents[1]

class Step7ReviewAndIntegrationTests(unittest.TestCase):
    def test_reviewer_packet_has_no_predeclared_expected_decisions(self):
        packet = build_packet()
        self.assertGreater(packet["case_count"], 0)
        for case in packet["cases"]:
            self.assertNotIn("expected_stage", case)
            self.assertNotIn("expected_decision", case)
            self.assertNotIn("rationale", case)
            self.assertTrue(case["synthetic_only"])
            self.assertEqual(len(case["records_sha256"]), 64)

    def test_cli_empty_request_returns_valid_abstaining_report(self):
        process = subprocess.run(
            [sys.executable, "engine/diagnose_cli.py"], cwd=ROOT,
            input=json.dumps({"records": []}), text=True, capture_output=True, timeout=10,
        )
        self.assertEqual(process.returncode, 0, process.stderr)
        payload = json.loads(process.stdout)
        self.assertFalse(payload["attribution_permitted"])
        self.assertEqual(payload["evidence_summary"]["records_received"], 0)
        self.assertIn("conclusion", payload)
        self.assertIn("limitations", payload)

    def test_cli_rejects_request_without_records_array(self):
        process = subprocess.run(
            [sys.executable, "engine/diagnose_cli.py"], cwd=ROOT,
            input=json.dumps({"evidence": []}), text=True, capture_output=True, timeout=10,
        )
        self.assertEqual(process.returncode, 2)
        self.assertIn("records array", json.loads(process.stdout)["error"])

    def test_cli_handles_malformed_json_with_machine_readable_error(self):
        process = subprocess.run(
            [sys.executable, "engine/diagnose_cli.py"], cwd=ROOT,
            input="{not-json", text=True, capture_output=True, timeout=10,
        )
        self.assertEqual(process.returncode, 1)
        payload = json.loads(process.stdout)
        self.assertIn("Diagnostic engine failed", payload["error"])

    def test_cli_output_is_deterministic_for_same_payload(self):
        request = json.dumps({"records": []})
        outputs = []
        for _ in range(2):
            process = subprocess.run(
                [sys.executable, "engine/diagnose_cli.py"], cwd=ROOT,
                input=request, text=True, capture_output=True, timeout=10,
            )
            self.assertEqual(process.returncode, 0)
            outputs.append(process.stdout)
        self.assertEqual(outputs[0], outputs[1])

if __name__ == "__main__":
    unittest.main()
