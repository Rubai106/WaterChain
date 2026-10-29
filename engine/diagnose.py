"""Conservative, rule-based pathway review for WaterChain.

This module does not estimate calibrated probabilities or prove causation.
It identifies the earliest observed positive stage only when evidence is
adequately linked and usable; otherwise it returns explicit uncertainty.
Standard library only.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from datetime import datetime
import math
from typing import Any, Iterable

STAGES = ("source", "collection", "storage", "serving")
REPORTABLE = {"detected", "not_detected", "quantified"}
CONTROL_KEYS = ("positiveControl", "negativeControl", "blankControl")
STAGE_LABELS = {
    "source": "Source",
    "collection": "Collection / transport",
    "storage": "Household storage",
    "serving": "Serving",
}

@dataclass
class Finding:
    code: str
    severity: str
    message: str
    record_ids: list[str]

@dataclass
class Hypothesis:
    stage: str
    label: str
    status: str
    supporting_evidence: list[str]
    contradicting_evidence: list[str]
    explanation: str

@dataclass
class DiagnosticReport:
    conclusion: str
    confidence_label: str
    attribution_permitted: bool
    findings: list[dict[str, Any]]
    hypotheses: list[dict[str, Any]]
    evidence_summary: dict[str, Any]
    record_eligibility: list[dict[str, Any]]
    next_step: dict[str, Any]
    limitations: list[str]
    lineage_review: dict[str, Any]
    next_actions: list[dict[str, Any]]

def _get(record: dict, camel: str, snake: str | None = None, default=None):
    if camel in record:
        return record[camel]
    if snake and snake in record:
        return record[snake]
    return default

def _stage(r):
    return _get(r, "stage")

def _result(r):
    return _get(r, "result")

def _usable(r, require_batch: bool = True):
    """Conservative local gate; mirrors key Step 2 rules, not a lab accreditation."""
    result = _result(r)
    if result not in REPORTABLE:
        return False, "No reportable result"
    if result == "invalid":
        return False, "Result marked invalid"
    if not _get(r, "method") or not str(_get(r, "method")).strip():
        return False, "Test method missing"
    if not _time(r):
        return False, "Collection timestamp missing or invalid"
    if not str(_get(r, "waterSourceId", "water_source_id", "") or "").strip():
        return False, "Water-source identity missing"
    if require_batch and not str(_get(r, "batchId", "batch_id", "") or "").strip():
        return False, "Batch identity missing (no explicit water-journey model supplied)"
    control_values = [_get(r, k, {
        "positiveControl": "positive_control",
        "negativeControl": "negative_control",
        "blankControl": "blank_control",
    }[k], "not_recorded") for k in CONTROL_KEYS]
    if any(value == "fail" for value in control_values):
        return False, "Quality-control failure"
    if any(value != "pass" for value in control_values):
        return False, "Quality-control status incomplete"
    if _get(r, "analyte") not in ("e_coli_presence", "e_coli_concentration"):
        return False, "Unsupported analyte for pathway diagnosis"
    if _get(r, "analyte") == "e_coli_presence" and result == "quantified":
        return False, "Analyte/result mismatch"
    # A numeric value, when present, must be a real finite number. Booleans
    # are int subclasses in Python, and NaN/infinity compare as neither
    # negative nor positive, so neither check above is sufficient on its own.
    # (The Next.js API rejects non-finite JSON before it reaches this gate;
    # this keeps direct/CLI use of the engine to the same standard.)
    val = _get(r, "numericValue", "numeric_value")
    if val is not None and (isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val)):
        return False, "Numeric value is not a finite number"
    if result == "quantified":
        unit = _get(r, "unit")
        if val is None or val < 0 or not unit or not str(unit).strip():
            return False, "Quantitative result missing value or unit"
    return True, "Metadata gate passed; result itself is not independently verified"

def _positive(r):
    return _result(r) == "detected" or (
        _result(r) == "quantified" and
        isinstance(_get(r, "numericValue", "numeric_value"), (int, float)) and
        _get(r, "numericValue", "numeric_value") > 0
    )

def _time(r):
    raw = _get(r, "collectedAt", "collected_at")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None

def _explicit_journey_review(records, eligible_by_stage, journey_model, findings):
    """Resolve one fully traceable entity path through the selected water journey.

    Sampling bottles are observations, not physical entities. Each sampling event
    links an eligible bottle to a water/container entity; transfer events connect
    those entities across adjacent conceptual stages. Multiple possible end-to-end
    routes are retained as ambiguity and do not support a single transition claim.
    """
    empty_review = {
        "mode": "explicit_journey", "journey_id": None, "journey_name": None,
        "status": "lineage_limited", "stage_event_counts": {s: 0 for s in STAGES},
        "transfer_edges": [], "blockers": ["Journey model is invalid."],
        "path_count": 0, "selected_path_entity_refs": None,
    }
    if not isinstance(journey_model, dict):
        findings.append(Finding("journey_model_invalid", "blocker", "The supplied water-journey model is not an object.", []))
        return {s: [] for s in STAGES}, False, None, {}, empty_review, {}

    journey = journey_model.get("journey") if isinstance(journey_model.get("journey"), dict) else {}
    journey_id = str(journey.get("id", ""))
    journey_name = str(journey.get("name", ""))
    events = journey_model.get("samplingEvents", [])
    transfers = journey_model.get("transferEvents", [])
    source = journey_model.get("source") if isinstance(journey_model.get("source"), dict) else {}
    if not isinstance(events, list): events = []
    if not isinstance(transfers, list): transfers = []

    records_by_id = {str(_get(r, "id", default="")): r for r in records if str(_get(r, "id", default=""))}
    eligible_ids = {str(_get(r, "id", default="")) for stage in STAGES for r in eligible_by_stage[stage]}
    stage_events = {stage: [] for stage in STAGES}
    event_basis_by_record: dict[str, str] = {}
    entity_by_record: dict[str, str] = {}
    event_ids_seen = set()
    record_event_seen = set()
    candidate_records_by_stage: dict[str, list[dict]] = {stage: [] for stage in STAGES}
    entity_records: dict[str, dict[str, list[dict]]] = {stage: {} for stage in STAGES}
    entity_display: dict[str, str] = {}
    blockers: list[str] = []

    def entity_key(value: Any) -> str:
        return str(value or "").strip().casefold()

    for event in events:
        if not isinstance(event, dict):
            findings.append(Finding("sampling_event_malformed", "blocker", "A sampling event is malformed.", []))
            blockers.append("A sampling event is malformed.")
            continue
        eid = str(event.get("id", "")); eid_journey = str(event.get("journeyId", ""))
        rid = str(event.get("evidenceRecordId", "")); stage = event.get("stage")
        basis = event.get("relationshipBasis", "unconfirmed")
        if not eid or eid in event_ids_seen:
            findings.append(Finding("duplicate_sampling_event_id", "blocker", "Sampling event IDs must be present and unique within the selected journey.", [eid or "missing-event-id"]))
            blockers.append("Sampling event IDs are missing or duplicated.")
            continue
        event_ids_seen.add(eid)
        if eid_journey != journey_id:
            blockers.append("A sampling event does not belong to the selected journey.")
            continue
        if stage not in STAGES or rid not in records_by_id:
            findings.append(Finding("sampling_event_record_unmatched", "blocker", "A sampling event references a missing evidence record or unsupported stage.", [rid or eid]))
            blockers.append("One or more sampling events do not match evidence records.")
            continue
        record = records_by_id[rid]
        if _stage(record) != stage:
            findings.append(Finding("sampling_event_stage_mismatch", "blocker", "Sampling event stage does not match the linked evidence record stage.", [str(_get(record, "recordCode", "record_code", rid))]))
            blockers.append("A sampling event stage does not match its evidence record.")
            continue
        if rid in record_event_seen:
            findings.append(Finding("evidence_linked_multiple_times", "blocker", "One evidence record is linked more than once inside the selected journey. Use a distinct record for a distinct sample event.", [str(_get(record, "recordCode", "record_code", rid))]))
            blockers.append("At least one evidence record is linked multiple times.")
            continue
        record_event_seen.add(rid)
        if basis not in {"directly_documented", "associated_visit", "self_reported", "unconfirmed"}:
            basis = "unconfirmed"
        relationship_reference = str(event.get("relationshipReference") or "").strip()
        water_entity_ref = str(event.get("waterEntityRef") or "").strip()
        basis_for_pathway = basis
        if basis in {"directly_documented", "associated_visit"} and not relationship_reference:
            findings.append(Finding("sampling_link_reference_missing", "blocker", "A directly documented or same-visit sampling relationship has no field/visit reference. The link is excluded from pathway hypotheses until a real reference is recorded.", [str(_get(record, "recordCode", "record_code", rid))]))
            blockers.append(f"{_get(record, 'recordCode', 'record_code', rid)} has a relationship basis that requires a reference, but no reference was supplied.")
            basis_for_pathway = "unconfirmed"
        if basis in {"directly_documented", "associated_visit"} and not water_entity_ref:
            findings.append(Finding("sampling_entity_reference_missing", "blocker", "A sampling event lacks the physical water/container entity ID needed to connect it to transfer events.", [str(_get(record, "recordCode", "record_code", rid))]))
            blockers.append(f"{_get(record, 'recordCode', 'record_code', rid)} lacks a water/container entity ID.")
            basis_for_pathway = "unconfirmed"
        stage_events[stage].append(event)
        event_basis_by_record[rid] = basis_for_pathway
        if water_entity_ref:
            entity_by_record[rid] = water_entity_ref
            entity_display.setdefault(entity_key(water_entity_ref), water_entity_ref)
        if rid not in eligible_ids:
            blockers.append(f"{_get(record, 'recordCode', 'record_code', rid)} is not eligible under the engine's record-level gate.")
        if basis_for_pathway == "unconfirmed":
            findings.append(Finding("sampling_relationship_unconfirmed", "warning", "A sampling event is linked to the journey without a confirmed, referenced relationship and entity ID; it is shown for review but excluded from pathway hypotheses.", [str(_get(record, "recordCode", "record_code", rid))]))
        if basis_for_pathway in {"directly_documented", "associated_visit"} and relationship_reference:
            candidate_records_by_stage[stage].append(record)
        if basis_for_pathway in {"directly_documented", "associated_visit"} and relationship_reference and water_entity_ref and rid in eligible_ids:
            key = entity_key(water_entity_ref)
            entity_records[stage].setdefault(key, []).append(record)

    selected_source_identifier = str(source.get("sourceIdentifier") or "").strip()
    source_identifier_consistent = bool(selected_source_identifier)
    if not selected_source_identifier:
        findings.append(Finding("journey_source_identifier_unmapped", "blocker", "The selected water-source entity has no source-identifier mapping. Enter the exact waterSourceId used by linked evidence records.", []))
        blockers.append("Selected source ID is not mapped to the water-source IDs recorded on evidence.")

    # User-entered source IDs on all strong sample links must be consistent with
    # the selected source record. We don't use container IDs as source IDs.
    observed_source_ids = {
        str(_get(record, "waterSourceId", "water_source_id", "") or "").strip()
        for stage in STAGES for record in candidate_records_by_stage[stage]
        if str(_get(record, "waterSourceId", "water_source_id", "") or "").strip()
    }
    if len(observed_source_ids) > 1:
        findings.append(Finding("journey_source_identity_conflict", "blocker", "Eligible samples assigned to this journey refer to multiple source IDs. Reconcile source relationships before transition analysis.", []))
        blockers.append("Linked sample source IDs conflict.")
    if selected_source_identifier and observed_source_ids and not all(value.casefold() == selected_source_identifier.casefold() for value in observed_source_ids):
        findings.append(Finding("journey_source_identifier_mismatch", "blocker", "The selected source ID does not match one or more linked evidence waterSourceId values. Reconcile the source mapping before pathway interpretation.", []))
        blockers.append("Selected source ID mapping conflicts with linked evidence records.")
    if not observed_source_ids:
        findings.append(Finding("journey_source_identity_missing", "blocker", "No source identity could be reconciled from the directly linked sampling records.", []))
        blockers.append("No source identity could be reconciled from the selected journey's sample records.")
    if journey_id and source.get("id") and str(journey.get("sourceId", "")) != str(source.get("id", "")):
        findings.append(Finding("journey_source_reference_mismatch", "blocker", "The selected journey's source reference does not match its supplied source record.", []))
        blockers.append("Journey source reference mismatch.")

    # Transfer hygiene pre-pass (Step 12 audit fix). Duplicate transfer IDs,
    # transfers belonging to another journey, malformed rows, and transfers
    # that do not connect adjacent stages in forward order were previously
    # ignored silently by the boundary filter below; the engine now flags
    # them as blockers instead of letting a clean forward path mask bad rows.
    # This mirrors the duplicate-ID check already applied to sampling events.
    seen_transfer_ids: set[str] = set()
    deduped_transfers: list[dict] = []
    for edge in transfers:
        if not isinstance(edge, dict):
            findings.append(Finding("transfer_event_malformed", "blocker", "A transfer event is malformed.", []))
            blockers.append("A transfer event is malformed.")
            continue
        transfer_id = str(edge.get("id", ""))
        if not transfer_id or transfer_id in seen_transfer_ids:
            findings.append(Finding("duplicate_transfer_id", "blocker", "Transfer IDs must be present and unique within the selected journey.", [transfer_id or "missing-transfer-id"]))
            blockers.append("Transfer IDs are missing or duplicated.")
            continue
        seen_transfer_ids.add(transfer_id)
        if str(edge.get("journeyId", "")) != journey_id:
            findings.append(Finding("transfer_journey_mismatch", "blocker", "A transfer event does not belong to the selected journey.", [transfer_id]))
            blockers.append("A transfer event does not belong to the selected journey.")
            continue
        from_stage, to_stage = edge.get("fromStage"), edge.get("toStage")
        if from_stage not in STAGES or to_stage not in STAGES or STAGES.index(to_stage) != STAGES.index(from_stage) + 1:
            findings.append(Finding("transfer_not_adjacent", "blocker", "Transfer events must connect adjacent conceptual stages in forward order (source → collection → storage → serving). Non-adjacent or reversed transfers are documented in notes and assessed separately, not silently joined into a path.", [transfer_id]))
            blockers.append("A transfer event does not connect adjacent stages in forward order.")
            continue
        deduped_transfers.append(edge)
    transfers = deduped_transfers

    # Build supported, entity-specific transfer links. A stage-level transfer with
    # no matching entity IDs is not enough to join two samples into one path.
    supported_edges: dict[tuple[str, str], list[tuple[str, str, str]]] = {}
    transfer_edges = []
    edge_statuses = {}
    for index, from_stage in enumerate(STAGES[:-1]):
        to_stage = STAGES[index + 1]
        matching = [edge for edge in transfers if isinstance(edge, dict) and str(edge.get("journeyId", "")) == journey_id
                    and edge.get("fromStage") == from_stage and edge.get("toStage") == to_stage]
        basis_values = []
        pairs = []
        for edge in matching:
            basis = str(edge.get("evidenceBasis", "unverified"))
            source_reference = bool(str(edge.get("sourceReference") or "").strip())
            note_reference = bool(str(edge.get("notes") or "").strip())
            from_ref = str(edge.get("fromEntityRef") or "").strip()
            to_ref = str(edge.get("toEntityRef") or "").strip()
            if not from_ref or not to_ref:
                findings.append(Finding("transfer_entity_reference_missing", "blocker", f"Transfer from {from_stage} to {to_stage} lacks its from/to water-container entity IDs.", [str(edge.get("id", "transfer-event"))]))
                basis_values.append("unverified")
                continue
            if basis == "documented" and source_reference:
                supported_basis = "documented"
            elif basis == "observed" and (source_reference or note_reference):
                supported_basis = "observed"
            else:
                supported_basis = "self_reported" if basis == "self_reported" else "unverified"
                if basis in {"documented", "observed"}:
                    findings.append(Finding("transfer_support_reference_missing", "blocker", f"A transfer marked {basis} from {from_stage} to {to_stage} lacks the reference or note required for that evidence basis.", [str(edge.get("id", "transfer-event"))]))
            basis_values.append(supported_basis)
            if supported_basis in {"documented", "observed"}:
                pairs.append((entity_key(from_ref), entity_key(to_ref), supported_basis))
        if pairs:
            supported_edges[(from_stage, to_stage)] = pairs
        # A strong edge must not mask a second unresolved transfer record on the
        # same stage boundary. Any unknown alternative keeps the whole boundary
        # uncertain until a reviewer resolves it against source records.
        if not matching:
            status = "missing"
        elif "unverified" in basis_values:
            status = "uncertain"
        elif "self_reported" in basis_values:
            status = "reported"
        elif "documented" in basis_values:
            status = "documented"
        elif "observed" in basis_values:
            status = "observed"
        else:
            status = "uncertain"
        edge_statuses[(from_stage, to_stage)] = status
        transfer_edges.append({
            "from_stage": from_stage, "to_stage": to_stage, "status": status, "count": len(matching),
            "supported_entity_pairs": [{"from_entity_ref": entity_display.get(a, a), "to_entity_ref": entity_display.get(b, b), "basis": basis} for a, b, basis in pairs],
        })
        if status not in {"documented", "observed"}:
            if status == "reported": detail = "supported only by self-reported information"
            elif status == "uncertain": detail = "inferred, unverified, or missing entity references"
            else: detail = "missing"
            blockers.append(f"Transfer evidence from {from_stage} to {to_stage} is {detail}.")

    missing_stages = [stage for stage in STAGES if not entity_records[stage]]
    if missing_stages:
        blockers.append("No eligible, relationship-linked sampling event with a water/container ID for: " + ", ".join(missing_stages) + ".")
    weaker_event_links = [rid for rid, basis in event_basis_by_record.items() if basis in {"self_reported", "unconfirmed"}]
    if weaker_event_links:
        blockers.append("At least one sample-to-journey relationship is self-reported, unconfirmed, or missing a required reference.")

    # Resolve complete paths through exact physical/entity IDs. It is safe to have
    # several possible paths in the ledger, but not to collapse them into one
    # transition claim. A reviewer must narrow an ambiguous graph first.
    source_key = entity_key(selected_source_identifier)
    path_candidates = set()
    if source_key and source_key in entity_records["source"]:
        edge_01 = supported_edges.get(("source", "collection"), [])
        edge_12 = supported_edges.get(("collection", "storage"), [])
        edge_23 = supported_edges.get(("storage", "serving"), [])
        # The decision only needs three states: zero, exactly one, or 2+ routes.
        # Collapse duplicate evidence rows into adjacency sets, then stop as soon
        # as two distinct complete entity paths are found. This bounds work far
        # better than a nested Cartesian scan of all transfer rows.
        def adjacency(edge_rows):
            graph: dict[str, set[str]] = {}
            for left, right, _basis in edge_rows:
                graph.setdefault(left, set()).add(right)
            return graph

        source_to_collection = adjacency(edge_01)
        collection_to_storage = adjacency(edge_12)
        storage_to_serving = adjacency(edge_23)
        for collection_ref in sorted(source_to_collection.get(source_key, set())):
            if collection_ref not in entity_records["collection"]:
                continue
            for storage_ref in sorted(collection_to_storage.get(collection_ref, set())):
                if storage_ref not in entity_records["storage"]:
                    continue
                for serving_ref in sorted(storage_to_serving.get(storage_ref, set())):
                    if serving_ref not in entity_records["serving"]:
                        continue
                    path_candidates.add((source_key, collection_ref, storage_ref, serving_ref))
                    if len(path_candidates) >= 2:
                        break
                if len(path_candidates) >= 2:
                    break
            if len(path_candidates) >= 2:
                break

    pathway_by_stage = {stage: [] for stage in STAGES}
    selected_path = None
    if len(path_candidates) == 1:
        selected_path = next(iter(path_candidates))
        for stage, entity_ref in zip(STAGES, selected_path):
            pathway_by_stage[stage] = list(entity_records[stage].get(entity_ref, []))
    elif len(path_candidates) == 0:
        blockers.append("No single complete entity-connected path links Source → Collection → Storage → Serving.")
        findings.append(Finding("journey_no_complete_entity_path", "blocker", "Sampling events and transfer records do not form one complete entity-connected four-stage path.", []))
    else:
        blockers.append("At least two complete entity-connected paths are possible. Separate or explicitly select one path before transition interpretation.")
        findings.append(Finding("journey_multiple_complete_paths", "blocker", "At least two complete entity-connected paths are possible. The engine will not combine distinct branches into one transition claim.", []))

    # Entity paths do not supersede the existing metadata, source, time, or
    # discordance gates; those are evaluated over the single selected path later.
    all_stage_events = all(bool(stage_events[stage]) for stage in STAGES)
    event_links_strong = all(
        event_basis_by_record.get(str(event.get("evidenceRecordId", ""))) in {"directly_documented", "associated_visit"}
        and bool(str(event.get("relationshipReference") or "").strip())
        and bool(str(event.get("waterEntityRef") or "").strip())
        for event in events if isinstance(event, dict) and event.get("stage") in STAGES and event.get("journeyId") == journey_id
    )
    all_edges_directly_supported = all(edge_statuses.get((STAGES[i], STAGES[i+1])) in {"documented", "observed"} for i in range(len(STAGES)-1))
    journey_ready = bool(
        journey_id and all_stage_events and all(pathway_by_stage[stage] for stage in STAGES)
        and all_edges_directly_supported and event_links_strong and source_identifier_consistent
        and len(observed_source_ids) == 1 and len(path_candidates) == 1 and not blockers
    )
    status = "linked_for_review" if journey_ready else ("evidence_incomplete" if missing_stages else "lineage_limited")
    if not journey_ready:
        findings.append(Finding("explicit_journey_lineage_limited", "warning", "The selected water-journey relationship model is incomplete, ambiguous, or not directly supported enough for a cross-stage candidate transition.", []))
    selected_path_refs = (dict(zip(STAGES, (entity_display.get(ref, ref) for ref in selected_path))) if selected_path else None)
    review = {
        "mode": "explicit_journey", "journey_id": journey_id or None, "journey_name": journey_name or None,
        "status": status, "stage_event_counts": {stage: len(stage_events[stage]) for stage in STAGES},
        "transfer_edges": transfer_edges, "blockers": list(dict.fromkeys(blockers)),
        "path_count": len(path_candidates), "selected_path_entity_refs": selected_path_refs,
    }
    return pathway_by_stage, journey_ready, None, {"journey_model": review}, review, event_basis_by_record
def build_next_actions(stage_records, findings, journey_review=None):
    """A transparent action planner. No prices, probabilities or guaranteed outcomes are invented."""
    actions = []
    finding_codes = {f.code for f in findings}
    if journey_review and journey_review.get("mode") == "explicit_journey":
        path_count = journey_review.get("path_count")
        if path_count == 0:
            actions.append({"id": "resolve-entity-path", "priority": "high", "action_type": "linkage",
                "title": "Resolve the water/container entity path", "why": "No complete entity-connected route joins all four conceptual stages. Review the source mapping, per-sample entity IDs, and adjacent transfer references against actual field records.",
                "what_positive_would_mean": "Not applicable; resolving the graph improves relationship traceability, not water-quality evidence.",
                "what_negative_would_mean": "Not being able to establish a link does not prove that water did not move between these points.",
                "prerequisites": ["Use actual source, container, visit, or transfer references. Do not edit IDs merely to create a connected path."]})
        elif isinstance(path_count, int) and path_count > 1:
            actions.append({"id": "disambiguate-entity-path", "priority": "high", "action_type": "linkage",
                "title": "Disambiguate multiple possible water routes", "why": "More than one complete entity-connected path exists. The engine intentionally stops rather than combining evidence from alternate branches.",
                "what_positive_would_mean": "Not applicable; this is a route-selection/data-resolution task, not a test result.",
                "what_negative_would_mean": "If the source records cannot distinguish the routes, the investigation should remain ambiguous.",
                "prerequisites": ["Review transfer logs, physical container IDs, and sampling visit references with the field team."]})
        if "journey_source_identifier_mismatch" in finding_codes or "journey_source_identity_conflict" in finding_codes:
            actions.append({"id": "reconcile-source-id", "priority": "high", "action_type": "linkage",
                "title": "Reconcile source identity across sample records", "why": "The selected source mapping disagrees with one or more source IDs recorded on linked samples.",
                "what_positive_would_mean": "Not applicable; source-ID reconciliation does not validate a laboratory result.",
                "what_negative_would_mean": "A mismatch must remain unresolved until the original sample/visit records clarify which source the sample represents.",
                "prerequisites": ["Compare the registered source against original field sheets; never normalize different sources into one ID for convenience."]})
        for edge in journey_review.get("transfer_edges", []):
            if edge.get("status") not in {"documented", "observed"}:
                actions.append({"id": f"link-{edge.get('from_stage')}-{edge.get('to_stage')}", "priority": "high", "action_type": "linkage",
                    "title": f"Resolve {edge.get('from_stage')} → {edge.get('to_stage')} relationship", "why": "The transfer is missing or supported only by self-report/inference.",
                    "what_positive_would_mean": "This is a documentation action; no new water-quality result is produced.",
                    "what_negative_would_mean": "Missing documentation does not prove that the transfer did not occur.",
                    "prerequisites": ["Use a real field record, transfer log or appropriately documented observation; do not invent references."]})
    if "source_identity_conflict" in finding_codes and not any(a["id"] == "reconcile-source-id" for a in actions):
        actions.append({"id": "reconcile-source-id", "priority": "high", "action_type": "linkage",
            "title": "Reconcile source identity across sample records", "why": "The sample records claim more than one water-source identity. They cannot be assumed to describe one water journey.",
            "what_positive_would_mean": "Not applicable; source-ID reconciliation does not validate a laboratory result.",
            "what_negative_would_mean": "A mismatch must remain unresolved until the original sample/visit records clarify which source each sample represents.",
            "prerequisites": ["Compare the records against original field sheets; never normalize different sources into one ID for convenience."]})
    if "qc_failed" in finding_codes or any(code in finding_codes for code in ("record_excluded",)):
        actions.append({"id": "qc-method-review", "priority": "high", "action_type": "quality_control", "title": "Review the original laboratory report and QC", "why": "At least one result is excluded or blocked; resolve the documented method/QC issue before using it.",
            "what_positive_would_mean": "Not applicable until a qualified reviewer determines whether the original result is usable.", "what_negative_would_mean": "Not applicable until the original report and QC issue are reviewed.",
            "prerequisites": ["Retrieve original report and documented control results; do not edit a failed QC state to pass without evidence."]})
    if "discordant_stage_results" in finding_codes:
        actions.append({"id": "repeat-discordant", "priority": "high", "action_type": "repeat", "title": "Review discordant results or plan a documented repeat", "why": "Positive and not-detected outcomes coexist at a stage and may reflect timing, replicates, handling, or method differences.",
            "what_positive_would_mean": "A repeat positive adds an observation under the repeat sampling conditions; it does not erase a prior negative.",
            "what_negative_would_mean": "A repeat negative does not erase a prior positive and does not prove persistent absence.",
            "prerequisites": ["Review timestamps, methods, sample identity and QC before defining a repeat protocol."]})
    if journey_review and journey_review.get("mode") == "explicit_journey":
        for stage in STAGES:
            if journey_review.get("stage_event_counts", {}).get(stage, 0) == 0:
                actions.append({"id": f"sample-{stage}", "priority": "high", "action_type": "sample", "title": f"Add or resolve a sampling event at {stage}",
                    "why": "The selected journey has no registered sampling event for this stage.",
                    "what_positive_would_mean": "A positive result is an observation at that time and place, not proof of origin.",
                    "what_negative_would_mean": "A negative result applies to that sample and test conditions only.",
                    "prerequisites": ["Follow an approved sampling protocol and record provenance, time and method."]})
    if not actions:
        actions.append({"id": "paired-follow-up", "priority": "medium", "action_type": "sample", "title": "Consider a documented paired follow-up at the least certain transition", "why": "Additional repeat observations may test whether the current pattern reproduces.",
            "what_positive_would_mean": "A repeated positive pattern adds observations but cannot establish cause on its own.",
            "what_negative_would_mean": "A negative repeat may reflect timing/intermittency and should be interpreted with previous results.",
            "prerequisites": ["Document the sampling rationale before collecting and preserve the original records."]})
    return actions[:8]


def diagnose(records: Iterable[dict], journey_model: dict | None = None) -> dict[str, Any]:
    """Review a collection of records; returns a JSON-serializable report."""
    records = [dict(r) for r in records]
    findings: list[Finding] = []

    # Detect duplicate record identifiers and sample identities reused across stages.
    # These checks prevent duplicated rows or ambiguous physical-sample identity from
    # quietly strengthening a stage-level claim.
    # Both identifiers are checked in separate maps: the human-visible
    # record code and the internal record id. Checking only one lets a
    # duplicated row slip through when the other identifier differs
    # (audit case 22). A value duplicated in both fields is reported once.
    record_code_to_rows: dict[str, list[dict]] = {}
    internal_id_to_rows: dict[str, list[dict]] = {}
    sample_to_stages: dict[str, set[str]] = {}
    for r in records:
        raw_code = _get(r, "recordCode", "record_code", "")
        code = str(raw_code).strip() if raw_code is not None else ""
        if code:
            record_code_to_rows.setdefault(code, []).append(r)
        raw_internal = _get(r, "id", default="")
        internal = str(raw_internal).strip() if raw_internal is not None else ""
        if internal:
            internal_id_to_rows.setdefault(internal, []).append(r)
        raw_sample = _get(r, "sampleCode", "sample_code", "")
        sample_code = str(raw_sample).strip().casefold() if raw_sample is not None else ""
        stage_name = _stage(r)
        if sample_code and stage_name in STAGES:
            sample_to_stages.setdefault(sample_code, set()).add(stage_name)

    duplicate_identifiers = (
        {key for key, rows in record_code_to_rows.items() if len(rows) > 1}
        | {key for key, rows in internal_id_to_rows.items() if len(rows) > 1}
    )
    for identifier in sorted(duplicate_identifiers):
        findings.append(Finding("duplicate_record_identifier", "blocker",
            "Multiple submitted rows use the same evidence-record identifier. Verify whether this is a duplicate import or a distinct record with an incorrect ID.", [identifier]))
    cross_stage_sample_codes = {key for key, stage_names in sample_to_stages.items() if len(stage_names) > 1}
    for sample_code in sorted(cross_stage_sample_codes):
        findings.append(Finding("sample_identity_reused_across_stages", "blocker",
            "The same sample ID is assigned to multiple pathway stages. Confirm physical sample identity before interpreting stage transitions.", [sample_code]))

    eligible_by_stage = {s: [] for s in STAGES}
    for r in records:
        stage = _stage(r)
        rid = str(_get(r, "recordCode", "record_code", _get(r, "id", default="unknown")))
        if stage not in STAGES:
            findings.append(Finding("unknown_stage", "blocker", "Record has an unsupported pathway stage and was excluded.", [rid]))
            continue
        ok, reason = _usable(r, require_batch=journey_model is None)
        if not ok:
            findings.append(Finding("record_excluded", "blocker", f"Record excluded from inference: {reason}.", [rid]))
            continue
        eligible_by_stage[stage].append(r)

    explicit_mode = journey_model is not None
    explicit_review = None
    event_basis_by_record: dict[str, str] = {}
    if explicit_mode:
        pathway_by_stage, has_identity_link, shared_batch, _meta, explicit_review, event_basis_by_record = _explicit_journey_review(
            records, eligible_by_stage, journey_model, findings)
        # In explicit mode, an event graph is the lineage representation. A common
        # batch ID is neither required nor synthesized; sample bottles may be distinct.
        common_batches = set()
        source_records = [r for stage in STAGES for r in pathway_by_stage[stage]]
        source_ids = {str(_get(r, "waterSourceId", "water_source_id")).strip() for r in source_records if _get(r, "waterSourceId", "water_source_id")}
        batches_by_stage = {stage: {str(_get(r, "batchId", "batch_id", "") or "").strip() for r in pathway_by_stage[stage] if _get(r, "batchId", "batch_id", "")} for stage in STAGES}
        stage_records = pathway_by_stage
    else:
        # Legacy compatibility: when no explicit journey graph is supplied, the
        # historical single-shared-batch mode remains available.
        source_ids = {str(_get(r, "waterSourceId", "water_source_id")).strip() for r in records if _get(r, "waterSourceId", "water_source_id")}
        batches_by_stage = {
            s: {str(_get(r, "batchId", "batch_id")).strip() for r in eligible_by_stage[s] if _get(r, "batchId", "batch_id")}
            for s in STAGES
        }
        batch_sets = [batches_by_stage[s] for s in STAGES]
        all_stages_have_batch_ids = all(bool(stage_batches) for stage_batches in batch_sets)
        common_batches = set.intersection(*batch_sets) if all_stages_have_batch_ids else set()
        has_identity_link = all_stages_have_batch_ids and len(common_batches) == 1 and len(source_ids) <= 1
        if len(source_ids) > 1:
            findings.append(Finding("source_identity_conflict", "warning", "Records refer to multiple source identities; they cannot be assumed to describe one water journey.", []))
        if records and sum(bool(stage_batches) for stage_batches in batch_sets) >= 2 and not common_batches:
            findings.append(Finding("no_shared_batch_link", "warning", "Records at multiple stages do not share a batch ID. Cross-stage pathway attribution is not permitted.", []))
        if len(common_batches) > 1:
            findings.append(Finding("ambiguous_multiple_common_batches", "warning", "More than one batch ID spans all pathway stages. The engine will not combine multiple possible water journeys into one attribution.", []))
        if records and not has_identity_link:
            findings.append(Finding("lineage_unproven", "warning", "Water-batch lineage is not established across stages. Individual test results may be reviewed, but a contamination entry point cannot be assigned.", []))
        shared_batch = next(iter(common_batches)) if len(common_batches) == 1 else None
        pathway_by_stage = {stage: [r for r in eligible_by_stage[stage] if shared_batch is not None and str(_get(r, "batchId", "batch_id", "")).strip() == shared_batch] for stage in STAGES}
        if shared_batch is not None:
            off_lineage_ids = [str(_get(r, "recordCode", "record_code", _get(r, "id", default="unknown"))) for stage in STAGES for r in eligible_by_stage[stage] if str(_get(r, "batchId", "batch_id", "")).strip() != shared_batch]
            if off_lineage_ids:
                findings.append(Finding("off_lineage_records", "warning", "Eligible records from other batches were excluded from this single-batch pathway interpretation.", off_lineage_ids))
        else:
            pathway_by_stage = {stage: [] for stage in STAGES}
        stage_records = pathway_by_stage if shared_batch is not None else eligible_by_stage

    pathway_analytes = {str(_get(r, "analyte")) for stage in STAGES for r in pathway_by_stage[stage] if _get(r, "analyte")}
    mixed_analyte_pathway = len(pathway_analytes) > 1
    if mixed_analyte_pathway:
        findings.append(Finding("mixed_analyte_pathway", "blocker", "Records within the selected pathway use different analytes. Results are not combined into a single stage-transition claim.", []))

    # Time order check only when timestamps parse. Mixed timezone awareness is treated
    # as unverifiable rather than silently normalised.
    times = []
    for s in STAGES:
        ts = [_time(r) for r in pathway_by_stage[s]]
        ts = [t for t in ts if t is not None]
        if ts:
            times.append((s, min(ts), max(ts)))
    temporal_conflict = False
    for i, (s1, _, max1) in enumerate(times):
        for s2, min2, _ in times[i+1:]:
            try:
                if STAGES.index(s1) < STAGES.index(s2) and max1 >= min2:
                    temporal_conflict = True
            except (TypeError, ValueError):
                temporal_conflict = True
    if temporal_conflict:
        findings.append(Finding("timeline_conflict", "warning",
            "Available timestamps overlap or conflict with conceptual stage order; verify chronology before interpreting the pathway.", []))

    positives = {s: [r for r in stage_records[s] if _positive(r)] for s in STAGES}
    negatives = {s: [r for r in stage_records[s] if _result(r) == "not_detected"] for s in STAGES}
    stage_observed = [s for s in STAGES if stage_records[s]]
    observed_positive = [s for s in STAGES if positives[s]]
    all_required_stages_observed = all(pathway_by_stage[s] for s in STAGES)

    # Mixed positive/negative outcomes at one stage are conflicting evidence, not a
    # reason to automatically prefer the positive. Block stage transition claims until
    # results have been reviewed (repeat tests and intermittent contamination are real).
    discordant_stages = [s for s in STAGES if positives[s] and negatives[s]]
    for stage in discordant_stages:
        ids = [str(_get(r, "recordCode", "record_code", _get(r, "id", default="record")))
               for r in stage_records[stage] if _positive(r) or _result(r) == "not_detected"]
        findings.append(Finding("discordant_stage_results", "blocker",
            f"Both positive and not-detected outcomes are present at {STAGE_LABELS[stage]}. Resolve timing, replicate identity, and method differences before pathway attribution.", ids))

    # Structural gates alone are not an attribution. Previously this flag
    # was true whenever the gates passed, even with no positive at all, a
    # positive only at the source, or a positive whose earlier stages had
    # no negative results (e.g. quantified zero, which is neither a
    # not-detected result nor a positive). The UI styles a report by this
    # flag, and the evaluation code only counts a report as an attribution
    # when confidence is "candidate transition only", so the flag now
    # means exactly that: a candidate transition interval bracketed by
    # negative results at every earlier stage. Anything else is reported
    # as an observation with an unresolved entry point.
    explicit_sample_links_strong = (not explicit_mode) or (explicit_review is not None and explicit_review.get("status") == "linked_for_review")
    structural_permitted = (
        has_identity_link and explicit_sample_links_strong and not temporal_conflict and all_required_stages_observed
        and not duplicate_identifiers and not cross_stage_sample_codes and not discordant_stages
        and not mixed_analyte_pathway
    )
    first_positive = next((s for s in STAGES if positives[s]), None)
    earlier_bracketed = (
        first_positive is not None and first_positive != "source"
        and all(negatives[s] for s in STAGES[:STAGES.index(first_positive)])
    )
    attribution_permitted = structural_permitted and earlier_bracketed
    if structural_permitted and first_positive is not None and not earlier_bracketed:
        if first_positive == "source":
            bracket_message = ("The earliest observed positive is at the source stage, so no earlier stage "
                               "brackets a transition interval; contamination origin timing remains unresolved.")
        else:
            bracket_message = (f"The earliest observed positive is at {STAGE_LABELS[first_positive]}, but earlier stages "
                               "do not all have eligible negative results, so no transition interval is bracketed.")
        findings.append(Finding("transition_not_bracketed", "warning", bracket_message, []))

    hypotheses = []
    for idx, stage in enumerate(STAGES):
        support = [str(_get(r, "recordCode", "record_code", _get(r, "id", default="record")))
                   for r in positives[stage]]
        contradiction = [str(_get(r, "recordCode", "record_code", _get(r, "id", default="record")))
                         for r in negatives[stage]]
        if not stage_records[stage]:
            status = "not_assessed"
            explanation = "No eligible reportable result at this stage; absence of data is not a negative result."
        elif support:
            status = "observed_positive"
            explanation = "At least one eligible record reports a positive result here. This locates an observed positive, not necessarily the original contamination event."
        else:
            status = "no_positive_observed"
            explanation = "Eligible records contain no reported positive result at this stage; this does not prove the stage was uncontaminated."
        hypotheses.append(asdict(Hypothesis(stage, STAGE_LABELS[stage], status, support, contradiction, explanation)))

    if not records:
        conclusion = "No evidence records supplied. No pathway assessment is possible."
        confidence = "not assessed"
    elif not observed_positive and explicit_mode and any(_positive(r) for stage in STAGES for r in eligible_by_stage[stage]):
        conclusion = ("Eligible positive result(s) exist in the submitted records, but none belong to one complete entity-connected route for the selected water journey. "
                      "These observations cannot support a candidate transition for this journey until the relationships are resolved.")
        confidence = "insufficient evidence"
        if not any(f.code == "eligible_positive_outside_resolved_path" for f in findings):
            findings.append(Finding("eligible_positive_outside_resolved_path", "warning", "One or more eligible positive results are not on a uniquely resolved route for this selected journey; they were not used in pathway hypotheses.", []))
    elif not observed_positive:
        conclusion = "No eligible positive result is present in the supplied records for the selected pathway. This is not proof that the water journey was uncontaminated."
        confidence = "insufficient evidence"
    elif attribution_permitted:
        # attribution_permitted already implies earlier_bracketed, so first
        # cannot be "source" here; this is the candidate transition branch.
        conclusion = (f"The earliest observed positive is at {STAGE_LABELS[first_positive]}; earlier sampled stages have negative results. "
                      "This supports a candidate transition interval, not definitive causal proof.")
        confidence = "candidate transition only"
    elif structural_permitted and first_positive == "source":
        conclusion = "A positive result is observed at the source stage. The data do not establish when contamination began."
        confidence = "observed at source; origin timing unresolved"
    elif structural_permitted and first_positive is not None and not earlier_bracketed:
        conclusion = (f"The earliest observed positive is at {STAGE_LABELS[first_positive]}, but earlier stages do not all have eligible negative results. "
                      "The entry point remains unresolved.")
        confidence = "insufficient evidence"
    else:
        conclusion = "Positive result(s) are observed, but contamination entry-point attribution is not permitted because evidence coverage, lineage, or chronology is insufficient."
        confidence = "insufficient evidence"

    # Recommend an information-improving action without inventing price, probabilities, or lab availability.
    if not records:
        next_step = {"action": "Add a real sample record or import a CSV.", "reason": "The engine cannot infer from absent records.", "target_stage": None}
    elif not has_identity_link:
        if explicit_mode:
            next_step = {"action": "Resolve water-journey relationships and transfer documentation before attributing a transition.", "reason": "The explicit sampling-event and transfer graph does not yet support a linked candidate transition. Do not assign a shared batch ID unless the source records support it.", "target_stage": None}
        else:
            next_step = {"action": "Verify source and batch identity, then collect a linked follow-up sample.", "reason": "Cross-stage records cannot currently be treated as one water journey.", "target_stage": "collection"}
    elif temporal_conflict:
        next_step = {"action": "Verify collection timestamps, stage labels, and refill/transfer history before adding more inference.", "reason": "Chronology is inconsistent.", "target_stage": None}
    else:
        missing = [s for s in STAGES if not pathway_by_stage[s]]
        target = missing[0] if missing else (observed_positive[-1] if observed_positive else "serving")
        if explicit_mode:
            next_step = {"action": f"Collect or resolve a documented sampling event at {STAGE_LABELS[target]} within the selected water journey.",
                         "reason": "This fills an evidence gap or adds a repeat observation. Linkage must reflect real field records; a shared batch ID is not required or invented in explicit-journey mode.", "target_stage": target}
        else:
            next_step = {"action": f"Collect a documented sample at {STAGE_LABELS[target]} and link it to the same verified water batch where physically valid.",
                         "reason": "This fills an evidence gap or adds a repeat observation; it is not guaranteed to identify the source.", "target_stage": target}

    # Per-record eligibility, exposed so the frontend never has to guess it.
    # "eligible" is exactly the engine's own _usable gate (QC, method,
    # timestamp, source/batch identity, supported analyte, finite numeric).
    # "on_pathway" additionally requires membership in the single selected
    # batch pathway; an eligible off-lineage record is usable as an
    # observation but does not contribute to pathway hypotheses. No
    # decision rule is changed by exposing these values.
    pathway_object_ids = {id(r) for stage in STAGES for r in pathway_by_stage[stage]}
    record_eligibility: list[dict[str, Any]] = []
    for r in records:
        stage = _stage(r)
        rid = str(_get(r, "recordCode", "record_code", _get(r, "id", default="unknown")))
        rec_id = str(_get(r, "id", default="") or "")
        if stage not in STAGES:
            record_eligibility.append({
                "record_code": rid, "record_id": rec_id, "stage": stage,
                "eligible": False, "reason": "Unsupported pathway stage",
                "result_kind": "neither", "on_pathway": False,
            })
            continue
        ok, reason = _usable(r, require_batch=not explicit_mode)
        if _positive(r):
            result_kind = "positive"
        elif _result(r) == "not_detected":
            result_kind = "negative"
        else:
            result_kind = "neither"
        record_eligibility.append({
            "record_code": rid, "record_id": rec_id, "stage": stage,
            "eligible": ok, "reason": reason, "result_kind": result_kind,
            "on_pathway": id(r) in pathway_object_ids,
            "pathway_link_basis": event_basis_by_record.get(rec_id) if explicit_mode else ("shared_batch" if id(r) in pathway_object_ids else None),
        })

    return asdict(DiagnosticReport(
        conclusion=conclusion,
        confidence_label=confidence,
        attribution_permitted=attribution_permitted,
        findings=[asdict(f) for f in findings],
        hypotheses=hypotheses,
        record_eligibility=record_eligibility,
        evidence_summary={
            "records_received": len(records),
            "eligible_records": sum(len(v) for v in eligible_by_stage.values()),
            "eligible_by_stage": {s: len(eligible_by_stage[s]) for s in STAGES},
            "positive_by_stage": {s: len(positives[s]) for s in STAGES},
            "negative_by_stage": {s: len(negatives[s]) for s in STAGES},
            "pathway_eligible_by_stage": {s: len(pathway_by_stage[s]) for s in STAGES},
            "pathway_batch_id": shared_batch,
            "shared_batch_ids": sorted(common_batches),
            "lineage_mode": "explicit_journey" if explicit_mode else "legacy_batch",
            "journey_id": (explicit_review or {}).get("journey_id") if explicit_mode else None,
            "journey_name": (explicit_review or {}).get("journey_name") if explicit_mode else None,
            "all_four_stages_observed": all_required_stages_observed,
        },
        next_step=next_step,
        lineage_review=explicit_review or {"mode": "legacy_batch", "journey_id": None, "journey_name": None,
            "status": "not_supplied", "stage_event_counts": {s: 0 for s in STAGES}, "transfer_edges": [], "blockers": []},
        next_actions=build_next_actions(stage_records, findings, explicit_review),
        limitations=[
            "This is a transparent rule-based prototype, not a validated probabilistic or machine-learning model.",
            "No calibrated probabilities or numerical confidence scores are produced.",
            "A positive test identifies an observed result, not when or how contamination entered the water.",
            "Negative results can be affected by sampling time, intermittent contamination, test sensitivity, and handling.",
            "Batch IDs and source labels are user-entered metadata and are not independently authenticated.",
            "When no unique batch spans every stage, per-stage observations may be displayed but are not a single linked pathway and cannot support transition attribution.",
            "Duplicate record identifiers, sample IDs reused across stages, and mixed positive/negative outcomes within a stage block attribution pending review.",
            "Attribution is permitted only when a candidate transition interval is bracketed by negative results at all earlier stages; a linked positive at the source, or a positive without negatives at every earlier stage, is an observation, not an attribution.",
            "Quality-control fields must explicitly pass; absent QC documentation makes the record ineligible for pathway inference.",
            "Evidence from different analytes is not combined into a single cross-stage transition claim.",
            "Equal or overlapping adjacent-stage timestamps cannot establish a strict stage order and block attribution.",
            "When one batch links all four stages, eligible records from other batches are excluded from pathway interpretation.",
            "The four-stage pathway is a simplified model; refills, mixing, branching, and unrecorded transfers can invalidate attribution.",
            "Only supported E. coli presence/absence and concentration records are considered for this prototype; other analytes are excluded.",
            "Explicit journey mode uses user-entered sampling-event and transfer relationships; it does not authenticate documents or prove physical continuity.",
            "A relationship map can reduce dependence on a repeated batch ID, but causal interpretation still requires eligible stage observations, documented adjacent-stage transfer evidence, and a bracketed transition.",
        ],
    ))
