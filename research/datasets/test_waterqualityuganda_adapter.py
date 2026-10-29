import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
from waterqualityuganda_adapter import analyze_files  # noqa: E402

FIX = REPO / "research" / "fixtures"

class UgandaAdapterTests(unittest.TestCase):
    def report(self):
        return analyze_files(str(FIX/"samples.csv"), str(FIX/"borehole_visits.csv"), str(FIX/"household_visits.csv"), str(FIX/"labblanks.csv"))

    def test_profiles_counts_and_files_have_hashes(self):
        report = self.report()
        self.assertEqual(report["data_profile"]["samples_rows"], 6)
        self.assertEqual(len(report["source_files"]), 4)
        self.assertTrue(all(len(x["sha256"]) == 64 for x in report["source_files"].values()))

    def test_only_exact_household_pairs_are_summarized_and_tntc_is_censored(self):
        report = self.report()
        pairs = report["paired_household_transport_storage"]
        self.assertEqual(pairs["exact_measured_pairs"], 2)
        self.assertEqual(pairs["pair_state_counts"]["storage_only_detected"], 1)
        self.assertEqual(pairs["pair_state_counts"]["censored_pair"], 1)
        self.assertEqual(report["sample_type_summary"]["transport_container"]["tntc_censored_rows"], 1)

    def test_match_status_and_lab_blank_qc_are_not_silently_ignored(self):
        report = self.report()
        self.assertEqual(report["data_profile"]["ambiguous_match_rows"], 1)
        self.assertEqual(report["laboratory_blanks"]["positive_ecoli_count_rows"], 1)
        self.assertTrue(any("causal" in x.lower() for x in report["relationship_warnings"]))

    def test_required_columns_are_validated(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p/"bad.csv").write_text("sample_id,visit_id\n1,2\n", encoding="utf-8")
            for name in ("borehole_visits", "household_visits", "labblanks"):
                (p/f"{name}.csv").write_bytes((FIX/f"{name}.csv").read_bytes())
            with self.assertRaisesRegex(ValueError, "missing required columns"):
                analyze_files(str(p/"bad.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))


    def test_visit_join_audit_reports_missing_visit_ids_and_documented_join_type(self):
        report = self.report()
        joins = report["sample_visit_link_audit"]["join_counts"]
        self.assertEqual(joins["borehole_visit"], 1)
        self.assertEqual(joins["household_visit"], 4)
        self.assertEqual(joins["missing_visit_id"], 1)
        self.assertIn("not verified physical transfers", report["sample_visit_link_audit"]["warning"])

    def test_empty_tables_with_headers_are_profiled(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            source_files = {
                "samples": FIX / "samples.csv", "borehole_visits": FIX / "borehole_visits.csv",
                "household_visits": FIX / "household_visits.csv", "labblanks": FIX / "labblanks.csv",
            }
            for name, source in source_files.items():
                header = source.read_text(encoding="utf-8").splitlines()[0]
                (p / f"{name}.csv").write_text(header + "\n", encoding="utf-8")
            report = analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))
            self.assertEqual(report["data_profile"]["samples_rows"], 0)
            self.assertEqual(report["paired_household_transport_storage"]["exact_measured_pairs"], 0)


    def test_non_matched_sample_is_excluded_from_transport_storage_pair(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            source = (FIX / "samples.csv").read_text(encoding="utf-8")
            source = source.replace(
                "3,20,Region A,District A,2025-01-01,storage_container,2,2025-01-01,2025-01-02,3,7,FALSE,100,Slightly contaminated,,matched",
                "3,20,Region A,District A,2025-01-01,storage_container,2,2025-01-01,2025-01-02,3,7,FALSE,100,Slightly contaminated,,ambiguous key",
            )
            (p / "samples.csv").write_text(source, encoding="utf-8")
            for name in ("borehole_visits", "household_visits", "labblanks"):
                (p / f"{name}.csv").write_bytes((FIX / f"{name}.csv").read_bytes())
            report = analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))
            pairs = report["paired_household_transport_storage"]
            self.assertEqual(pairs["exact_measured_pairs"], 1)
            self.assertEqual(pairs["excluded_pair_rows_by_match_status"]["ambiguous key"], 1)

    def test_duplicate_household_visit_id_is_not_silently_overwritten_or_paired(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            (p / "samples.csv").write_bytes((FIX / "samples.csv").read_bytes())
            household = (FIX / "household_visits.csv").read_text(encoding="utf-8")
            lines = household.splitlines()
            lines.append(lines[1])  # Duplicate visit_id 20; values intentionally match.
            (p / "household_visits.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")
            for name in ("borehole_visits", "labblanks"):
                (p / f"{name}.csv").write_bytes((FIX / f"{name}.csv").read_bytes())
            report = analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))
            joins = report["sample_visit_link_audit"]["join_counts"]
            self.assertEqual(joins["duplicate_household_visit_key"], 2)
            self.assertIn("20", report["sample_visit_link_audit"]["duplicate_household_visit_ids"])
            self.assertEqual(report["paired_household_transport_storage"]["exact_measured_pairs"], 1)
            self.assertEqual(report["paired_household_transport_storage"]["unpaired_or_ambiguous_household_visits"]["duplicate_household_visit_key"], 1)

    def test_duplicate_sample_id_is_excluded_from_pairs(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            samples = (FIX / "samples.csv").read_text(encoding="utf-8")
            lines = samples.splitlines()
            duplicate = lines[2].split(",")
            duplicate[0] = "3"  # duplicate existing storage sample ID, with a different visit/type row
            duplicate[1] = "21"
            duplicate[5] = "transport_container"
            lines.append(",".join(duplicate))
            (p / "samples.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")
            for name in ("borehole_visits", "household_visits", "labblanks"):
                (p / f"{name}.csv").write_bytes((FIX / f"{name}.csv").read_bytes())
            report = analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))
            self.assertIn("3", report["sample_visit_link_audit"]["duplicate_sample_ids"])
            self.assertGreaterEqual(report["paired_household_transport_storage"]["excluded_pair_rows_by_match_status"]["missing_or_duplicate_sample_id"], 1)


    def test_negative_and_nonfinite_counts_are_reported_not_used_as_valid_measurements(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            samples = (FIX / "samples.csv").read_text(encoding="utf-8")
            samples = samples.replace(
                "2,20,Region A,District A,2025-01-01,transport_container,1,2025-01-01,2025-01-02,2,0,FALSE,100,Safe,,matched",
                "2,20,Region A,District A,2025-01-01,transport_container,1,2025-01-01,2025-01-02,2,-3,FALSE,100,Safe,,matched",
            )
            samples = samples.replace(
                "6,NA,Region A,District A,2025-01-02,NA,99,2025-01-02,2025-01-03,6,1,FALSE,100,Slightly contaminated,,ambiguous key",
                "6,NA,Region A,District A,2025-01-02,NA,99,2025-01-02,2025-01-03,6,inf,FALSE,100,Slightly contaminated,,ambiguous key",
            )
            (p / "samples.csv").write_text(samples, encoding="utf-8")
            for name in ("borehole_visits", "household_visits", "labblanks"):
                (p / f"{name}.csv").write_bytes((FIX / f"{name}.csv").read_bytes())
            report = analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))
            transport = report["sample_type_summary"]["transport_container"]
            self.assertEqual(transport["invalid_negative_count_rows"], 1)
            self.assertEqual(transport["measured_rows"], 1)
            self.assertEqual(report["sample_type_summary"]["unmatched_or_unknown"]["unparseable_nonmissing_result_rows"], 1)

    def test_sample_visit_date_mismatch_is_reported_not_repaired(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            samples = (FIX / "samples.csv").read_text(encoding="utf-8")
            samples = samples.replace(
                "2,20,Region A,District A,2025-01-01,transport_container,1,2025-01-01,2025-01-02,2,0,FALSE,100,Safe,,matched",
                "2,20,Region A,District A,2025-01-05,transport_container,1,2025-01-01,2025-01-02,2,0,FALSE,100,Safe,,matched",
            )
            (p / "samples.csv").write_text(samples, encoding="utf-8")
            for name in ("borehole_visits", "household_visits", "labblanks"):
                (p / f"{name}.csv").write_bytes((FIX / f"{name}.csv").read_bytes())
            report = analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))
            self.assertEqual(report["data_profile"]["sample_visit_date_mismatch_rows"], 1)
            mismatch = report["sample_visit_link_audit"]["sample_visit_date_mismatches"][0]
            self.assertEqual(mismatch["sample_id"], "2")
            self.assertEqual(mismatch["sample_date_sampled"], "2025-01-05")
            self.assertEqual(mismatch["visit_date_sampled"], "2025-01-01")

    def test_extra_csv_cells_are_rejected_instead_of_dropped(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d)
            original = (FIX / "samples.csv").read_text(encoding="utf-8").splitlines()
            original[1] += ",unexpected-extra-cell"
            (p/"samples.csv").write_text("\n".join(original) + "\n", encoding="utf-8")
            for name in ("borehole_visits", "household_visits", "labblanks"):
                (p/f"{name}.csv").write_bytes((FIX/f"{name}.csv").read_bytes())
            with self.assertRaisesRegex(ValueError, "extra cells"):
                analyze_files(str(p/"samples.csv"), str(p/"borehole_visits.csv"), str(p/"household_visits.csv"), str(p/"labblanks.csv"))

if __name__ == "__main__": unittest.main()
