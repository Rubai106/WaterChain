# Step 18 — Real-data quality report (Water Quality Uganda)

Reproducible adapter run against the **actual published files**, re-downloaded
2026-10-29. Machine-readable profile: `research/real-data-profile.json`
(regenerated in this pass from the fresh download). Source identification,
licence, and citation follow `RESEARCH_DATA_AUDIT.md` (Step 12); the files
below are the same published files, hashes unchanged.

## Provenance

- Source: https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/
  via the dataset page https://openwashdata.github.io/waterqualityuganda/
- Licence: **CC-BY**. Citation: Nansiimbi C, Clavijo Daza A (2026).
- Re-downloaded: 2026-10-29 (this audit). Hashes identical to the 2026-10-28
  record, confirming the published files have not changed.
- SHA-256:
  - samples.csv (3,203 rows, 377,144 bytes):
    `34d751276ce3530e1e5c870c2e857a8bd910ad459436fc1e22d2017e2525f5f5`
  - borehole_visits.csv (477 rows, 39,376 bytes):
    `5186e123cb8bcafb65cb8c4d5f42d740994ef4f6826edfc7881845f81c40e638`
  - household_visits.csv (1,118 rows, 147,754 bytes):
    `193b473cac478899efe9d558d0b7e880d3c5f34c9c13358f1efb412a68deb86b`
  - labblanks.csv (134 rows, 6,987 bytes):
    `594e80df9fee262f101116e052f145ac01cddd18d06fe6f4382d433b5e5799b6`

## Adapter outcome

- CLI exit 0, `status: profile_complete`; inputs unmodified (hashes identical
  before and after the run).
- Visit/sample joins: 508 borehole-visit, 2,236 household-visit, 459 samples
  with no visit_id (sums to 3,203).
- `match_status`: matched 2,187; **ambiguous key 278 — refused, never
  auto-linked**; no field record 295; no lab result 443.
- Duplicate sample/visit IDs: 0. Sample/visit date mismatches: 0.
- 843 exact measured transport/storage pairs (both_detected 105,
  censored_pair 562, neither 70, storage_only 48, transport_only 58);
  275 household visits unpaired/ambiguous.
- **Lab blanks: 9 of 134 positive (6.7%)** — flagged as a pilot caveat; the
  adapter does not auto-invalidate samples on this basis.

## Interpretation limits

- These are observational sample relationships. A shared `visit_id` is a
  relationship check, **not** a verified physical transfer and not causal
  ground truth about contamination origin.
- The dataset is used to test evidence handling (joins, ambiguity refusal,
  QC flagging, censored values), never to label sample correlations as the
  true contamination origin.
- E. coli detection shares are descriptive of this dataset only and are not
  generalized beyond it.
