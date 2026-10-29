# WaterChain Step 12 — Research Data Audit (Water Quality Uganda)

Independent audit of the adapter in `research/datasets/` against the
**actual published dataset**, not only synthetic fixtures. The adapter was
run from the command line exactly as documented; the full machine-readable
profile it produced is `research/real-data-profile.json` in this package.

## Source identification

- Dataset page (read directly):
  `https://openwashdata.github.io/waterqualityuganda/`
- Source repository: `https://github.com/openwashdata/waterqualityuganda`
  (branch `main`, folder `inst/extdata/`), via the dataset page's own
  download links:
  - `https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/samples.csv`
  - `https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/borehole_visits.csv`
  - `https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/household_visits.csv`
  - `https://github.com/openwashdata/waterqualityuganda/raw/main/inst/extdata/labblanks.csv`
- Downloaded: 2026-10-28 (browser session timestamps 17:51–17:53 UTC).
  Files preserved unchanged outside this package; hashes below were taken
  before and after the adapter run and are identical, so the adapter did
  not modify its inputs.
- Licence: **CC-BY** (dataset page, License section). Citation: Nansiimbi
  C, Clavijo Daza A (2026). *waterqualityuganda: Drinking Water Quality
  from Boreholes to Household Storage in Uganda.*
- Coverage: collected November 2024 – September 2025 by Whave Solutions
  Limited; 4 districts; published 2026-10-16.

## Files profiled (actual published files)

| File | Rows (excl. header) | Bytes | SHA-256 |
|---|---|---|---|
| samples.csv | 3,203 | 377,144 | `34d751276ce3530e1e5c870c2e857a8bd910ad459436fc1e22d2017e2525f5f5` |
| borehole_visits.csv | 477 | 39,376 | `5186e123cb8bcafb65cb8c4d5f42d740994ef4f6826edfc7881845f81c40e638` |
| household_visits.csv | 1,118 | 147,754 | `193b473cac478899efe9d558d0b7e880d3c5f34c9c13358f1efb412a68deb86b` |
| labblanks.csv | 134 | 6,987 | `594e80df9fee262f101116e052f145ac01cddd18d06fe6f4382d433b5e5799b6` |

Row counts match the dataset page exactly (3,203 / 477 / 1,118 / 134).
Adapter exit code 0, status `profile_complete`, 4 files profiled.

Reproduce with:

```bash
python3 research/datasets/waterqualityuganda_adapter.py \
  --samples <samples.csv> --borehole-visits <borehole_visits.csv> \
  --household-visits <household_visits.csv> --labblanks <labblanks.csv> \
  --out real-data-profile.json
```

## Join audit — ambiguous and unresolved (the headline numbers)

- Samples joined to a borehole visit: **508**. Joined to a household
  visit: **2,236**. Missing `visit_id` (no join possible): **459**.
  508 + 2,236 + 459 = 3,203.
- Dataset's own `match_status` on samples: matched **2,187**; ambiguous
  key **278**; no field record **295**; no lab result **443**.
- **Ambiguous joins: 278 samples** (8.7% of samples). The adapter never
  re-links these automatically; they are counted and excluded from
  pairing.
