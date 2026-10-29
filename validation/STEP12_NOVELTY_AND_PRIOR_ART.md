# Step 12 — Novelty hypothesis and prior-art boundaries

## Executive view

WaterChain Step 12 introduces a concrete integrated workflow hypothesis, not a claim of globally unique or patentable technology:

> Evaluate whether water-quality evidence can be connected into one defensible candidate journey by separating sample bottles from physical water/container entities, recording explicit transfer relationships and provenance references, applying record-level eligibility gates, abstaining when the route is missing or ambiguous, and recommending the next evidence-resolution action.

The potentially distinctive part is the integration and practical workflow. None of the individual concepts—water-quality monitoring, contamination-source localization, sampling optimization, provenance, evidence-quality checks, or abstention—is claimed as new by itself.

## Why the rigid batch model was replaced for new investigations

The public Water Quality Uganda dataset describes four tables: borehole visits, household visits, sample bottles, and lab blanks. Samples point to a `visit_id`; that relationship helps associate a bottle with a field visit but does not itself establish a physical transfer from a source sample to a transport-container sample and then a storage-container sample. The dataset documentation reports 3,203 sample records, 477 borehole visits and 1,118 household visits across four Ugandan districts and describes monthly monitoring from November 2024 to September 2025. Source: https://openwashdata.github.io/waterqualityuganda/ (accessed 2026-10-28).

Therefore, this adapter is intentionally descriptive. It audits joins and profiles observations; it does not turn visit matches into causal ground truth or secretly import rows into the app's live register.

## Relevant prior art and adjacent practice

1. **WHO risk management:** WHO's Guidelines for Drinking-water Quality (fourth edition with the first, second and third addenda; 17 June 2026) promote risk management from catchment to consumer, health-based targets and independent surveillance. Source: https://www.who.int/publications/i/item/9789240121225. WaterChain should align with, not claim to replace, established Water Safety Plans or regulatory surveillance.
2. **Water contamination source localization and dynamic sampling:** US patent 11,029,300 describes contamination detection/source-related workflows for liquid/water distribution systems, while CN114459810B describes dynamic optimized sampling to locate pollution sources in water-supply networks. Sources: https://patents.justia.com/patent/11029300 and https://patents.google.com/patent/CN114459810B/en. This makes broad claims that “AI sample selection” or “water contamination localization” is entirely new indefensible without a much broader, qualified prior-art search.
3. **Existing field monitoring datasets/tools:** water-safety monitoring, sample/visit joins, laboratory blanks, chain-of-custody, source mapping and household-handling analysis are all established practices. WaterChain should not present a checklist or hash field alone as an invention.

This short review is a product-design prior-art scan, not a legal opinion, a complete patent search, or freedom-to-operate analysis.

## Step 12 technical contributions implemented

- A typed model distinguishes source, investigation journey, sample event, water/container entity, adjacent transfer, provenance artifact and local audit event.
- Explicit sample-to-journey relationships require a relationship basis, reference, and water/container entity reference for qualifying links.
- Transfers connect exact from/to entity identifiers. A documented edge requires a reference; an observed edge requires a reference or note. Self-reported and unverified edges cannot independently support transition attribution.
- The selected source identifier is reconciled against `waterSourceId` values on the journey's linked records.
- A bounded route resolver returns zero, one, or two-or-more paths. It stops at the second distinct complete path so ambiguous branches are not combined and path enumeration cannot blow up with a transfer-ledger combinatorial explosion.
- A reasoned planner separates documentary repair from physical sampling/repeat actions and explains what positive/negative results would and would not establish. It does not invent expected-information gain, prices, or turnaround times.
- A browser-local IndexedDB file vault can retain an original artifact when available, then re-hashes and checks its byte length before download. If browser storage fails only fingerprint metadata remains. The hash is not proof of authenticity.
- A separate CSV adapter profiles a public observational dataset, with source file hashes, duplicate and ambiguous join handling, censored `tntc` interpretation and QC-blank signals. The dataset itself is not bundled.

## What has not been established

- Global novelty, patentability, or freedom to operate.
- Superiority over current field/lab workflows.
- Real-world sensitivity, specificity, calibration, diagnostic accuracy, or reduction in sampling cost/time.
- A causal source label from observational paired samples alone.
- Secure multi-user deployment. The application remains browser-local; the Supabase schema is only a reference migration and is not wired into the app.
- That the official full Water Quality Uganda data have been processed in this environment. Adapter tests use clearly synthetic fixture CSVs; the real CSVs must be downloaded by the user and profiled separately.

## Validation needed before stronger novelty or performance claims

1. External WASH and laboratory-method review of the data model and interpretation rules.
2. Independent blinded review of relationship quality and expected abstention on cases not authored by the implementers.
3. Use of the public dataset only for descriptive/pairing and data-quality robustness tests unless defensible causal labels are available.
4. Controlled scenarios with known sample-transfer ground truth to test relationship reconstruction and ambiguity handling.
5. Compare against a realistic spreadsheet/manual-investigation baseline, measuring investigator time, metadata errors caught, unsupported conclusions avoided and action usefulness.
6. If an IP claim is contemplated, engage a qualified patent professional for a targeted patent/product and legal-scope review.
