"""Run WaterChain Step 20 feasible checks and hash release inputs, with frontend gates executed."""
from __future__ import annotations
import hashlib
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "validation" / "reproducibility_manifest.json"
CHECKS = [
    ("engine_tests", [sys.executable, "-m", "unittest", "discover", "-s", "engine", "-p", "test_*.py", "-v"]),
    ("dataset_adapter_tests", [sys.executable, "-m", "unittest", "discover", "-s", "research/datasets", "-p", "test_*.py", "-v"]),
    ("synthetic_evaluation", [sys.executable, "engine/evaluate.py"]),
    ("synthetic_holdout", [sys.executable, "engine/run_holdout_validation.py"]),
    ("step19_validation_tools", [sys.executable, "-m", "unittest", "discover", "-s", "validation", "-p", "test_*.py", "-v"]),
]
INPUTS = [
    "README.md", "docs/history/README.md", "package.json", "package-lock.json", "docs/history/STEP19_CHANGELOG.md", "docs/history/STEP12_PRODUCT_FOUNDATION.md",
    "STARTUP_GUIDE.md", "docs/history/TEST_REPORT.md", "docs/history/BROWSER_TEST_REPORT.md",
    "docs/history/BUG_FIX_SUMMARY.md", "docs/history/BUG_FIX_SUMMARY_STEP10.md", "docs/history/BUG_FIX_SUMMARY_STEP11.md",
    "JUDGE_DEMO_CHECKLIST.md", "docs/history/READINESS_ASSESSMENT.md", "DESIGN_SYSTEM.md",
    "docs/history/REDESIGN_CHANGELOG.md", "docs/history/REFINEMENT_CHANGELOG.md", "docs/history/STEP11_FIXES.md", "docs/history/STEP11_VERIFICATION.md",
    "engine/diagnose.py", "engine/diagnose_cli.py", "engine/evaluate.py", "engine/holdout_validation.py",
    "engine/run_holdout_validation.py", "engine/build_reproducibility_manifest.py",
    "engine/test_diagnose.py", "engine/test_explicit_journey.py", "engine/test_record_eligibility.py",
    "engine/test_adversarial_mutations.py", "engine/test_evaluate.py", "engine/test_holdout_validation.py", "engine/test_step12_cli.py", "engine/test_step16_sensitivity.py",
    "research/datasets/waterqualityuganda_adapter.py", "research/datasets/test_waterqualityuganda_adapter.py",
    "research/datasets/README.md", "research/fixtures/samples.csv", "research/fixtures/borehole_visits.csv",
    "research/fixtures/household_visits.csv", "research/fixtures/labblanks.csv",
    "research/real-data-profile.json",
    "lib/investigation-model.ts", "lib/provenance-vault.ts", "lib/diagnostics.ts", "lib/evidence.ts", "lib/evidence-csv.ts",
    "components/journey/WaterJourneyWorkbench.tsx", "components/diagnostics/DiagnosticWorkbench.tsx",
    "components/evidence/EvidenceRegister.tsx", "app/api/diagnose/route.ts", "app/page.tsx", "app/globals.css",
    "tests/e2e/step12-journey-model.spec.ts", "tests/e2e/step12-audit.spec.ts", "tests/README.md",
    "docs/history/BUG_FIX_SUMMARY_STEP12.md", "SCIENTIFIC_VALIDATION_REPORT.md", "RESEARCH_DATA_AUDIT.md", "DEPLOYMENT_READINESS.md",
    "supabase/migrations/202610280001_waterchain_relational_foundation.sql",
    "docs/history/STEP12_PRODUCT_FOUNDATION.md", "validation/STEP12_VERIFICATION.md",
    "validation/STEP12_CHANGELOG.md", "validation/STEP12_NOVELTY_AND_PRIOR_ART.md",
    "engine/evaluation_report.json", "engine/evaluation_report.md", "engine/holdout_report.json", "engine/holdout_report.md",
    "tests/e2e/helpers.ts", "tests/e2e/pathway.spec.ts", "tests/e2e/workflows.spec.ts", "tests/e2e/screenshots.spec.ts", "tests/e2e/step11-audit.spec.ts", "tests/e2e/step11-screenshots.spec.ts",
    "scripts/check-typescript-syntax.cjs",
    "lib/action-loop.ts", "components/actions/ActionLoop.tsx", "tests/e2e/action-loop.spec.ts",
    "components/diagnostics/DecisionRobustnessStudio.tsx", "tests/e2e/decision-robustness.spec.ts",
    "STEP16_DECISION_ROBUSTNESS.md", "STEP16_NOVELTY_AND_PRODUCT_STRATEGY.md", "docs/history/STEP16_VERIFICATION.md",
    "docs/history/STEP16_CHANGELOG.md", "docs/history/STEP16_RELEASE_AUDIT.md", "docs/history/SENSITIVITY_TEST_REPORT.md", "docs/history/BUG_FIX_SUMMARY_STEP16.md",
    "ACTIONLOOP_GUIDE.md", "docs/history/STEP13_CHANGELOG.md", "docs/history/STEP13_VERIFICATION.md", "docs/history/STEP13_RELEASE_AUDIT.md",
    "lib/risk-register.ts", "components/risks/RiskControlRegister.tsx", "tests/e2e/risk-control-register.spec.ts",
    "RISK_CONTROL_REGISTER_GUIDE.md", "RISK_CONTROL_TEST_PLAN.md", "docs/history/STEP14_CHANGELOG.md", "docs/history/STEP14_VERIFICATION.md", "docs/history/STEP14_RELEASE_AUDIT.md",
    "TEMPORAL_EVIDENCE_GUIDE.md", "TEMPORAL_PLANNER_PROTOCOL.md", "docs/history/STEP15_CHANGELOG.md", "docs/history/STEP15_VERIFICATION.md", "docs/history/STEP15_RELEASE_AUDIT.md",
    "lib/temporal-evidence.ts", "components/temporal/TemporalEvidenceWorkbench.tsx", "tests/e2e/temporal-evidence.spec.ts", "tests/e2e/fixtures/temporal-undated.csv",
    "app/page.tsx", "app/globals.css", "components/actions/ActionLoop.tsx", "README.md", "STARTUP_GUIDE.md",
    "lib/independent-review.ts", "components/validation/IndependentReviewWorkbench.tsx",
    "tests/unit/independent-review.test.cjs", "tests/e2e/independent-validation.spec.ts",
    "validation/STEP17_INDEPENDENT_REVIEW.md", "validation/STEP17_VERIFICATION.md",
    "validation/STEP17_CHANGELOG.md", "validation/STEP17_READINESS.md",
    "docs/history/BUG_FIX_SUMMARY_STEP18.md", "engine/step18_compare.py", "engine/test_step18_compare.py",
    "engine/COMPARATIVE_EVALUATION_PROTOCOL.md", "engine/step18_comparison_report.json",
    "engine/step18_comparison_report.md", "engine/build_step18_reviewer_packet.py",
    "validation/reviewer_packet_step18.json", "validation/INDEPENDENT_REVIEW_PROTOCOL.md",
    "validation/USER_EVALUATION_PROTOCOL.md", "validation/STEP18_DEMO_SCRIPT.md",
    "validation/STEP18_PROJECT_REPORT_DRAFT.md", "research/REAL_DATA_QUALITY_STEP18.md",
    "engine/step18_compare.py", "engine/test_step18_compare.py", "engine/step18_comparison_report.json",
    "validation/score_independent_review.py", "validation/analyze_user_evaluation.py",
    "validation/test_step19_tools.py", "validation/build_reviewer_handoff.py", "validation/build_pilot_task_kits.py",
    "validation/EXTERNAL_REVIEW_PROTOCOL_STEP19.md", "validation/INDEPENDENT_REVIEW_INVITATION.md",
    "validation/REVIEWER_HANDOFF_README.md", "validation/README_STEP19_VALIDATION_TOOLS.md",
    "validation/MANUAL_WORKFLOW_BASELINE.md", "validation/USER_EVALUATION_PROTOCOL.md",
    "validation/user_evaluation_capture_template.csv", "validation/pilot_study/PARTICIPANT_RESPONSE_TEMPLATE.csv",
    "validation/pilot_study/PLANNED_ASSIGNMENT_MATRIX_NOT_DATA.csv",
    "validation/pilot_study/SET_A/records.csv", "validation/pilot_study/SET_A/entities.csv", "validation/pilot_study/SET_A/transfers.csv",
    "validation/pilot_study/SET_A/PARTICIPANT_TASK.md",
    "validation/pilot_study/SET_B/records.csv", "validation/pilot_study/SET_B/entities.csv", "validation/pilot_study/SET_B/transfers.csv",
    "validation/pilot_study/SET_B/PARTICIPANT_TASK.md",
    "validation/STEP19_PROJECT_REPORT.md", "validation/STEP19_EVIDENCE_SUMMARY.md",
    "validation/STEP19_READINESS_AND_SCORECARD.md", "validation/STEP19_EXECUTION_REPORT.md",
    "lib/case-report.ts", "tests/e2e/case-report.spec.ts",
    "validation/REVIEWER_OUTREACH_CHECKLIST.md",
    "validation/STEP20_PROJECT_REPORT.md", "validation/STEP20_ABSTRACT.md",
    "validation/STEP20_EVIDENCE_SUMMARY.md", "validation/STEP20_DEMO_SCRIPT.md",
    "STEP20_BASELINE.md", "STEP20_PRIOR_ART_MATRIX.md", "STEP20_SCORECARD.md",
    "TEST_REPORT_STEP20.md",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run_check(name: str, argv: list[str]) -> dict:
    try:
        proc = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, timeout=180)
        combined = (proc.stdout + "\n" + proc.stderr).strip()
        lines = [line.strip() for line in combined.splitlines() if line.strip()]
        if name == "synthetic_evaluation":
            summary = next((line.strip() for line in lines if "expected-decision fixture accuracy" in line.lower()), "Evaluation completed; inspect full report")
        elif name == "synthetic_holdout":
            summary = next((line.strip() for line in lines if "expected-decision conformance" in line.lower()), "Holdout completed; inspect full report")
        else:
            summary = next((line.strip() for line in reversed(lines) if line.strip().startswith("Ran ")), lines[-1] if lines else "No output")
        return {"name": name, "command": argv, "status": "PASS" if proc.returncode == 0 else "FAIL", "exit_code": proc.returncode, "summary": summary, "output_tail": "\n".join(lines[-18:])}
    except subprocess.TimeoutExpired as exc:
        return {"name": name, "command": argv, "status": "FAIL", "exit_code": None, "summary": f"Timed out after {exc.timeout} seconds", "output_tail": ""}


