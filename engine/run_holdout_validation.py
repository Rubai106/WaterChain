"""Run WaterChain's separate synthetic development holdout and write its report."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from holdout_validation import evaluate_holdout


def render_markdown(report: dict) -> str:
    lines = [
        "# WaterChain Step 6 — Development holdout and adversarial validation",
        "",
        "> **Synthetic software tests only. This is not independent or blinded validation and is not real-world performance evidence.**",
        "",
        f"Cases: **{report['scenario_count']}**",
        f"Expected-decision conformance: **{report['expected_decision_conformance']:.1%}**",
        f"Cases expected to abstain: **{report['abstention_cases']}**",
        f"Unsupported attributions in should-abstain cases: **{report['unsupported_attributions_in_abstention_cases']}**",
        "",
        "| Case | Expected stage | Prediction | Match? | Finding codes |",
        "|---|---|---|---|---|",
    ]
    for row in report["cases"]:
        expected = row["expected_stage"] or "ABSTAIN"
        prediction = row["prediction"] or "ABSTAIN"
        findings = ", ".join(row["finding_codes"]) or "—"
        lines.append(f"| `{row['case_id']}` | {expected} | {prediction} | {'yes' if row['matches_expected_decision'] else '**NO**'} | {findings} |")
    lines += ["", "## Interpretation limits", ""]
    lines.extend(f"- {limitation}" for limitation in report["limitations"])
    lines += ["", "Expected-decision conformance measures only agreement with the test cases' predeclared software-behavior expectations. It must not be described as diagnostic accuracy in the field.", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json-out", default="engine/holdout_report.json")
    parser.add_argument("--markdown-out", default="engine/holdout_report.md")
    args = parser.parse_args()
    report = evaluate_holdout()
    json_path, md_path = Path(args.json_out), Path(args.markdown_out)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(report), encoding="utf-8")
    print(f"Evaluated {report['scenario_count']} synthetic development-holdout cases.")
    print(f"Expected-decision conformance: {report['expected_decision_conformance']:.1%}")
    print(f"Unsupported attributions in should-abstain cases: {report['unsupported_attributions_in_abstention_cases']}/{report['abstention_cases']}")
    print(f"JSON report: {json_path}")
    print(f"Markdown report: {md_path}")
    return 0 if report["expected_decision_conformance"] == 1.0 else 1

if __name__ == "__main__":
    raise SystemExit(main())
