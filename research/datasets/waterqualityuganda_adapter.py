#!/usr/bin/env python3
"""Profile the public Water Quality Uganda CSV package without inventing causal labels.

The adapter works on CSVs downloaded by the user from the dataset maintainers. It does
not upload data, write to the WaterChain register, or reinterpret observational rows as
same-batch causal pathways. Standard library only.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any

DATASET_URL = "https://openwashdata.github.io/waterqualityuganda/"
SOURCE_REPO = "https://github.com/openwashdata/waterqualityuganda"
LICENSE = "CC-BY (see maintainer documentation for exact attribution requirements)"
EXPECTED = {
    "samples": {"sample_id", "visit_id", "district", "date_sampled", "sample_type", "ecoli_cfu", "tntc", "volume_ml", "match_status"},
    "borehole_visits": {"visit_id", "date_sampled", "district", "source_name"},
    "household_visits": {"visit_id", "date_sampled", "district", "source_name", "transport_container", "storage_container"},
    "labblanks": {"blank_id", "date_incubation", "district", "ecoli_cfu"},
}


def read_csv(path: str) -> tuple[list[dict[str, str]], str, int, list[str]]:
    p = Path(path)
    raw = p.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    if not reader.fieldnames or not any(str(name).strip() for name in reader.fieldnames):
        raise ValueError(f"{path}: missing CSV header")
    fieldnames = [str(name).strip() for name in reader.fieldnames]
    normalized = [name.casefold() for name in fieldnames]
    if len(set(normalized)) != len(normalized):
        raise ValueError(f"{path}: duplicate column names are not supported")
    rows = [dict(row) for row in reader]
    # DictReader stores extra cells under a None key. Fail closed instead of
    # silently losing values from a malformed research export.
    malformed = [index + 2 for index, row in enumerate(rows) if None in row]
    if malformed:
        preview = ", ".join(str(line) for line in malformed[:10])
        raise ValueError(f"{path}: extra cells found on CSV row(s) {preview}; fix the source CSV before profiling")
    return rows, digest, len(raw), fieldnames


def missing(value: Any) -> bool:
    return value is None or str(value).strip().casefold() in {"", "na", "n/a", "null", "nan"}


def num(value: Any) -> float | None:
    if missing(value): return None
    try:
        parsed = float(str(value).strip())
        return parsed if math.isfinite(parsed) else None
    except (ValueError, TypeError):
        return None


def norm_key(value: Any) -> str | None:
    if missing(value): return None
    return str(value).strip()


def summarize_counts(rows: list[dict[str, str]], field: str) -> dict[str, int]:
    return dict(sorted(Counter((norm_key(row.get(field)) or "[missing]") for row in rows).items()))


def analyze_files(samples_path: str, borehole_path: str, household_path: str, blanks_path: str) -> dict[str, Any]:
    paths = {"samples": samples_path, "borehole_visits": borehole_path, "household_visits": household_path, "labblanks": blanks_path}
    tables: dict[str, list[dict[str, str]]] = {}
    source_files: dict[str, dict[str, Any]] = {}
    for name, path in paths.items():
        rows, digest, size, columns = read_csv(path)
        fields = set(columns)
        absent = sorted(EXPECTED[name] - fields)
        if absent:
            raise ValueError(f"{name}: missing required columns: {', '.join(absent)}")
        tables[name] = rows
        source_files[name] = {"file_name": Path(path).name, "rows": len(rows), "bytes": size, "sha256": digest, "columns": sorted(fields)}

    samples, boreholes, households, blanks = (tables[k] for k in ("samples", "borehole_visits", "household_visits", "labblanks"))
    sample_types = Counter((norm_key(row.get("sample_type")) or "unmatched_or_unknown") for row in samples)
    match_status = Counter((norm_key(row.get("match_status")) or "[missing]") for row in samples)
    by_type: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in samples: by_type[norm_key(row.get("sample_type")) or "unmatched_or_unknown"].append(row)

    stage_stats: dict[str, Any] = {}
    for sample_type, rows in sorted(by_type.items()):
        parsed_values = [num(row.get("ecoli_cfu")) for row in rows]
        negative_rows = sum(value is not None and value < 0 for value in parsed_values)
        measured = [value for value in parsed_values if value is not None and value >= 0]
        unparseable_rows = sum(not missing(row.get("ecoli_cfu")) and value is None for row, value in zip(rows, parsed_values))
        detected = sum(v > 0 for v in measured)
        censored = sum(str(row.get("tntc", "")).strip().casefold() == "true" for row in rows)
        stage_stats[sample_type] = {
            "rows": len(rows), "measured_rows": len(measured), "missing_result_rows": sum(missing(row.get("ecoli_cfu")) for row in rows),
            "invalid_negative_count_rows": negative_rows, "unparseable_nonmissing_result_rows": unparseable_rows,
            "ecoli_detected_rows": detected, "ecoli_detected_share_of_measured": (detected / len(measured) if measured else None),
            "zero_count_rows": sum(v == 0 for v in measured), "tntc_censored_rows": censored,
            "median_recorded_cfu": median(measured) if measured else None,
            "note": "TNTC counts are censored/upper-coded and are not exact colony counts; do not treat them as precise measurements.",
        }

    # A join key must be unique in its dimension table. Never let dict-comprehension
    # overwrite a duplicate visit ID and silently select the last row.
    def unique_visit_index(rows: list[dict[str, str]]) -> tuple[dict[str, dict[str, str]], set[str]]:
        grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in rows:
            visit_id = norm_key(row.get("visit_id"))
            if visit_id:
                grouped[visit_id].append(row)
        unique = {visit_id: values[0] for visit_id, values in grouped.items() if len(values) == 1}
        duplicates = {visit_id for visit_id, values in grouped.items() if len(values) > 1}
        return unique, duplicates

    households_by_visit, duplicate_household_visit_ids = unique_visit_index(households)
    boreholes_by_visit, duplicate_borehole_visit_ids = unique_visit_index(boreholes)
    sample_rows_by_visit: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in samples:
        vid = norm_key(row.get("visit_id"))
        if vid: sample_rows_by_visit[vid].append(row)

    paired_transport_storage = []
    unmatched_event_counts = Counter()
    excluded_pair_rows_by_status = Counter()
    duplicate_sample_ids = Counter((norm_key(row.get("sample_id")) or "[missing]") for row in samples)
    duplicate_sample_id_values = {sample_id for sample_id, count in duplicate_sample_ids.items() if count > 1 and sample_id != "[missing]"}
    for visit_id, visit_samples in sample_rows_by_visit.items():
        visit = households_by_visit.get(visit_id)
        if visit_id in duplicate_household_visit_ids:
            unmatched_event_counts["duplicate_household_visit_key"] += 1
            continue
        if not visit:
            continue
        matched_samples = []
        for row in visit_samples:
            status = (norm_key(row.get("match_status")) or "[missing]").casefold()
            sample_id = norm_key(row.get("sample_id"))
            if status != "matched":
                excluded_pair_rows_by_status[status] += 1
                continue
            if not sample_id or sample_id in duplicate_sample_id_values:
                excluded_pair_rows_by_status["missing_or_duplicate_sample_id"] += 1
                continue
            matched_samples.append(row)
        by_sample_type: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in matched_samples:
            by_sample_type[norm_key(row.get("sample_type")) or "unknown"].append(row)
        transports = [r for r in by_sample_type.get("transport_container", []) if num(r.get("ecoli_cfu")) is not None and num(r.get("ecoli_cfu")) >= 0]
        storages = [r for r in by_sample_type.get("storage_container", []) if num(r.get("ecoli_cfu")) is not None and num(r.get("ecoli_cfu")) >= 0]
        if len(transports) == 1 and len(storages) == 1:
            tr, st = transports[0], storages[0]
            if str(tr.get("tntc", "")).casefold() == "true" or str(st.get("tntc", "")).casefold() == "true":
                pair_state = "censored_pair"
            else:
                tr_v, st_v = num(tr.get("ecoli_cfu")), num(st.get("ecoli_cfu"))
                pair_state = "both_detected" if tr_v and tr_v > 0 and st_v and st_v > 0 else (
                    "transport_only_detected" if tr_v and tr_v > 0 and st_v == 0 else (
                        "storage_only_detected" if tr_v == 0 and st_v and st_v > 0 else "neither_detected"))
            paired_transport_storage.append({"visit_id": visit_id, "district": visit.get("district"), "date_sampled": visit.get("date_sampled"),
                                             "transport_sample_id": tr.get("sample_id"), "storage_sample_id": st.get("sample_id"), "pair_state": pair_state,
                                             "boils_water": visit.get("boils_water"), "transport_container": visit.get("transport_container"), "storage_container": visit.get("storage_container")})
        else:
            unmatched_event_counts["visits_with_household_samples_but_not_exactly_one_measured_transport_and_storage"] += 1

    pair_counts = Counter(row["pair_state"] for row in paired_transport_storage)
    measured_blanks = [(num(row.get("ecoli_cfu")), row) for row in blanks if not missing(row.get("ecoli_cfu"))]
    positive_blanks = [row for value, row in measured_blanks if value is not None and value > 0]
    blank_summary = {
        "rows": len(blanks), "measured": len(measured_blanks), "missing_results": len(blanks) - len(measured_blanks),
        "positive_ecoli_count_rows": len(positive_blanks),
        "positive_blank_rows": [{"blank_id": row.get("blank_id"), "date_incubation": row.get("date_incubation"), "district": row.get("district"), "ecoli_cfu": row.get("ecoli_cfu")} for row in positive_blanks[:100]],
        "interpretation": "A non-zero laboratory blank is a lab-process QC signal requiring qualified review; this adapter does not automatically invalidate or repair specific samples without an approved linkage rule.",
    }

    ambiguous_samples = [row for row in samples if (norm_key(row.get("match_status")) or "").casefold() == "ambiguous key"]
    unmatched_samples = [row for row in samples if (norm_key(row.get("match_status")) or "").casefold() in {"no field record", "no lab result", "ambiguous key"}]
    sample_visit_join_counts = Counter()
    sample_type_visit_mismatches = []
    # Step 12 audit addition: a sample joined to a visit should agree with that
    # visit on the sampling date (the visit date is defined as the collection
    # date). A disagreement does not prove a wrong join, but it is a data-quality
    # signal that was previously unreported; mismatches are listed for review
    # and never silently repaired.
    sample_visit_date_mismatches = []
    for row in samples:
        visit_id = norm_key(row.get("visit_id"))
        sample_type = (norm_key(row.get("sample_type")) or "").casefold()
        if not visit_id:
            join_type = "missing_visit_id"
        else:
            in_borehole = visit_id in boreholes_by_visit
            in_household = visit_id in households_by_visit
            if visit_id in duplicate_borehole_visit_ids and visit_id in duplicate_household_visit_ids: join_type = "duplicate_key_in_both_visit_tables"
            elif visit_id in duplicate_borehole_visit_ids: join_type = "duplicate_borehole_visit_key"
            elif visit_id in duplicate_household_visit_ids: join_type = "duplicate_household_visit_key"
            elif in_borehole and in_household: join_type = "ambiguous_in_both_visit_tables"
            elif in_borehole: join_type = "borehole_visit"
            elif in_household: join_type = "household_visit"
            else: join_type = "no_matching_visit_record"
        sample_visit_join_counts[join_type] += 1
        expects_borehole = sample_type in {"borehole", "borehole_duplicate"}
        expects_household = sample_type in {"transport_container", "storage_container"}
        if (expects_borehole and join_type != "borehole_visit") or (expects_household and join_type != "household_visit"):
            sample_type_visit_mismatches.append({"sample_id": row.get("sample_id"), "visit_id": visit_id, "sample_type": row.get("sample_type"), "observed_join_type": join_type, "match_status": row.get("match_status")})
        if join_type in {"borehole_visit", "household_visit"}:
            visit_row = boreholes_by_visit.get(visit_id) if join_type == "borehole_visit" else households_by_visit.get(visit_id)
            sample_date = norm_key(row.get("date_sampled"))
            visit_date = norm_key(visit_row.get("date_sampled")) if visit_row else None
            if sample_date and visit_date and sample_date != visit_date:
                sample_visit_date_mismatches.append({"sample_id": row.get("sample_id"), "visit_id": visit_id, "sample_type": row.get("sample_type"), "sample_date_sampled": sample_date, "visit_date_sampled": visit_date, "match_status": row.get("match_status")})
    return {
        "report_schema": "waterchain-waterqualityuganda-profile-v1",
        "generated_at_utc": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "dataset": {"title": "Drinking Water Quality from Boreholes to Household Storage in Uganda", "maintainer_url": DATASET_URL,
                    "source_repository": SOURCE_REPO, "license": LICENSE, "authors_year": "Nansiimbi & Clavijo Daza (2026)",
                    "citation": "Nansiimbi C, Clavijo Daza A (2026). waterqualityuganda: Drinking Water Quality from Boreholes to Household Storage in Uganda. https://github.com/openwashdata/waterqualityuganda",
                    "study_period": "2024-11 to 2025-09", "regions": 4, "warning": "Observational research dataset. This report does not identify individual causal contamination entry points."},
        "source_files": source_files,
        "data_profile": {"samples_rows": len(samples), "borehole_visit_rows": len(boreholes), "household_visit_rows": len(households), "lab_blank_rows": len(blanks),
                         "sample_type_counts": dict(sorted(sample_types.items())), "match_status_counts": dict(sorted(match_status.items())),
                         "ambiguous_match_rows": len(ambiguous_samples), "unmatched_or_no_result_rows": len(unmatched_samples),
                         "sample_visit_join_counts": dict(sorted(sample_visit_join_counts.items())),
                         "duplicate_borehole_visit_ids": sorted(duplicate_borehole_visit_ids),
                         "duplicate_household_visit_ids": sorted(duplicate_household_visit_ids),
                         "duplicate_sample_ids": sorted(duplicate_sample_id_values),
                         "sample_type_visit_mismatch_rows": len(sample_type_visit_mismatches),
                         "sample_visit_date_mismatch_rows": len(sample_visit_date_mismatches)},
        "sample_visit_link_audit": {"join_counts": dict(sorted(sample_visit_join_counts.items())), "sample_type_visit_mismatch_count": len(sample_type_visit_mismatches),
                                    "sample_type_visit_mismatches": sample_type_visit_mismatches[:200],
                                    "sample_visit_date_mismatch_count": len(sample_visit_date_mismatches),
                                    "sample_visit_date_mismatches": sample_visit_date_mismatches[:200],
                                    "duplicate_borehole_visit_ids": sorted(duplicate_borehole_visit_ids),
                                    "duplicate_household_visit_ids": sorted(duplicate_household_visit_ids),
                                    "duplicate_sample_ids": sorted(duplicate_sample_id_values),
                                    "warning": "Visit table joins are relationship checks only; they are not verified physical transfers between samples. Duplicate keys are treated as ambiguous and not paired."},
        "sample_type_summary": stage_stats,
        "paired_household_transport_storage": {"exact_measured_pairs": len(paired_transport_storage), "pair_state_counts": dict(sorted(pair_counts.items())),
                                               "unpaired_or_ambiguous_household_visits": dict(unmatched_event_counts),
                                               "excluded_pair_rows_by_match_status": dict(sorted(excluded_pair_rows_by_status.items())),
                                               "pairs": paired_transport_storage,
                                               "caution": "Within-visit pairing is descriptive. Different bottle results, sampling conditions, intermittent contamination, or uncaptured transfers prevent this summary from proving where contamination entered."},
        "laboratory_blanks": blank_summary,
        "relationship_warnings": [
            "Do not require a sample bottle's ID to persist between stages: each bottle is a distinct sample event.",
            "visit_id joins a sample to its borehole visit OR household visit; this does not itself prove a physical transfer between two water samples.",
            "Bottle number restarts daily and may be duplicated; retain the published match_status and do not re-link ambiguous rows automatically.",
            "Paired transport/storage summaries use only rows explicitly marked matched, with unique sample IDs and unique household visit IDs. Non-matched rows are counted but excluded from pairing.",
            "TNTC counts are censored and not exact CFU estimates.",
        "Negative or non-finite E. coli counts are not included in valid measured summaries or matched transport/storage pairs; invalid numeric rows are reported, not silently normalized.",
            "The source_name/district relationship between households and boreholes is contextual and must not be treated as a uniquely verified water journey without additional evidence.",
            "Observed sample-to-visit mismatches and missing/ambiguous visit joins are reported for review; this adapter never repairs or reassigns those links automatically.",
            "Sample dates that disagree with their joined visit date are reported as date mismatches for review; a disagreement is a data-quality signal, not proof that the join is wrong.",
            "All comparisons are descriptive and do not infer causal contamination entry points or validated prediction performance.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", required=True)
    parser.add_argument("--borehole-visits", required=True)
    parser.add_argument("--household-visits", required=True)
    parser.add_argument("--labblanks", required=True)
    parser.add_argument("--out", required=True, help="Output JSON report path")
    args = parser.parse_args()
    report = analyze_files(args.samples, args.borehole_visits, args.household_visits, args.labblanks)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "profile_complete", "output": str(out), "files_profiled": len(report["source_files"]), "samples": report["data_profile"]["samples_rows"], "paired_household_transport_storage": report["paired_household_transport_storage"]["exact_measured_pairs"]}, indent=2))
    return 0

if __name__ == "__main__":
    try: raise SystemExit(main())
    except (OSError, UnicodeError, ValueError) as exc:
        print(json.dumps({"status": "error", "message": str(exc)}))
        raise SystemExit(2)