def main() -> int:
    checks = []
    for name, argv in CHECKS:
        print(f"Running manifest check: {name}", flush=True)
        checks.append(run_check(name, argv))
        print(f"Finished manifest check: {name}: {checks[-1]['status']}", flush=True)
    hashes: dict[str, str] = {}
    missing = []
    for rel in INPUTS:
        path = ROOT / rel
        if path.is_file(): hashes[rel] = sha256(path)
        else: missing.append(rel)
    manifest = {
        "manifest_schema": "waterchain-reproducibility-manifest-v5",
        "project_step": 20,
        "scope": "Step 20 Python engine and synthetic-validation manifest only. The Node independent-review unit tests, TypeScript syntax parser, typecheck, lint, and production build run in the separate Next.js job after dependency installation; the overall GitHub Actions workflow is green only when both jobs pass. Comparative fixtures remain developer-authored synthetic cases. No external review or participant study is claimed.",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "FAIL" if any(row["status"] != "PASS" for row in checks) or missing else "PASS",
        "verified_checks_passed": all(row["status"] == "PASS" for row in checks) and not missing,
        "runtime": {"python_version": platform.python_version(), "implementation": platform.python_implementation(), "platform": platform.platform()},
        "checks": checks,
        "sha256_files": hashes,
        "missing_files": missing,
        "blocked_checks": [
            {"name": "frontend_quality_gates", "status": "SEPARATE_JOB", "reason": "Independent-review unit tests, TypeScript syntax parsing, typecheck, lint, and production build are executed in the separate Next.js GitHub Actions job; the overall workflow must pass both jobs."},
            {"name": "playwright_e2e_full_suite", "status": "SEPARATE", "reason": "Long-running browser suite (sequential, 1 worker on ~1 GB free RAM) is executed outside this manifest builder; see TEST_REPORT_STEP20.md §6 for the recorded result."},
            {"name": "live_supabase_migration", "status": "BLOCKED", "reason": "No test database available; the migration remains an unconnected reference."},
            {"name": "external_reviewer_response", "status": "NOT_RUN", "reason": "Blind-review handoff builds cleanly, but no reviewer has been contacted; outreach is the project owner's action."},
            {"name": "participant_user_study", "status": "NOT_RUN", "reason": "Protocol, task sets, and analysis tooling are prepared and verified on empty inputs; no participants recruited."},
        ],
        "limitations": [
            "Unit and evaluation checks use developer-authored synthetic fixtures and do not establish real-world diagnostic accuracy.",
            "The adapter regression suite uses synthetic fixtures for reproducibility. The real-data quality profile was supplied from a prior download/reprocessing run; raw source CSVs are not bundled and were not re-downloaded in Step 19.",
            "The optional Supabase/PostgreSQL migration is not connected to the current localStorage-based app and has not been applied to a live database.",
            "A SHA-256 digest detects content changes but does not authenticate the original source, author, lab, date, or scientific correctness.",
            "An independent WASH/laboratory-method review and real-world validation remain pending; no reviewer response or user-study data is included.",
            "This manifest does not execute the full Playwright end-to-end suite; its results must be read from the separate browser-test report and must not be inferred from this Python-only manifest.",
            "Risk and control records are stored separately in browser-local storage and exported separately from evidence backups; no live shared database is connected.",
            "Temporal observations are ordered by user-entered collection timestamps. Similar source/stage/analyte groups are not proof that samples came from the same physical sampling point.",
            "Action priority is deterministic and rule-based. It is not a calibrated risk score, cost estimate, or expected-information-gain measure.",
            "Temporal E2E tests are included in the project, but require Playwright dependencies and Chromium to execute.",
            "Risk severity/likelihood uses a transparent qualitative screening matrix that is not validated and must not replace an adopted local water-safety risk method.",
            "Control effectiveness snapshots detect edits/removal of selected evidence records; they do not authenticate source documents or reviewer identity.",
            "ActionLoop stores workflow state in browser-local storage; actor and verifier labels are self-entered and not authenticated.",
            "The ActionLoop source fingerprint flags changed review context but is not a digital signature or an immutable audit authority.",
            "Decision Sensitivity Studio performs selected single-record-omission analyses against the same deterministic rule engine; it is not a physical counterfactual, statistical robustness guarantee, probability, or causal proof.",
            "Decision Sensitivity Studio browser regressions require the full Next.js/Python/Playwright environment and are not run by this manifest builder.",
            "The blind reviewer workflow is a packet/import/comparison mechanism; no external review has occurred just because the feature exists.",
            "Reviewer-engine agreement and inter-reviewer agreement are descriptive. Neither is diagnostic accuracy without a defensible reference standard.",
            "The private comparison key and reviewer results remain in browser localStorage. They are not protected by authenticated access controls and can be lost or modified if the browser profile is cleared or tampered with.",
            "Review CSV imports are bound to a packet ID, validate record aliases, require a pseudonymous reviewer code, role, ISO date and rationale; this reduces accidental mismatch but is not cryptographic reviewer authentication.",
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Step 20 manifest: status={manifest['status']}; checks={len(checks)}; hashed={len(hashes)}; missing={len(missing)}")
    for row in checks: print(f"{row['status']}: {row['name']}: {row['summary']}")
    if missing: print("Missing files: " + ", ".join(missing))
    return 0 if manifest["verified_checks_passed"] and not missing else 1

if __name__ == "__main__":
    raise SystemExit(main())
