# WaterChain: evidence-first review of water-quality investigations

**Project report — 29 October 2026**

## Problem

Water-quality investigations may combine source, collection, transport, household-storage, and serving observations. A positive result is important evidence, but it does not by itself prove where contamination entered. Duplicate identifiers, inconsistent source labels, failed laboratory quality-control checks, discordant repeats, missing timestamps, or incomplete transfer documentation can make a plausible-looking pathway unreliable. In resource-constrained settings, unsupported conclusions can direct field follow-up toward the wrong point and waste limited sampling capacity.

## Approach

WaterChain is a local-first research prototype that organizes sample records and relationships between physical water/container entities. Its rule-based Python engine checks record eligibility, source identity, chronology, analyte/method scope, quality-control metadata, batch consistency, and explicit transfer relationships. It may return a **candidate transition interval** when the supported evidence meets its declared rules; otherwise, it abstains and exposes reasons and follow-up steps. The product includes evidence fingerprints, a hash-linked local audit ledger, original-file hash checking, omission/sensitivity checks, and a workflow for turning findings into traceable next actions.

The engine does not calculate a probability that a source caused contamination. A hash is not proof of authenticity, and a candidate transition is not proof of causation. WaterChain is intended to support qualified reviewers, not replace field teams, laboratories, regulations, or established water-safety plans.

## Implementation

The prototype uses Next.js and TypeScript for the interface, a Python rule engine behind a Next.js API route, and browser-local storage for investigations and report state. Its research adapter profiles a public Water Quality Uganda observational dataset without importing it as known causal truth. The current application does not have connected multi-user authentication or an authoritative shared backend; the proposed Supabase migration is not wired into the application.

## Software evaluation

A Step 18 comparison exercised 13 developer-authored synthetic fixtures designed around clean transitions, duplicate IDs, discordant repeats, invalid numeric values, missing timestamps, unsupported analytes, source-identity conflicts, failed QC, and omission variants. Under the author-prewritten rubric, WaterChain matched all 13 expected outcomes, abstained in all 9 cases expected to require abstention, and made no unsupported attribution in those 9 cases. A deliberately naive “first positive wins” baseline made unsupported attributions in 8 of those 9 cases (88.9%). The six-check follow-up recommendation rubric passed on the fixture set.

These are **fixture-conformance results, not accuracy measurements**. The author knew the engine rules when constructing the cases, and the baseline intentionally ignores lineage, QC, method, timestamps, duplicates, and conflicting repeats. It is a weak demonstration of why a naive rule is risky, not proof that WaterChain outperforms experienced investigators or a structured spreadsheet workflow.

The public observational dataset profile covers 3,203 sample records and reports 843 paired transport/storage observations. The adapter refused 278 ambiguous joins and flagged 9 of 134 positive laboratory blanks for review. These are descriptive data-quality signals only; they do not label a causal contamination stage.

For Step 19, 91 engine tests, 12 dataset-adapter tests, and 8 new validation-tool tests were rerun successfully. A separate Step 18 verification report documents a prior production build and 65/65 Playwright tests run sequentially across 12 specifications. Attempting to install frontend dependencies in the current Step 19 environment timed out, so those frontend checks were not re-executed here.

## Independent and user evaluation

A 13-case blind reviewer packet omits expected decisions and includes per-case record hashes. A reviewer-only handoff archive has been prepared, along with a protocol and tool to score a frozen response against the developer-prewritten rubric. No external reviewer response has been received. A counterbalanced spreadsheet-versus-WaterChain formative pilot is also prepared with two isomorphic synthetic task sets, capture forms, and descriptive paired analysis. No participants have been recruited and no user-study results exist.

## Limitations and next steps

WaterChain has not undergone field, laboratory, or real-world diagnostic validation. Browser-local data is not a secure multi-user authority. Production authentication, authorization, shared storage, operational governance, and deployment hardening remain incomplete. Before any effectiveness claim, the next steps are to obtain an independent domain review, preserve and analyze reviewer disagreements, run the formative paired workflow study with consented participants, and complete a fresh-browser demo rehearsal. Any negative or null result must be reported, not hidden.

## SDG 6 relevance

WaterChain is aligned with SDG 6 because it aims to strengthen evidence discipline in drinking-water investigations. By making uncertainty and missing documentation explicit, it may help qualified teams choose more defensible follow-up actions. No improvement in health outcomes, contamination rates, investigation time, or costs has been measured; impact remains a hypothesis for future evaluation.
