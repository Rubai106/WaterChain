# Water Quality Uganda adapter

WaterChain includes a local, read-only adapter for profiling the public **Water Quality Uganda** observational dataset. The adapter does not download data, upload it to WaterChain, modify the app's evidence register, or treat field-visit joins as causal ground truth.

- Dataset page: https://openwashdata.github.io/waterqualityuganda/
- Source repository: https://github.com/openwashdata/waterqualityuganda
- The dataset maintainers publish the data under a CC-BY licence; confirm the exact attribution/version terms on the source page when redistributing results.
- Suggested citation in the maintainer's dataset materials: Nansiimbi C, Clavijo Daza A (2026). *waterqualityuganda: Drinking Water Quality from Boreholes to Household Storage in Uganda.* https://github.com/openwashdata/waterqualityuganda

## Use the adapter

1. Download the CSV files from the official dataset page/repository. Do not download datasets from unofficial mirrors.
2. Keep the original files unchanged. The adapter records each input file's byte length and SHA-256 hash.
3. Run from the WaterChain project root:

```bash
python research/datasets/waterqualityuganda_adapter.py \
  --samples /path/to/samples.csv \
  --borehole-visits /path/to/borehole_visits.csv \
  --household-visits /path/to/household_visits.csv \
  --labblanks /path/to/labblanks.csv \
  --out research/output/waterqualityuganda-profile.json
```

On systems where the `python` command is unavailable, use `python3` instead. The adapter uses only Python's standard library.

## What it reports

- Input sizes, columns and SHA-256 file hashes.
- Counts by sample type and published match status.
- Observed E. coli count summaries, missing results, and rows marked `tntc` (too numerous to count), whose numeric codes must not be interpreted as exact CFU measurements.
- Sample-to-visit join audit (borehole visit, household visit, missing/ambiguous reference, duplicate visit keys, duplicate sample IDs, and sample-type/visit mismatch).
- Exact within-household-visit transport/storage descriptive pairs only when the visit key is unique, the source row has `match_status=matched`, sample IDs are unique, and exactly one measured sample of each type exists.
- Negative, unparseable, or non-finite measurements are reported/excluded from valid measured summaries rather than silently coerced. Rows marked `tntc` remain censored and aren't treated as exact counts.
- Laboratory blank summary and flags that require qualified review.

## What it deliberately does not claim

`visit_id` associates a sample with a visit record; it does not, by itself, prove a physical transfer from one sample to another. The dataset is observational. A descriptive difference between transport and storage samples is not a validated causal location of contamination, and this adapter does not produce a real-world accuracy score. `visit_id` is a field-visit association, not proof of a documented physical transfer or a unique entity path. The adapter does not construct a WaterChain journey, set entity IDs, or upload the data into the application. Ambiguous joins are reported, not silently repaired. The real dataset files have not been included in this ZIP; adapter test fixtures are synthetic.

## Tests

Run the synthetic, clearly labelled fixture tests from the project root:

```bash
python -m unittest discover -s research/datasets -p 'test_*.py' -v
```

`research/fixtures/` contains only tiny synthetic fixtures for the adapter's tests. The public research dataset itself is not included in the project ZIP.
