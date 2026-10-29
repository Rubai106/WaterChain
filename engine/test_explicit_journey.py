import copy
import unittest
from diagnose import diagnose


def record(stage, result, idx, batch=None):
    times = {"source": "2025-04-01T08:00:00+00:00", "collection": "2025-04-01T09:00:00+00:00", "storage": "2025-04-01T10:00:00+00:00", "serving": "2025-04-01T11:00:00+00:00"}
    return {"id": f"record-{idx}", "recordCode": f"EV-{idx}", "sampleCode": f"SAMPLE-{idx}", "stage": stage,
            "collectedAt": times[stage], "waterSourceId": "S-01", "batchId": batch, "analyte": "e_coli_presence",
            "result": result, "numericValue": None, "unit": None, "method": "membrane filtration", "labName": "User-entered lab",
            "positiveControl": "pass", "negativeControl": "pass", "blankControl": "pass", "sourceReference": "REF-1"}


def model(records, basis="directly_documented", edge_basis="documented"):
    journey = {"id": "journey-1", "name": "Household test journey", "sourceId": "source-1"}
    source = {"id": "source-1", "name": "Borehole BH-1", "kind": "borehole", "sourceIdentifier": "S-01"}
    entity_by_stage = {"source": "S-01", "collection": "TRANSPORT-01", "storage": "STORAGE-01", "serving": "SERVING-01"}
    events = [{"id": f"event-{i}", "journeyId": journey["id"], "evidenceRecordId": r["id"], "stage": r["stage"],
               "waterEntityRef": entity_by_stage[r["stage"]], "relationshipBasis": basis, "relationshipReference": f"FIELD-VISIT-{i}"} for i, r in enumerate(records)]
    transfers = [{"id": f"transfer-{i}", "journeyId": journey["id"], "fromStage": a, "toStage": b,
                  "fromEntityRef": entity_by_stage[a], "toEntityRef": entity_by_stage[b], "evidenceBasis": edge_basis,
                  "sourceReference": f"TRANSFER-LOG-{i}", "notes": "Reference from synthetic test fixture", "occurredAt": None} for i, (a, b) in enumerate(zip(("source", "collection", "storage"), ("collection", "storage", "serving")))]
    return {"journey": journey, "source": source, "samplingEvents": events, "transferEvents": transfers}


