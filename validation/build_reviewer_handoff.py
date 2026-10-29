#!/usr/bin/env python3
"""Build the minimized reviewer handoff archive without answer-key leakage."""
from __future__ import annotations
import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    (ROOT / "validation/reviewer_packet_step18.json", "reviewer_packet_step18.json"),
    (ROOT / "validation/EXTERNAL_REVIEW_PROTOCOL_STEP19.md", "REVIEW_PROTOCOL.md"),
    (ROOT / "validation/reviewer_response_template.csv", "reviewer_response_template.csv"),
    (ROOT / "validation/INDEPENDENT_REVIEW_INVITATION.md", "INVITATION.md"),
]

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=ROOT.parent.parent / "WaterChain_Step19_Blind_Reviewer_Packet.zip")
    args = p.parse_args()
    missing = [str(src) for src, _ in FILES if not src.is_file()]
    if missing:
        raise SystemExit("Missing handoff inputs: " + ", ".join(missing))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.out, "w", compression=ZIP_DEFLATED, compresslevel=9) as zf:
        for src, arcname in FILES:
            zf.write(src, arcname)
    with ZipFile(args.out) as zf:
        names = set(zf.namelist())
        forbidden_tokens = ("engine/", "expected_decision", "answer_key", "step18_comparison_report", "score_independent_review.py")
        leak = [name for name in names if any(token in name for token in forbidden_tokens)]
        if leak:
            raise SystemExit("Reviewer handoff unexpectedly includes forbidden files: " + ", ".join(leak))
        # Content-level check: the packet must not carry expected decisions or
        # facilitator keys in any field, however named.
        packet_text = zf.read("reviewer_packet_step18.json").decode("utf-8")
        content_leak = [token for token in ("expected_decision", "facilitator_key", "answer_key") if token in packet_text]
        if content_leak:
            raise SystemExit("Reviewer packet contains forbidden content: " + ", ".join(content_leak))
    print(f"Created {args.out} with {len(FILES)} reviewer-only files.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
