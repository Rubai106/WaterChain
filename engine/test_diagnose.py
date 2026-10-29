import unittest
from diagnose import diagnose

def rec(stage, result, *, batch="B-1", source="S-1", rid=None, time=None):
    return {
        "id": rid or f"{stage}-{result}",
        "recordCode": rid or f"{stage}-{result}",
        "sampleCode": f"sample-{stage}",
        "stage": stage,
        "collectedAt": time or {
            "source":"2026-01-01T08:00:00+00:00",
            "collection":"2026-01-01T09:00:00+00:00",
            "storage":"2026-01-01T10:00:00+00:00",
            "serving":"2026-01-01T11:00:00+00:00",
        }[stage],
        "waterSourceId": source,
        "batchId": batch,
        "analyte": "e_coli_presence",
        "result": result,
        "numericValue": None,
        "unit": None,
        "method": "membrane filtration",
        "labName": "Lab recorded by user",
        "positiveControl": "pass",
        "negativeControl": "pass",
        "blankControl": "pass",
        "sourceReference": "report-ref",
    }

class DiagnosticEngineTests(unittest.TestCase):
    def test_empty_input_abstains(self):
        report = diagnose([])
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("No evidence", report["conclusion"])

    def test_positive_without_linked_batch_abstains(self):
        records = [rec("source", "not_detected", batch="B1"),
                   rec("serving", "detected", batch="B2")]
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("not permitted", report["conclusion"])

    def test_complete_linked_pattern_only_reports_candidate_transition(self):
        records = [rec("source", "not_detected"), rec("collection", "not_detected"),
                   rec("storage", "detected"), rec("serving", "detected")]
        report = diagnose(records)
        self.assertTrue(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "candidate transition only")
        self.assertIn("not definitive causal proof", report["conclusion"])

    def test_failed_qc_result_is_excluded(self):
        records = [rec("source", "not_detected"), rec("collection", "not_detected"),
                   rec("storage", "detected"), rec("serving", "detected")]
        records[2]["blankControl"] = "fail"
        report = diagnose(records)
        self.assertEqual(report["evidence_summary"]["eligible_by_stage"]["storage"], 0)
        self.assertTrue(any(f["code"] == "record_excluded" for f in report["findings"]))

    def test_multiple_sources_do_not_allow_attribution(self):
        records = [rec("source", "not_detected", source="S1"),
                   rec("collection", "not_detected", source="S1"),
                   rec("storage", "detected", source="S2"),
                   rec("serving", "detected", source="S2")]
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])


    def test_missing_timestamp_excludes_record(self):
        records = [rec("source", "not_detected"), rec("collection", "not_detected"),
                   rec("storage", "detected"), rec("serving", "detected")]
        records[0]["collectedAt"] = None
        report = diagnose(records)
        self.assertEqual(report["evidence_summary"]["eligible_by_stage"]["source"], 0)
        self.assertFalse(report["attribution_permitted"])

    def test_batch_id_missing_from_one_stage_blocks_attribution(self):
        records = [rec("source", "not_detected"), rec("collection", "not_detected"),
                   rec("storage", "detected"), rec("serving", "detected")]
        records[3]["batchId"] = None
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["evidence_summary"]["shared_batch_ids"], [])

    def test_duplicate_internal_id_blocks_attribution(self):
        # Audit case 22: same internal id, different record codes.
        records = [rec("source", "not_detected"), rec("collection", "not_detected"),
                   rec("storage", "detected"), rec("serving", "detected")]
        duplicate = dict(records[0])
        duplicate["recordCode"] = "different-code"
        records.append(duplicate)
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "duplicate_record_identifier" for f in report["findings"]))

    def test_non_finite_or_boolean_quantified_value_is_excluded(self):
        for bad_value in (float("nan"), float("inf"), True):
            record = rec("source", "quantified")
            record["analyte"] = "e_coli_concentration"
            record["numericValue"] = bad_value
            record["unit"] = "CFU/100mL"
            report = diagnose([record])
            self.assertEqual(report["evidence_summary"]["eligible_records"], 0,
                             msg=f"value {bad_value!r} should be excluded")

    def test_linked_all_negative_does_not_permit_attribution(self):
        records = [rec("source", "not_detected"), rec("collection", "not_detected"),
                   rec("storage", "not_detected"), rec("serving", "not_detected")]
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "insufficient evidence")

    def test_source_positive_is_observation_not_attribution(self):
        records = [rec("source", "detected"), rec("collection", "detected"),
                   rec("storage", "detected"), rec("serving", "detected")]
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("source", report["conclusion"].lower())

    def test_unbracketed_positive_does_not_permit_attribution(self):
        # Earlier stages quantified at zero are neither positives nor
        # not-detected negatives, so no transition interval is bracketed.
        def quantified(stage, value, time):
            record = rec(stage, "quantified", time=time)
            record["analyte"] = "e_coli_concentration"
            record["numericValue"] = value
            record["unit"] = "CFU/100mL"
            return record
        records = [quantified("source", 0, "2026-01-01T08:00:00+00:00"),
                   quantified("collection", 0, "2026-01-01T09:00:00+00:00"),
                   quantified("storage", 12, "2026-01-01T10:00:00+00:00"),
                   quantified("serving", 8, "2026-01-01T11:00:00+00:00")]
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "insufficient evidence")
        self.assertTrue(any(f["code"] == "transition_not_bracketed" for f in report["findings"]))

    def test_empty_report_has_no_lineage_warning(self):
        report = diagnose([])
        self.assertEqual(report["findings"], [])

    def test_conflicting_time_order_blocks_attribution(self):
        records = [rec("source", "not_detected", time="2026-01-01T12:00:00+00:00"),
                   rec("collection", "not_detected", time="2026-01-01T09:00:00+00:00"),
                   rec("storage", "detected", time="2026-01-01T10:00:00+00:00"),
                   rec("serving", "detected", time="2026-01-01T11:00:00+00:00")]
        report = diagnose(records)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "timeline_conflict" for f in report["findings"]))

if __name__ == "__main__":
    unittest.main()