class ExplicitJourneyTests(unittest.TestCase):
    def make_records(self):
        return [record("source", "not_detected", 1, None), record("collection", "not_detected", 2, "household-transport-02"),
                record("storage", "detected", 3, "container-03"), record("serving", "detected", 4, "serving-04")]

    def test_documented_relationship_model_allows_candidate_without_same_batch_id(self):
        records = self.make_records()
        report = diagnose(records, journey_model=model(records))
        self.assertEqual(report["evidence_summary"]["lineage_mode"], "explicit_journey")
        self.assertTrue(report["attribution_permitted"])
        self.assertEqual(report["confidence_label"], "candidate transition only")
        self.assertEqual(report["evidence_summary"]["pathway_eligible_by_stage"], {"source": 1, "collection": 1, "storage": 1, "serving": 1})
        self.assertIsNone(report["evidence_summary"]["pathway_batch_id"])

    def test_missing_transfer_edge_abstains(self):
        records = self.make_records(); journey = model(records); journey["transferEvents"] = journey["transferEvents"][:-1]
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["lineage_review"]["status"], "lineage_limited")

    def test_self_reported_transfers_do_not_permit_attribution(self):
        records = self.make_records()
        report = diagnose(records, journey_model=model(records, edge_basis="self_reported"))
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("self-reported information", " ".join(report["lineage_review"]["blockers"]))



    def test_strong_transfer_does_not_mask_an_unresolved_alternative_transfer(self):
        records = self.make_records()
        journey = model(records)
        journey["transferEvents"].append({
            "id": "unverified-alternative", "journeyId": journey["journey"]["id"],
            "fromStage": "collection", "toStage": "storage",
            "fromEntityRef": "TRANSPORT-OTHER", "toEntityRef": "STORAGE-OTHER",
            "evidenceBasis": "unverified", "sourceReference": None, "notes": "unresolved field note", "occurredAt": None,
        })
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        edge = report["lineage_review"]["transfer_edges"][1]
        self.assertEqual(edge["status"], "uncertain")
        self.assertTrue(any("Transfer evidence from collection to storage is inferred, unverified" in blocker for blocker in report["lineage_review"]["blockers"]))

    def test_observed_transfer_is_not_mislabeled_as_documented(self):
        records = self.make_records()
        report = diagnose(records, journey_model=model(records, edge_basis="observed"))
        self.assertTrue(report["attribution_permitted"])
        self.assertTrue(all(edge["status"] == "observed" for edge in report["lineage_review"]["transfer_edges"]))



    def test_selected_source_identifier_mismatch_blocks_attribution(self):
        records = self.make_records(); journey = model(records); journey["source"]["sourceIdentifier"] = "SOURCE-WRONG"
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "journey_source_identifier_mismatch" for f in report["findings"]))

    def test_missing_selected_source_identifier_blocks_attribution(self):
        records = self.make_records(); journey = model(records); journey["source"]["sourceIdentifier"] = None
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "journey_source_identifier_unmapped" for f in report["findings"]))

    def test_direct_sampling_relationship_without_reference_is_excluded(self):
        records = self.make_records(); journey = model(records); journey["samplingEvents"][1]["relationshipReference"] = None
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["evidence_summary"]["pathway_eligible_by_stage"]["collection"], 0)
        self.assertTrue(any(f["code"] == "sampling_link_reference_missing" for f in report["findings"]))

    def test_documented_transfer_without_reference_is_not_direct_support(self):
        records = self.make_records(); journey = model(records); journey["transferEvents"][1]["sourceReference"] = None; journey["transferEvents"][1]["notes"] = None
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["lineage_review"]["transfer_edges"][1]["status"], "uncertain")
        self.assertTrue(any(f["code"] == "transfer_support_reference_missing" for f in report["findings"]))

    def test_unconfirmed_sample_relationship_excluded_from_pathway(self):
        records = self.make_records(); journey = model(records); journey["samplingEvents"][2]["relationshipBasis"] = "unconfirmed"
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["evidence_summary"]["pathway_eligible_by_stage"]["storage"], 0)

    def test_bad_event_stage_link_is_reported(self):
        records = self.make_records(); journey = model(records); journey["samplingEvents"][0]["stage"] = "serving"
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "sampling_event_stage_mismatch" for f in report["findings"]))

    def test_other_journey_records_do_not_pollute_selected_journey(self):
        records = self.make_records()
        unrelated = record("serving", "detected", 8, "other-batch")
        unrelated["waterSourceId"] = "S-OTHER"
        report = diagnose(records + [unrelated], journey_model=model(records))
        self.assertTrue(report["attribution_permitted"])
        self.assertFalse(report["record_eligibility"][-1]["on_pathway"])
        self.assertEqual(report["evidence_summary"]["pathway_eligible_by_stage"]["serving"], 1)


    def test_malformed_additional_event_blocks_otherwise_complete_journey(self):
        records = self.make_records()
        journey = model(records)
        journey["samplingEvents"].append({
            "id": "foreign-event", "journeyId": "another-journey", "evidenceRecordId": records[0]["id"],
            "stage": "source", "relationshipBasis": "directly_documented", "relationshipReference": "FIELD-REF-OTHER",
        })
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["lineage_review"]["status"], "lineage_limited")
        self.assertTrue(any("does not belong to the selected journey" in blocker for blocker in report["lineage_review"]["blockers"]))

    def test_observed_transfers_are_sufficient_without_false_missing_linkage_actions(self):
        records = self.make_records()
        report = diagnose(records, journey_model=model(records, edge_basis="observed"))
        self.assertTrue(report["attribution_permitted"])
        linkage_actions = [action for action in report["next_actions"] if action["action_type"] == "linkage"]
        self.assertEqual(linkage_actions, [])


    def test_sampling_entity_reference_is_required_to_join_transfer_path(self):
        records = self.make_records(); journey = model(records); journey["samplingEvents"][1]["waterEntityRef"] = None
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["evidence_summary"]["pathway_eligible_by_stage"]["collection"], 0)
        self.assertTrue(any(f["code"] == "sampling_entity_reference_missing" for f in report["findings"]))

    def test_transfer_entity_ids_must_connect_actual_stage_entities(self):
        records = self.make_records(); journey = model(records); journey["transferEvents"][1]["fromEntityRef"] = "UNRELATED-CONTAINER"
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["lineage_review"]["path_count"], 0)
        self.assertTrue(any("No single complete entity-connected path" in blocker for blocker in report["lineage_review"]["blockers"]))

    def test_multiple_complete_entity_paths_are_not_collapsed_into_one_transition(self):
        records = self.make_records(); journey = model(records)
        extras = [record("collection", "not_detected", 10, "batch-10"), record("storage", "detected", 11, "batch-11"), record("serving", "detected", 12, "batch-12")]
        extra_entities = {"collection": "TRANSPORT-02", "storage": "STORAGE-02", "serving": "SERVING-02"}
        for index, rec in enumerate(extras):
            journey["samplingEvents"].append({
                "id": f"branch-event-{index}", "journeyId": journey["journey"]["id"], "evidenceRecordId": rec["id"],
                "stage": rec["stage"], "waterEntityRef": extra_entities[rec["stage"]],
                "relationshipBasis": "directly_documented", "relationshipReference": f"BRANCH-FIELD-{index}",
            })
        journey["transferEvents"].extend([
            {"id": "branch-transfer-0", "journeyId": journey["journey"]["id"], "fromStage": "source", "toStage": "collection", "fromEntityRef": "S-01", "toEntityRef": "TRANSPORT-02", "evidenceBasis": "documented", "sourceReference": "BRANCH-LOG-0", "notes": None, "occurredAt": None},
            {"id": "branch-transfer-1", "journeyId": journey["journey"]["id"], "fromStage": "collection", "toStage": "storage", "fromEntityRef": "TRANSPORT-02", "toEntityRef": "STORAGE-02", "evidenceBasis": "documented", "sourceReference": "BRANCH-LOG-1", "notes": None, "occurredAt": None},
            {"id": "branch-transfer-2", "journeyId": journey["journey"]["id"], "fromStage": "storage", "toStage": "serving", "fromEntityRef": "STORAGE-02", "toEntityRef": "SERVING-02", "evidenceBasis": "documented", "sourceReference": "BRANCH-LOG-2", "notes": None, "occurredAt": None},
        ])
        report = diagnose(records + extras, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertEqual(report["lineage_review"]["path_count"], 2, "2 is a bounded sentinel for two or more complete routes")
        self.assertTrue(any(f["code"] == "journey_multiple_complete_paths" for f in report["findings"]))
        self.assertTrue(any("At least two complete" in blocker for blocker in report["lineage_review"]["blockers"]))

    def test_no_positive_transition_does_not_create_false_linkage_recommendations_for_observed_edges(self):
        records = [record("source", "not_detected", 1), record("collection", "not_detected", 2), record("storage", "not_detected", 3), record("serving", "not_detected", 4)]
        report = diagnose(records, journey_model=model(records, edge_basis="observed"))
        self.assertFalse(report["attribution_permitted"])
        self.assertFalse(any(action["action_type"] == "linkage" for action in report["next_actions"]))


    def test_positive_records_without_a_resolved_route_are_not_described_as_absent(self):
        records = self.make_records()
        journey = model(records)
        journey["transferEvents"] = journey["transferEvents"][:-1]
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertIn("Eligible positive result(s) exist", report["conclusion"])
        self.assertTrue(any(f["code"] == "eligible_positive_outside_resolved_path" for f in report["findings"]))
        self.assertEqual(report["evidence_summary"]["pathway_eligible_by_stage"]["serving"], 0)

    def test_next_actions_explain_transfer_gaps_without_fake_costs(self):
        records = self.make_records(); journey = model(records); journey["transferEvents"] = []
        report = diagnose(records, journey_model=journey)
        self.assertTrue(any(a["action_type"] == "linkage" for a in report["next_actions"]))
        self.assertFalse(any("$" in a["why"] for a in report["next_actions"]))


class TransferHygieneTests(unittest.TestCase):
    """Step 12 audit regressions: transfer rows that the boundary filter used
    to ignore silently must now be flagged as blockers."""

    def make_records(self):
        return [record("source", "not_detected", 1, None), record("collection", "not_detected", 2, "household-transport-02"),
                record("storage", "detected", 3, "container-03"), record("serving", "detected", 4, "serving-04")]

    def test_duplicate_transfer_ids_are_flagged(self):
        records = self.make_records(); journey = model(records)
        journey["transferEvents"][1]["id"] = journey["transferEvents"][0]["id"]
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "duplicate_transfer_id" for f in report["findings"]))

    def test_reversed_transfer_is_flagged_not_silently_ignored(self):
        records = self.make_records(); journey = model(records)
        journey["transferEvents"].append({"id": "transfer-reversed", "journeyId": journey["journey"]["id"],
            "fromStage": "storage", "toStage": "collection", "fromEntityRef": "STORAGE-01",
            "toEntityRef": "TRANSPORT-01", "evidenceBasis": "documented", "sourceReference": "LOG-X",
            "notes": "", "occurredAt": None})
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "transfer_not_adjacent" for f in report["findings"]))

    def test_non_adjacent_transfer_is_flagged(self):
        records = self.make_records(); journey = model(records)
        journey["transferEvents"].append({"id": "transfer-skip", "journeyId": journey["journey"]["id"],
            "fromStage": "source", "toStage": "storage", "fromEntityRef": "S-01",
            "toEntityRef": "STORAGE-01", "evidenceBasis": "documented", "sourceReference": "LOG-X",
            "notes": "", "occurredAt": None})
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "transfer_not_adjacent" for f in report["findings"]))

    def test_transfer_from_another_journey_is_flagged(self):
        records = self.make_records(); journey = model(records)
        journey["transferEvents"].append({"id": "transfer-foreign", "journeyId": "some-other-journey",
            "fromStage": "source", "toStage": "collection", "fromEntityRef": "S-01",
            "toEntityRef": "TRANSPORT-01", "evidenceBasis": "documented", "sourceReference": "LOG-X",
            "notes": "", "occurredAt": None})
        report = diagnose(records, journey_model=journey)
        self.assertFalse(report["attribution_permitted"])
        self.assertTrue(any(f["code"] == "transfer_journey_mismatch" for f in report["findings"]))

if __name__ == "__main__": unittest.main()
