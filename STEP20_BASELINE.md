# STEP20_BASELINE.md — WaterChain Step 19 repository audit (Phase A)

**Date:** 2026-10-29
**Input:** `WaterChain_Step19_Validation_Ready.zip` (md5 `e9eebbe8c8bc5a1fd5af82b3a1c00a37`), preserved pristine at `~/workspace/waterchain-step20/original/`.
**Work tree:** `~/workspace/waterchain-step20/work/waterchain-step19/` (all work on this copy; original untouched).
**Environment:** Ubuntu 24.04.5 LTS, Node v24.22.1, npm 10.9.4, Python 3.12.3. ~1 GB free RAM at audit time — long test runs must be sequential with one worker.

## 1. Repository structure

Next.js 15 (App Router) + React 19 + TypeScript strict + zod, Python stdlib-only engine, browser-local storage (localStorage/IndexedDB). Single page app (`app/page.tsx`, 412 lines) with one API route (`app/api/diagnose/route.ts`, 123 B page chunk). Dependencies: `@xyflow/react`, `lucide-react`, `next`, `react`, `react-dom`, `zod`; dev `@playwright/test ^1.55.0`, eslint, typescript.

Modules: explicit water journeys (`lib/investigation-model.ts`), evidence register (`lib/evidence.ts`, `lib/evidence-csv.ts`), rule-based Python diagnostic engine (`engine/diagnose.py`, 802 lines) via `diagnose_cli.py`, provenance vault (`lib/provenance-vault.ts`, IndexedDB), hash-linked audit ledger, ActionLoop (`lib/action-loop.ts`), Risk & Control Register (`lib/risk-register.ts`), temporal evidence planner (`lib/temporal-evidence.ts`), Evidence Sensitivity Studio (decision-robustness UI + API omission runs), independent-review workbench (`components/validation/IndependentReviewWorkbench.tsx`, `lib/independent-review.ts`), Supabase reference migration (`supabase/`, unconnected).

## 2. Freshly executed verification (this environment, 2026-10-29)

| Check | Result | Evidence |
|---|---|---|
| `npm ci` (supplied lockfile) | **PASS** | exit 0, 387 packages, 48 s. This closes the Step 19 BLOCKED item. |
| `npx tsc --noEmit` | **PASS** | exit 0, no errors. |
| `npx eslint .` | **PASS** (0 errors, 2 warnings) | Two `react-hooks/exhaustive-deps` warnings (page.tsx:142, TemporalEvidenceWorkbench.tsx:61), pre-existing and documented as intentional in Step 16 audit (fixing would clobber user UI state). |
| `npm run build` | **PASS** | exit 0, static pages generated, `/` 106 kB / First Load 209 kB. |
| Engine tests | **PASS** | `python3 -m unittest discover -s engine -p 'test_*.py'`: **91/91**. |
| Adapter tests | **PASS** | `python3 -m unittest discover -s research/datasets -p 'test_*.py'`: **12/12**. |
| Step 19 validation tools | **PASS** | `python3 -m unittest discover -s validation -p 'test_*.py'`: **8/8**. |
| Independent-review Node tests | **PASS** | `node --test tests/unit/independent-review.test.cjs`: **12/12**. |
| Synthetic evaluation | **PASS** | WaterChain: 100% expected-decision conformance, 100% correct abstention, 0.0% unsupported attribution. Naive first-positive baseline: 26.7% accuracy, 8.3% correct abstention, **91.7%** unsupported attribution (full eval set — do not conflate with the 88.9% figure, which is 8/9 on the 13-case Step 18 comparison subset requiring abstention). |
| Synthetic holdout | **PASS** | 16/16 expected decisions; 0/13 unsupported attributions. |
| Comparative evaluation (in-process) | **PASS / reproduced** | 13/13 scenarios match expected: WaterChain 0.0% unsupported attribution, 100% correct abstention, 100% attribution correctness on 4 should-attribute cases; baseline 88.9% unsupported attribution, 38.5% conformance. `via_api: False`; disclosure block present. |
| Comparative evaluation (via real API) | **PASS / fresh** | `step18_compare.py --api http://localhost:3107`: **12/12 JSON-carryable scenarios match** through the real `/api/diagnose` (NaN scenario correctly skipped in API mode — not expressible in JSON; covered in-process). First fresh API-parity run on this tree. |
| Adversarial API probes | **PASS** | Invalid JSON → 400+requestId; bad schema → 400+field details; raw `NaN` JSON → 400 (fails closed); empty records → 200 "not assessed"; 501 records → 400; >2 MiB body → 413; GET → 405; unknown fields tolerated; evidence SHA-256 order-stable; valid bracketed pathway → "candidate transition only" with `attribution_permitted: true`; server log greps show **zero evidence strings leaked**. |
| Real-data adapter (published Uganda CSVs) | **PASS / reproduced** | Reused `~/workspace/waterchain-step12/real-data/*.csv` — all four SHA-256 hashes identical to the Step 12 record. Adapter exit 0, `profile_complete`: 3,203 samples, 477 borehole visits, 1,118 household visits, 134 blanks; 278 ambiguous joins refused; 0 duplicate IDs; 0 date mismatches; 9/134 blanks positive (flagged caveat); 843 exact measured transport/storage pairs; 97 ambiguous + 356 no-lab-result rows excluded from pairing. Profile at `/tmp/real-data-profile.json` (to be committed to `research/`). CC-BY, Nansiimbi & Clavijo Daza (2026). Observational only — no causal claims. |
| Playwright E2E | **RUNNING** | Sequential, 1 worker, against production build on :3107 (own server, `reuseExistingServer`). Results pending. |

## 3. Known defects at baseline

- None confirmed beyond the items below; typecheck/lint/build are clean and all Python suites green.
- Supplied `engine/step18_compare.py` had a `baseline` key set twice (fixed in Step 18 as D4 — verified fixed in this tree: `baseline_description` present, `baseline` metrics dict present).
- The shipped tree's Step 19 frontend verification was BLOCKED there (npm timeout); closed here.
- Two lint warnings intentional (documented above).

## 4. Scientific and operational boundaries (carried forward, still true)

- Synthetic fixture results = fixture conformance, not real-world diagnostic accuracy. Engine tuned on earlier fixtures.
- Naive baseline is deliberately weak; its failure rate must NOT be presented as superiority over experts or spreadsheet workflows.
- Sensitivity Studio = leave-one-record-out decision-dependence check, not a statistical robustness proof or causal counterfactual.
- Hash checks detect change vs a fingerprint; not authenticity proof.
- Browser-local storage ≠ secure multi-user authority. Supabase migration unconnected (two nullability divergences recorded in DEPLOYMENT_READINESS.md).
- No independent reviewer response, no participant sessions, no field validation, no real-world accuracy estimate.
- Operational deployment NOT READY (authentication, authorization, authoritative persistence, data governance, backups, threat model, deployment smoke tests outstanding).

## 5. Environment constraints

- ~1 GB free RAM: Playwright must run sequentially (workers: 1). A >2 GB free machine is recommended for any live demo rehearsal.
- npm scripts use bare `python`, which this environment lacks; suites run with `python3` (identical commands). Scripts left unchanged (documented precedent from Step 12).
- No outbound communication permitted (reviewer invitations prepared only; actual outreach is the user's action).