- **Unresolved joins: 459 samples with no `visit_id`** plus the 295
  "no field record" and 443 "no lab result" rows flagged by the dataset's
  own status. These categories overlap in definition (the dataset status
  and the adapter's join audit measure different things), so they are
  reported side by side, not summed into a single invented total.
- Duplicate visit IDs: **0** (borehole and household). Duplicate sample
  IDs: **0**.
- Sample-type / visit mismatches: **0**.
- Sample/visit **date mismatches (new D7 check): 0** on the real data —
  every sample joined to a unique visit agrees with its visit date.
- Bottle numbers restart daily and may repeat; the adapter retains the
  published `match_status` and does not use bottle number as a join key.

## Paired household transport/storage summary

Only rows explicitly marked `matched`, with unique sample IDs and unique
household visit IDs, are paired. **843 exact measured pairs.**

| Pair state | Pairs |
|---|---|
| Both transport and storage detected | 105 |
| Censored pair (at least one TNTC) | 562 |
| Neither detected | 70 |
| Storage only detected | 48 |
| Transport only detected | 58 |

- 275 household visits have samples but not exactly one measured
  transport and one measured storage sample (unpaired/ambiguous).
- Pair rows excluded by match status: ambiguous key 97, no lab result
  356. Non-matched rows are counted, never silently paired.

## E. coli summaries by sample type (descriptive only)

| Sample type | Rows | Measured | Missing result | Detected share of measured | TNTC (censored) rows | Median recorded CFU |
|---|---|---|---|---|---|---|
| Borehole | 477 | 380 | 97 | 73.9% (281) | 83 | 7.0 |
| Borehole duplicate | 31 | 24 | 7 | 70.8% (17) | 6 | 6.0 |
| Transport container | 1,118 | 898 | 220 | 81.2% (729) | 440 | 97.5 |
| Storage container | 1,118 | 885 | 233 | 81.8% (724) | 482 | 101.0 |
| No visit / unknown | 459 | 459 | 0 | 68.2% (313) | 143 | 13.0 |

- Invalid negative counts: **0** in every group. Unparseable non-missing
  results: **0**.
- TNTC is coded as `ecoli_cfu = 101` in the real data and is **censored**,
  not an exact count. The storage/transport medians (101.0 / 97.5) are
  artefacts of that censoring and must not be quoted as precise
  contamination levels. A few values above 101 exist as typed in the
  source and are preserved, not repaired.

## Laboratory blank QC — a real signal, handled honestly

- 134 blanks, all measured. **9 blanks (6.7%) are positive** for E. coli
  (CFU 1, 1, 1, 1, 1, 1, 2, 11, 12, 14 across Kaabong, Luuka, Nakaseke;
  full list in `research/real-data-profile.json`).
- The adapter reports this and does **not** automatically invalidate or
  repair any sample on the basis of a positive blank, because no approved
  linkage rule connects a specific blank to specific samples. Any pilot
  use of this dataset must carry this QC caveat: blank positivity is a
  lab-process signal requiring qualified review.

## What the dataset can and cannot support

**Can support:**
- Descriptive profiling of E. coli detection across borehole, transport,
  and storage stages, with censoring handled explicitly.
- Join-quality assessment (ambiguous/unresolved rates above) as a test of
  the adapter's refusal to invent links.
- Transport/storage pair-state comparison at household-visit level, with
  the 562 censored pairs flagged as imprecise.

**Cannot support:**
- Identifying a true contamination entry point. The dataset is
  observational; no independent reference method establishes ground-truth
  origins. The adapter's own warning states this, and no causal label was
  derived from it in this audit.
- Treating a `visit_id` join as a verified physical transfer between two
  water samples. A shared visit is a relationship check, not a documented
  transfer, and the WaterChain journey model must not ingest these joins
  as `directly_documented` transfers without additional evidence.
- Treating household-to-borehole `source_name`/district association as a
  uniquely verified water journey. It is contextual only.
- Any validated prediction or performance claim. All comparisons here are
  descriptive.

## Adapter edge behaviour (synthetic fixtures, beyond the supplied tests)

Verified in this pass: missing file raises (CLI exits 2 with an error
JSON); empty CSV fails with a clear header error; non-UTF-8 input fails
closed (UTF-8/UTF-8-SIG only); extra columns allowed; extra cells
rejected; duplicate visit/sample IDs excluded from pairing, never
overwritten; negative/non-finite counts reported, not used; 20,000
synthetic rows profile in ~0.8 s. Supplied adapter suite: 12/12 (11
supplied + 1 new D7 regression test).

## Verdict for Phase 6

**PASS on actual published files.** The adapter runs end to end on the
real dataset, preserves original rows and values, explains every
exclusion, refuses ambiguous joins, and reports the QC caveats above
instead of smoothing them away. The dataset's limits (no causal ground
truth, 8.7% ambiguous keys, 9 positive blanks, heavy TNTC censoring) are
properties of the data, not adapter defects, and are now documented
rather than hidden.
