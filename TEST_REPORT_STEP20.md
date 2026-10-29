# TEST_REPORT_STEP20.md — WaterChain Step 20 verification

**Date:** 2026-10-29
**Input:** `WaterChain_Step19_Validation_Ready.zip` (md5 `e9eebbe8c8bc5a1fd5af82b3a1c00a37`)
**Environment:** Ubuntu 24.04.5 LTS, Node v24.22.1, npm 10.9.4, Python 3.12.3, ~1 GB free RAM.
**Convention:** PASS = executed and passed; FAIL = executed and failed; BLOCKED = could not execute with reason; NOT TESTED = not attempted. No historical result is substituted for a fresh execution.

## 1. Toolchain (fresh, this environment)

| Check | Status | Detail |
|---|---|---|
| `npm ci` (supplied lockfile) | **PASS** | exit 0, 387 packages, 48 s. Closes the Step 19 BLOCKED item. |
| Typecheck (`npx tsc --noEmit`) | **PASS** | exit 0, no errors. |
| Lint (`npx eslint .`) | **PASS** | 0 errors, 2 pre-existing `react-hooks/exhaustive-deps` warnings (page.tsx:142, TemporalEvidenceWorkbench.tsx:61) — intentional, documented; fixing would clobber user UI state. |
| Production build (`npm run build`) | **PASS** | exit 0; `/` 106 kB, First Load JS 209 kB. |

`package.json`/`package-lock.json` byte-identical to the supplied ZIP (no dependency added/removed/bumped). npm scripts use bare `python` (absent here); suites were run with `python3` equivalents — scripts unchanged, documented precedent.

## 2. Python suites (fresh)

| Suite | Status | Detail |
|---|---|---|
| Engine (`-s engine -p 'test_*.py'`) | **PASS** | 91/91 |
| Dataset adapter (`-s research/datasets`) | **PASS** | 12/12 |
| Step 19 validation tools (`-s validation`) | **PASS** | 8/8 |
| Independent-review Node tests | **PASS** | `node --test tests/unit/independent-review.test.cjs`: 12/12 |
| Synthetic evaluation (`engine/evaluate.py`) | **PASS** | WaterChain 100% expected-decision conformance / 100% correct abstention / **0.0%** unsupported attribution. Naive first-positive baseline: 26.7% accuracy, 8.3% correct abstention, **91.7%** unsupported attribution (full eval set — distinct from the 88.9% = 8/9 on the 13-case Step 18 comparison subset; do not conflate). |
| Synthetic holdout (`engine/run_holdout_validation.py`) | **PASS** | 16/16 expected decisions; 0/13 unsupported attributions. |

No engine decision rule was changed in Step 20.

## 3. Comparative evaluation (fresh)

| Check | Status | Detail |
|---|---|---|
| `step18_compare.py` in-process | **PASS** | 13/13 scenarios match expected: WaterChain 0.0% unsupported attribution, 100% correct abstention, 100% attribution correctness (4/4 should-attribute), 100% invalid-evidence detection, recommendation rubric 100%; baseline 88.9% unsupported attribution, 38.5% conformance. `via_api: False`; disclosure block present. |
| `step18_compare.py --api http://localhost:3107` | **PASS** | **12/12 JSON-carryable scenarios match** through the real `/api/diagnose` endpoint (NaN scenario correctly skipped in API mode — not expressible in JSON; covered in-process). First fresh API-parity run on this tree. |
| Omission sensitivity | **PASS** | `cmp18-omission-sensitive`: omitting pivotal record changes decision (as expected); `cmp18-omission-stable`: redundant omission preserves it (as expected). |

**Limits (must accompany any citation):** 13 developer-authored fixtures; engine tuned on earlier fixtures; naive baseline deliberately weak — NOT a comparison against human experts or spreadsheet workflows. Fixture conformance, not real-world accuracy.

## 4. API integration probes (fresh, against production build on :3107)

| Probe | Status | Result |
|---|---|---|
| Valid bracketed pathway (4 stages, SRC-1/B-1) | **PASS** | 200, "candidate transition only", `attribution_permitted: true`, `evidenceSha256` present, `journeySha256: null` |
| No positives | **PASS** | 200, "insufficient evidence" (abstains) |
| Empty records | **PASS** | 200, "not assessed" |
| Invalid JSON | **PASS** | 400 + requestId |
| Schema violation | **PASS** | 400 + per-field details |
| Raw `NaN` in JSON | **PASS** | 400 (fails closed; JSON spec forbids non-finite) |
| 501 records | **PASS** | 400 (limit enforced) |
| >2 MiB body | **PASS** | 413 |
| GET on endpoint | **PASS** | 405 |
| Unknown extra fields | **PASS** | tolerated (zod strips) |
| Evidence SHA-256 order stability | **PASS** | identical digest for reordered records |
| Server-log evidence leakage | **PASS** | grep over server log after probes: **0 evidence strings** |

## 5. Real-data workflow (fresh)

