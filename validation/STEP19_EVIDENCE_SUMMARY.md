# WaterChain — evidence and limitations summary

**Assessment date: 29 October 2026**

WaterChain is a local-first research prototype for organizing water-quality sample evidence and checking whether identity, timing, laboratory QC, analyte/method, and documented-transfer relationships are sufficient to discuss a **candidate contamination transition**. Its rule-based engine is designed to abstain where evidence is missing, duplicated, discordant, out of scope, or inconsistent. It is a decision-support prototype for qualified review, not a water-safety certification system.

## What is implemented

The application combines sample/visit records, explicit water/container entities and transfers, per-record eligibility reasoning, a conservative Python rule engine called by a Next.js API, evidence fingerprints and an audit ledger, a browser-local original-file vault, decision-sensitivity checks, and traceable follow-up actions. The existing Step 18 source package includes automated tests for the engine, dataset adapter, reviewer workflow, and browser features.

## What has been measured

- **Synthetic software comparison:** 13 developer-authored adversarial fixtures. WaterChain matched all 13 developer-prewritten expected decisions, abstained on all 9 cases whose expected outcome was abstention, and made 0 unsupported attributions on those 9 cases. A deliberately naive first-positive baseline made an unsupported attribution in 8 of the 9 abstention-required cases (88.9%). The comparison fixtures were authored with knowledge of the rules and are not real-world accuracy; the baseline is intentionally weak and is not a fair substitute for an expert or a structured spreadsheet workflow.
- **Guardrails:** the eligibility gate excluded all records marked as ineligible in the fixture rubric; omission tests behaved as prewritten; a six-check recommendation rubric passed on those cases. These measure conformance to the author rubric, not product effectiveness.
- **Public observational data profile:** the Water Quality Uganda adapter reports 3,203 records, 843 paired transport/storage observations, 278 ambiguous joins refused, and 9 of 134 positive laboratory blanks flagged for review. This is a data-quality profile, not causal ground truth or field performance.
- **Software tests rerun for Step 19:** 91/91 engine tests, 12/12 dataset-adapter tests, and 8/8 Step 19 validation-tool tests passed in this environment. A separate Step 18 report describes 65/65 Playwright tests run sequentially against a production build. Re-installing frontend dependencies in this Step 19 environment timed out; the frontend test suite was therefore not rerun here.

## What remains unvalidated

No independent expert review has been completed. The 13-case blind reviewer packet is prepared, but no external reviewer response is included. No human participant has used WaterChain in a controlled comparison; the study protocol, two isomorphic synthetic tasks, planned balanced assignment matrix, response forms, and paired descriptive analysis tool are prepared only. No field validation or operational water-safety evaluation has been performed.

## Risks and deployment boundary

Investigation data and review materials are browser-local; multi-user authentication and authorization, a connected authoritative backend, production access controls, and operational data-governance controls are not ready. Hashes can detect changes relative to a known fingerprint but do not prove that a document is authentic or true. Observational sample pairing does not establish causality. WaterChain must not be used alone to make operational drinking-water decisions.

## Contribution to SDG 6

WaterChain's potential contribution to SDG 6 is improving the traceability and caution of evidence review in drinking-water investigations: it makes gaps and unresolved identities visible and lets the system say “the evidence is insufficient.” This is a plausible contribution pathway, not a measured impact result.
