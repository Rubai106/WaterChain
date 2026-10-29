# WaterChain — Project Report (draft, two pages)

## 1. Problem

In low-resource drinking-water programs, field teams collect samples at
several points — source, collection/transport, household storage, serving —
and must decide where contamination most plausibly entered. In practice,
investigators work from spreadsheets where a single positive result can be
mistaken for proof of origin, failed laboratory QC can go unnoticed,
unrelated batches get mixed into one story, and missing transfer records are
papered over. The failure mode is not slowness but **unsupported conclusions**:
acting on a contamination pathway that the evidence does not actually
support wastes limited field resources and can misdirect remediation.

## 2. Approach

WaterChain is a local-first, evidence-driven investigation workspace. An
investigator registers sources, sampling events, water/container entities,
and documented transfers; imports sample records with method, QC, timestamp,
and batch metadata; and runs a transparent rule-based diagnostic engine
(Python, called from a Next.js API) that either names a **candidate
transition interval** — the earliest stage where a positive is bracketed by
earlier negatives — or explicitly **abstains**. Abstention is a first-class
outcome: duplicate identifiers, conflicting source identities, discordant
repeat results, failed QC, missing timestamps, or broken batch lineage all
withhold attribution rather than producing a best guess. Every report carries
a SHA-256 evidence fingerprint, per-record eligibility reasoning, and a
hash-linked audit ledger; a provenance vault stores original files with
re-hash verification; an ActionLoop, a Risk & Control Register, a temporal
planner, and an Evidence Sensitivity Studio (leave-one-out decision-dependence
checks against the real engine) complete the workflow.

## 3. Technical contribution

The contribution is a conservative decision policy engineered as software,
not a black-box model: (i) an explicit eligibility gate over 15+ metadata
rules before any inference; (ii) structural gates (single shared lineage, no
duplicates, no discordance, chronological consistency) that must all hold
before a candidate transition can be named; (iii) wording constraints — the
engine never emits probabilities, causal claims, or the word "robust" for a
conclusion; (iv) tamper-evident audit and fingerprint machinery that makes
stale or altered evidence detectable; (v) a documented naive baseline and a
blinded independent-review instrument so the conservatism can be challenged
by others. The full stack (Next.js 15, TypeScript, Python stdlib-only engine,
IndexedDB/localStorage) runs offline on commodity hardware.

## 4. Comparison method

We compared the engine against a documented **naive first-positive baseline**
(earliest raw positive, no abstention logic) on 13 adversarial synthetic
fixtures authored for this evaluation: clean transitions, duplicate record
identifiers, discordant repeats, omission-sensitivity/stability variants,
NaN numerics, missing timestamps, unsupported analytes, unrelated source
identities, failed QC, all-positive and all-negative patterns. Expected
decisions were fixed at authoring time from the documented rules. We measured
unsupported-attribution rate, correct-abstention rate, attribution
correctness, invalid-evidence detection via the eligibility gate, and a
six-check recommendation-quality rubric for the next-action planner. The same
comparison was executed both in-process and through the real
browser → API → Python endpoint to confirm parity. A separate 13-case blind
reviewer packet (expected decisions withheld, per-case SHA-256 hashes) is
prepared for independent review; no external review has yet occurred.

## 5. Observed results

On the 13 fixtures: WaterChain named **0 unsupported attributions** in the 9
abstain-required cases, abstained correctly in all 9, attributed the correct
stage in all 4 attributable cases, and excluded 100% of records pre-marked
ineligible. The naive baseline named unsupported attributions in 88.9% of
abstain-required cases. Omission checks behaved as designed (removing the
pivotal positive changed the decision; removing a redundant one preserved
it), and the recommendation rubric passed 100% of checks with no invented
probabilities or origin assertions. Identical results were observed through
the live API path. The real-data adapter processed the published Water
Quality Uganda dataset (3,203 samples, CC-BY) with 843 paired
transport/storage observations, refusing 278 ambiguous joins and flagging 9
of 134 positive lab blanks — used only to test evidence handling, never as
causal ground truth.

## 6. Limitations

All decision results are on **synthetic fixtures**; they measure fixture
conformance, not field accuracy. The fixtures were authored with knowledge of
the engine's rules, so high conformance is expected by construction. No
external reviewer has completed the blind protocol; no user study has been
run (protocol prepared, validation pending); no field deployment or
operational evaluation exists. Storage is browser-local (not multi-user
authority), the Supabase migration is unconnected, and effectiveness claims
for any control require independent review. These are prototype results that
support further evaluation, not deployment claims.

## 7. SDG 6 contribution

WaterChain supports **SDG 6 (clean water and sanitation)** by strengthening
the evidence discipline behind contamination investigations: helping
low-resource programs distinguish a supported pathway hypothesis from a
hunch, so scarce remediation effort is directed by traceable evidence rather
than by the loudest positive result. Its offline, commodity-hardware design
fits the settings where the need is greatest. The honest scope — a decision
aid for qualified investigators, not a diagnostic authority — is itself part
of the contribution: in public-health tooling, a system that reliably says
"I cannot conclude" is safer than one that always has an answer.

---
*Draft prepared 2026-10-29 for BCS ICT Fest Project Showcasing. All figures
refer to synthetic fixtures unless stated; nothing here claims field
validation, real-world accuracy, or operational readiness.*
