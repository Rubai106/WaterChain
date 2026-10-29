#!/usr/bin/env python3
"""Build participant-only synthetic task kits for Set A and Set B."""
from __future__ import annotations
import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "validation" / "pilot_study"
INCLUDE = ["PARTICIPANT_TASK.md", "records.csv", "entities.csv", "transfers.csv"]

def build(set_name: str, out_path: Path) -> None:
    src = BASE / f"SET_{set_name}"
    missing = [name for name in INCLUDE if not (src / name).is_file()]
    if missing:
        raise ValueError(f"SET_{set_name} missing files: {', '.join(missing)}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(out_path, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name in INCLUDE:
            archive.write(src / name, f"SET_{set_name}/{name}")
    with ZipFile(out_path) as archive:
        names = archive.namelist()
        if any("ANSWER_KEY" in name.upper() or "ASSIGNMENT_MATRIX" in name.upper() for name in names):
            raise ValueError("Participant kit contains facilitator-only content")
    print(f"Created participant-only Set {set_name} kit: {out_path}")

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=ROOT.parent.parent)
    args = parser.parse_args()
    build("A", args.out_dir / "WaterChain_Step19_Pilot_Task_Set_A.zip")
    build("B", args.out_dir / "WaterChain_Step19_Pilot_Task_Set_B.zip")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
