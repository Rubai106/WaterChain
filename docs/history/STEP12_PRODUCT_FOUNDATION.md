# Step 12 — Product and scientific foundation

## What changed

Step 12 adds an optional explicit water-journey relationship mode alongside the backward-compatible single-shared-batch mode. The model treats a sample bottle as a sampling event, rather than assuming the same physical bottle or batch ID continues through all four conceptual stages.

### Data model

- **Water source:** a source entity, with a distinct `sourceIdentifier` field mapped to the exact user-entered `waterSourceId` on evidence records. `sourceReference` remains a separate external document/reference field.
- **Water journey:** a named investigation path associated with one source and one local investigation.
- **Sampling event:** links one existing evidence record to one journey at a declared stage, with the sample-to-journey relationship basis and a field/visit reference.
- **Transfer event:** records an adjacent-stage transfer, its kind, time, evidence basis, reference and notes.
- **Provenance artifact:** records filename, size, SHA-256, review status and storage mode for a user-selected source file. The browser attempts to retain the original bytes in IndexedDB (up to 10 MB per file) and re-hashes/rechecks size before offering a download. If local storage fails, only fingerprint metadata is retained. Files are not uploaded or synced; clearing browser storage can remove the original.
- **Local audit ledger:** hash-linked local-browser events for journey relationship edits and source-record changes. This is tamper-evident assistance, not authenticated identity or a server-side audit system.

### Eligibility and attribution gates

A candidate transition in explicit-journey mode requires:

1. Eligible, reportable evidence at all four stages.
2. One sampling event per evidence record within the selected journey, with stage matching the source record.
3. A directly documented or associated-visit sample link with a non-empty real field/visit reference. Self-reported and unconfirmed links remain visible for review but are excluded from pathway hypotheses.
4. Direct transfer support for each adjacent stage pair. `documented` transfer basis requires a source reference; `observed` requires a reference or explanatory note. An unresolved alternative transfer on the same stage boundary is not masked by a stronger edge. These are user-entered attestations and are not independently authenticated.
5. A recorded source identifier that matches the water-source ID field on linked evidence records.
6. Chronology, result, QC, duplicate identity, stage coverage, and other existing engine gates.
7. Negative observations at all earlier stages to bracket a candidate transition. A positive result at Source is an observation with origin timing unresolved.

The old batch-based mode remains available if no explicit journey model is provided. The application must not invent or backfill a shared batch ID to satisfy a pathway rule.

## New explainable next-action planner

The rule-based planner proposes documentation, QC review, sampling or repeat-review actions from the actual blockers and evidence gaps. Each action explains what a possible positive/negative result could mean and records prerequisites. It does not invent prices, durations, probabilities, laboratory availability, or guaranteed information gain.

## Open dataset adapter

`research/datasets/waterqualityuganda_adapter.py` profiles user-downloaded source CSVs from https://openwashdata.github.io/waterqualityuganda/. It computes descriptive sample-type and within-visit paired summaries, flags ambiguous joins and laboratory-blank signals, and hashes original input files. It is independent of the production case register.

The published visit/sample relationship does not establish a unique physical water journey or causal entry point. The adapter is descriptive and must not be used to claim that the diagnostic engine has been validated on ground-truth causal labels.

## Provenance boundaries

A SHA-256 digest can identify a particular byte sequence and help detect later changes. It does not authenticate the source, person, lab, time, or correctness of the original document. Original bytes can be retained locally in IndexedDB, but they are not embedded in ledger exports or synced to other devices. WaterChain does not verify digital signatures or provide server-signed audit events.

## Deployment foundation (not activated)

An example Supabase/PostgreSQL schema with owner-scoped row-level security is provided under `supabase/migrations/`. It is an optional reference migration and is not connected to the current app. Current investigations, relationship models, audit ledger and report cache remain browser-local. No authentication, cloud sync, shared collaboration or multi-user access control is live.

## Novelty and claims

The potentially distinctive contribution is the integrated workflow: relationship-quality assessment, record eligibility, source-ID mapping, documented transfer support, abstention, and a reasoned next-action plan, with reproducible evidence bundles. Related concepts such as source tracing, water-quality monitoring, Bayesian risk assessment and adaptive sampling already exist. This project makes no global novelty, patentability, or independently validated accuracy claim. Those require a separate prior-art and scientific review.

## Remaining validation needed

- Install Node dependencies and run typecheck/lint/build in a connected environment.
- Execute real-browser regression tests for the new source mapping, sample-reference and transfer-reference requirements.
- Apply the optional database migration only in a disposable Supabase project and review policies before use.
- Profile the full, user-downloaded public dataset with its original citation and publish a reproducible report.
- Obtain independent WASH/laboratory-method review before any operational use.


## Step 12 — Relational journey foundation and provenance

Step 12 introduces an explicit relationship graph that complements the legacy batch-based mode:

- A **source** is a registered source entity with an identifier that must match evidence-record `waterSourceId` values.
- A **journey** groups related sampling events into an investigation question; it does not imply that separate sample bottles are physically identical.
- A **sampling event** links an evidence record to a stage and a physical water/container entity reference, with a relationship basis and a field/visit reference.
- A **transfer event** links explicit from/to entity references between adjacent conceptual stages. “Documented” edges require a source reference; “observed” edges require a reference or explanatory note. Self-reported and inferred edges remain visible but do not support attribution.
- A complete explicit path is resolved through exact entity references. Zero complete paths or two-or-more paths blocks candidate-transition attribution. The engine uses a bounded 0/1/2+ path result so adversarial route ledgers do not force enumeration of all possible paths.
- The relationship-quality assessment and next-action planner explain the missing linkage, source mapping, QC, sample, or review step. It invents no costs, probabilities, turnaround times, or guaranteed value-of-information claims.
- A local audit ledger chains relationship changes with hashes. It is a tamper-evident local aid, not authenticated identity, server-side logging, or a digital signature.
- Original files can be kept in this browser's IndexedDB vault, subject to browser storage limits. Before download the file is checked against its saved SHA-256 and size. If the vault is unavailable, WaterChain retains only fingerprint metadata and labels that state. The JSON relationship-ledger export does not embed file bytes.

This explicit journey mode is the recommended path for new investigations because it represents a real relationship between distinct sample bottles and physical entities. The legacy batch mode remains for compatibility, not because it is scientifically equivalent to the explicit graph model.

## Real-data adapter workflow

`research/datasets/waterqualityuganda_adapter.py` profiles CSVs downloaded by the user from the official Water Quality Uganda dataset. It provides hashed input provenance, join-quality audits, censored `tntc` handling, QC blank summaries, and exact within-visit transport/storage descriptive pairs. It refuses malformed extra CSV cells, ambiguous visit keys, duplicate sample IDs for pair summaries, non-matched joins, negative measurements and non-finite values. It does not claim that observational visit matches are physical transfer proof or causal ground truth.

Run adapter tests with `python -m unittest discover -s research/datasets -p "test_*.py" -v`. For real profiling, download the four original CSVs from https://openwashdata.github.io/waterqualityuganda/ and follow `research/datasets/README.md`. The real dataset files are deliberately not bundled. The adapter has been tested on synthetic schema fixtures, but the full public dataset has not been processed in this environment.



## Investigation workflow lifecycle

Each explicit journey also has a lightweight workflow state: `intake`, `sampling`, `evidence_review`, `assessment`, `follow_up`, or `closed`. The user can record a closeout/disposition note; a note is required to mark a journey administratively closed. Closure is not a water safety certification, and unresolved uncertainty remains part of the record. These lifecycle states currently live in browser-local storage and are not shared across users.
