# WaterChain — evidence-first water-quality investigation (project report)

## 1. Problem and intended users

In low-resource drinking-water programs, field teams sample at several
points — source, collection/transport, household storage, serving — and must
decide where contamination most plausibly entered. Investigators typically
work from spreadsheets, where a single positive result can be mistaken for
proof of origin, failed laboratory QC can go unnoticed, unrelated batches
get mixed into one story, and missing transfer records are papered over. The
dominant failure mode is not slowness but **unsupported conclusions**: acting
on a contamination pathway the evidence does not actually support wastes
scarce field resources and misdirects remediation. WaterChain is built for
the qualified reviewers and field supervisors who triage such lab results.

## 2. Existing alternatives and the gap

Water-quality data infrastructure exists: EPA's WQX/WQP standardizes
submission and public sharing of monitoring data; mWater provides
offline-first field collection and water-point mapping for 390,000+ users;
LIMS products (CloudLIMS, Matrix Neptune, Clearline) maintain per-bottle
chain-of-custody and analytical QC; WHO Water Safety Plans and sanitary
inspections (9–12 yes/no risk questions) structure the human review. None of
these documents the specific step WaterChain addresses: deciding whether a
handful of already-produced results *jointly support* a contamination-transition
claim. WQX archives results without judging their sufficiency; LIMS custody
ends at the laboratory door; WHO checklists are interpreted by hand — and
published studies show mixed correlation between sanitary scores and measured
quality. The gap is a reviewer-facing, testable discipline for the
interpretive step that today happens informally in a spreadsheet.

## 3. Approach and technical implementation

WaterChain is a local-first investigation workspace (Next.js 15, TypeScript,
Python stdlib-only engine, browser-local storage; runs offline on commodity
hardware). The investigator registers sources, sampling events, water/container
entities, and documented transfers, imports records with method, QC,
timestamp, and batch metadata, then runs a transparent rule-based engine via
the app's API. The engine either names a **candidate transition interval**
(earliest positive bracketed by earlier negatives) or explicitly **abstains**.
A 15+-rule eligibility gate, structural gates (single lineage, no duplicates,
no discordance, chronological consistency), and wording constraints (no
probabilities, no causal claims) guard every inference. Abstention is
first-class: duplicate IDs, source-identity conflicts, discordant repeats,
failed QC, missing timestamps, or broken lineage withhold attribution with a
named reason. Every report carries a SHA-256 evidence fingerprint and
per-record eligibility reasoning; a provenance vault re-hashes original
files; a hash-linked audit ledger, ActionLoop, Risk & Control Register,
temporal planner, Evidence Sensitivity Studio (leave-one-out
decision-dependence checks against the real engine), blind-review workbench,
and a human-readable case-report export complete the workflow. Fresh
verification on this release: `npm ci`, typecheck, lint (0 errors), and
production build all pass; engine 91/91, adapter 12/12, review tooling 8/8,
synthetic evaluation 100% conformance / 100% correct abstention / 0%
unsupported attribution; browser→API→Python exercised through Playwright and
direct adversarial probes (malformed input, oversize, non-finite values fail
closed; no evidence leaked to server logs).

## 4. Comparison method and measured results

We compared the engine against a documented **naive first-positive baseline**
on 13 adversarial synthetic fixtures (duplicates, discordant repeats,
omission variants, NaN, missing timestamps, unsupported analytes, unrelated
sources, failed QC, all-positive/all-negative), with expectations fixed at
authoring time: WaterChain made **0 unsupported attributions** in the 9
abstain-required cases, abstained correctly in all 9, attributed the correct
stage in all 4 attributable cases, and excluded 100% of pre-marked ineligible
records; the baseline made unsupported attributions in 8/9 (88.9%). The same
scenarios run through the live API agreed with in-process results. These are
**fixture-conformance** results — the fixtures were authored with knowledge
of the rules, so high conformance is expected by construction, and the naive
baseline is deliberately weak (it is *not* a comparison against competent
human investigators; a structured spreadsheet-vs-WaterChain user protocol is
prepared but no participants have been recruited). The published Water
Quality Uganda dataset (3,203 samples, CC-BY, hashes verified) was profiled
to stress evidence handling — 278 ambiguous joins refused, 9/134 positive
blanks flagged — but used only descriptively, never as causal ground truth.

## 5. SDG 6 contribution and honest scope

WaterChain supports **SDG 6 — clean water and sanitation**, specifically
Target 6.3 ("By 2030, improve water quality by reducing pollution…") and the
drinking-water access agenda of Target 6.1, by strengthening evidence
discipline in contamination investigations: helping low-resource programs
distinguish a supported pathway hypothesis from a hunch, so remediation is
directed by traceable evidence. Its offline design fits the settings where
the need is greatest. The contribution is *potential, not measured*: no field
evaluation exists, and we claim no reduction in pollution, no proven
contamination causes, and no water-safety certification. Independent blind
review and user evaluation remain pending; storage is browser-local (not a
multi-user authority); operational deployment is not ready. In public-health
tooling, a system that reliably says "I cannot conclude" is safer than one
that always has an answer — and that restraint is this project's core claim.

---
*Prepared 2026-10-29 for BCS ICT Fest Project Showcasing. Every figure names
its source; all decision results are synthetic unless stated. Nothing here
claims field validation, real-world accuracy, or operational readiness.*