| Check | Status | Detail |
|---|---|---|
| Source-file provenance | **PASS** | Reused `~/workspace/waterchain-step12/real-data/*.csv`; all four SHA-256 hashes identical to the Step 12 record (samples `34d75127…`, borehole `5186e123…`, household `193b473c…`, blanks `594e80df…`). Licence CC-BY, Nansiimbi & Clavijo Daza (2026), openwashdata.github.io/waterqualityuganda. |
| Adapter run | **PASS** | exit 0, `profile_complete`: 3,203 samples, 477 borehole visits, 1,118 household visits, 134 blanks; 278 ambiguous joins refused (never auto-linked); 0 duplicate IDs; 0 date mismatches; 9/134 blanks positive (flagged caveat); 843 exact measured transport/storage pairs. Profile regenerated to `research/real-data-profile.json`. |
| Reviewer packet integrity | **PASS** | `reviewer_packet.json` (16 cases) + `reviewer_packet_step18.json` (13 cases): all per-case SHA-256 verified with the builder's canonicalization; no expected-decision/facilitator-key leakage in packet text. |
| Scoring tools on empty inputs | **PASS** | `score_independent_review.py` → INCOMPLETE_OR_INVALID (0/13); `analyze_user_evaluation.py` → NO_PARTICIPANT_DATA (0 rows). No fabricated responses. |

**Limits:** observational data only; joins are relationship checks, not verified physical transfers; no causal ground truth. External review pending; no participants recruited.

## 6. Playwright E2E (production build, sequential, 1 worker)

| Run | Status | Detail |
|---|---|---|
| Full suite on the supplied tree (pre-Step-20-change build) | **PASS** | **65/65, 0 failures, 0 retries, in a single uninterrupted run** (24.0 min). This is better than the Step 18 composed figure: one clean pass on this machine. Specs: independent-validation 4, decision-robustness 3, workflows 9, pathway 8, action-loop 3, risk-control-register 4, temporal-evidence 6, step11-audit 14, step12-audit 7, step12-journey-model 5, step11-screenshots 1, screenshots 1. |
| New `tests/e2e/case-report.spec.ts` on the Step 20 build | **PASS** | **2/2** (40 s): R1 verifies the Markdown export contains the conclusion, per-record eligibility with exclusion reasons, findings, limitations, provenance, and interpretation notice — with no invented probabilities or affirmative causal claims; R2 verifies both exports are withheld (not rendered) while the report is stale. |

Composed total: **67/67** across the two runs (the 65-test run validates the supplied tree; the 2-test run validates the Step 20 addition on a rebuilt bundle). This composition is stated explicitly; no single 67-test run is claimed.

## 7. Security and integrity review (static + probe)

| Check | Status | Detail |
|---|---|---|
| Secrets/API keys in source | **PASS** | none found (only random record-code tokens) |
| User content rendering | **PASS** | no `dangerouslySetInnerHTML` anywhere; React-escaped |
| CSV formula injection | **PASS** | `csvCell` prefixes `'` to `= + - @` leading cells |
| Upload limits | **PASS** | CSV import 5 MB; provenance files 10 MB; backup restore 5 MB |
| Filename safety | **PASS** | download names sanitized via `[^a-zA-Z0-9-_]` |
| Import/restore validation | **PASS** | schema-parse every record; fingerprint re-verification; count checks |
| Vault integrity | **PASS** | re-hash + byte-length before download; corruption tests in suite |
| Stale/tamper protection | **PASS** | covered by step11-audit (14 tests) + step12-audit (7 tests) suites |
| Deployment boundary | **PASS** | browser-local-only is stated in UI, docs, and every report; operational NOT READY maintained |

## 8. Code changes in Step 20

- **New:** `lib/case-report.ts` — pure Markdown case-report builder (conclusion, stage hypotheses, eligibility table with exclusion reasons, findings, lineage review, next actions, limitations, provenance, interpretation notice). Reproduces uncertainties; no probabilities or causal claims; references records by code (full records stay in the JSON bundle — stated in the doc).
- **Changed:** `components/diagnostics/DiagnosticWorkbench.tsx` — "Export readable case report" button next to the review-bundle export; disabled while the report is stale (same guard as the bundle).
- **New:** `tests/e2e/case-report.spec.ts` — R1 (export content: conclusion, eligibility, limitations, fingerprint; no probability/causal language; code-references) and R2 (export disabled on stale report).
- **Docs:** `STEP20_BASELINE.md`, `STEP20_PRIOR_ART_MATRIX.md`, `STEP20_PROJECT_REPORT.md`, `STEP20_ABSTRACT.md`, `STEP20_EVIDENCE_SUMMARY.md`, `STEP20_DEMO_SCRIPT.md`, `STEP20_SCORECARD.md`, this report.
- **Data:** `research/real-data-profile.json` regenerated from the verified published CSVs.

No diagnostic rule, gate, or abstention behavior was changed. No dependency changed.

## 9. Not tested / blocked

- Live Supabase migration tests: **BLOCKED** (no test database; migration remains an unconnected reference).
- Screen reader, Windows/macOS browsers, Node 20 / Python 3.10 minima, remote CI: **NOT TESTED**.
- External reviewer response, participant sessions, field validation: **NOT TESTED** (pending; protocols and tooling prepared and verified).
- Demo rehearsal on judging hardware: **NOT TESTED** (pending).
