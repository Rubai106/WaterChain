# WaterChain — one-page evidence summary (for judges)

## What is implemented and verified (fresh, this release)

| Capability | Evidence |
|---|---|
| Rule-based diagnostic engine with explicit abstention | 91/91 engine tests; synthetic eval 100% correct abstention, 0% unsupported attribution |
| Per-record eligibility + unresolved-evidence explanations | Engine emits `record_eligibility`; UI stage signals come only from the current report |
| Provenance vault + hash-linked audit ledger | 7/7 step12-audit browser tests (hash/size re-verification, tamper detection, export re-verify) |
| ActionLoop, Risk & Control Register, temporal planner | Browser tests green (3/3, 4/4, 6/6) |
| Evidence Sensitivity Studio (leave-one-out vs real API) | decision-robustness 3/3 in-browser; omission matrix correct |
| Fresh frontend verification | `npm ci` ✓, typecheck ✓, lint 0 errors ✓, production build ✓, adversarial API probes fail closed ✓ |
| Real-data evidence handling | Water Quality Uganda (3,203 samples, CC-BY, hashes verified): 278 ambiguous joins refused, 9/134 positive blanks flagged |

## What the numbers mean — and what they do not

- **Synthetic fixture conformance only.** The 13 comparison fixtures were authored with knowledge of the engine's rules; the naive baseline is deliberately weak. These numbers measure software discipline, not field accuracy, and do **not** compare WaterChain against human experts.
- **Observational data only.** The Uganda dataset profiles join quality; it establishes no causal ground truth.
- **Pending (prepared, not performed):** independent blind review (packet ready, invitation drafted), spreadsheet-vs-WaterChain user study (protocol + analysis tooling ready), field validation.

## Honest scope

- A decision aid for qualified investigators — **not** a water-safety certification, **not** proof of contamination origin.
- Browser-local storage: not a secure multi-user authority. Operational deployment: **not ready**.
- The engine's most important output is sometimes "I cannot conclude" — and that restraint is the point.
