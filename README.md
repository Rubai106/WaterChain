# WaterChain

**Evidence-first water-quality investigation workbench**

[![Quality gates](https://github.com/Rubai106/WaterChain/actions/workflows/quality-gates.yml/badge.svg?branch=main)](https://github.com/Rubai106/WaterChain/actions/workflows/quality-gates.yml)

WaterChain helps a reviewer organize water-sample records and assess whether the available evidence is sufficient to discuss a **candidate contamination transition** along a documented water journey:

**Source → Collection / transport → Household storage → Serving**

It combines record-eligibility checks, quality-control and chronology checks, source/identity reconciliation, explicit transfer relationships, conservative abstention, and traceable follow-up actions in one review workflow.

> **Prototype, not a water-safety certification.** WaterChain does not test water, prove contamination causation, certify that water is safe, or replace qualified laboratory and field professionals.

## Current status

- **Competition demo / research prototype:** intended for supervised investigation and evidence review.
- **Storage:** investigation data and workflow state are stored in this browser's `localStorage`; original files may be retained in browser `IndexedDB` when available. There is no connected shared database or authenticated multi-user workspace.
- **Decision engine:** deterministic, rule-based Python invoked by the Next.js API. When evidence or relationships are insufficient or ambiguous, abstention is an intended outcome.
- **Validation:** automated software tests and developer-authored synthetic cases are available. Public observational data have been profiled descriptively. Independent expert review, participant evaluation, and field validation remain pending.
- **Operational deployment:** **not ready**. The optional database migration is not connected to the application; authentication, authorization, shared persistence, and operational governance are not implemented.

## Core capabilities

### Evidence intake and investigation separation

- Create named investigations with separate evidence registers.
- Enter records manually or import CSV with preview, schema checks, row-specific errors, and partial import of structurally valid rows.
- Export the current investigation's records and create/restore validated JSON evidence backups without overwriting an existing investigation.
- Keep demo fixtures separate from the live investigation interface; no prefilled water-quality conclusions are presented as real cases.

### Conservative evidence review

- Check record identifiers, source and batch references, timestamps, methods, outcomes, quantitative values and units, quality-control metadata, possible duplicates, and sample-identity conflicts.
- Review per-record eligibility, pathway coverage, chronology, discordant repeats, off-pathway observations, and unresolved evidence.
- Use an explicit water-journey model with separate sampling events, water/container entities, and evidence-referenced transfers. The explicit resolver only considers a candidate transition when exactly one complete entity-connected route is established. Zero or multiple complete routes block that interpretation.
- Receive a cautious result and named follow-up actions. A positive is an observed result, not proof of where contamination originated; a negative does not prove the water is safe.

### Provenance and readable reports

- Record provenance metadata and SHA-256 fingerprints; verify retained files before offering them for download.
- Maintain a local hash-linked relationship history and export a human-readable Markdown case report with the conclusion, eligibility/exclusion reasons, findings, lineage, next actions, limitations, and provenance.
- Disable report export when the evidence has changed since the review, until a fresh review is run.

**Integrity caveat:** hashes can detect content changes but do not establish source authenticity, authorship, laboratory validity, or scientific truth. Browser-local history is not an authenticated or immutable server-side audit log.

### Follow-up and review tools

- **ActionLoop:** assign follow-up work, link evidence, record completion and separate verification, and preserve a local action history.
- **Risk & Control Register:** record observed or suspected hazards and controls separately from diagnostic conclusions. Its severity/likelihood matrix is qualitative screening, not a validated risk probability or health-risk score.
- **Temporal evidence and sampling planner:** organize dated observations and compare rule-based next-action options without inventing probabilities, costs, or laboratory turnaround times.
- **Decision Sensitivity Studio:** rerun the deterministic engine with selected eligible records omitted to show whether a conclusion depends on specific evidence. This is not a physical-world counterfactual or causal proof.
- **Blind independent-review workflow:** prepare a minimized reviewer packet, import structured responses, validate packet/case references, and compare decisions descriptively after responses are frozen. No independent review is claimed complete until actual responses have been collected.

### Research-data adapter and evaluation

The optional Water Quality Uganda adapter profiles user-downloaded CSV files, audits sample/visit joins and laboratory blanks, handles censored TNTC values, and summarizes only unambiguous within-visit transport/storage pairs.

This is a separate descriptive analysis pipeline. The original CSV downloads are not bundled, the observations are not causal ground truth, and profiling results are not proof of WaterChain's real-world diagnostic accuracy.

## Getting started

### Requirements

- Node.js **20.9 or newer** (Node.js 22 is used in CI)
- npm
- Python **3.10 or newer**
- Chromium and Playwright browser dependencies for end-to-end tests

The Python engine uses the Python standard library; the web application dependencies are recorded in `package-lock.json`.

### Install and run

From the repository root:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows, if the Node.js process cannot find Python, set `PYTHON_EXECUTABLE` to the full path to your Python executable in PowerShell:

```powershell
$env:PYTHON_EXECUTABLE = "C:\\Path\\To\\Python\\python.exe"
npm run dev
```

## Verification and tests

Run the frontend checks:

```bash
npm run check:ts-syntax
npm run test:independent-review
npm run typecheck
npm run lint
npm run build
```

Run the Python engine, research adapter, and validation-tool suites:

```bash
npm run test:engine
npm run test:dataset-adapter
npm run test:step19-tools
```

Re-run the developer-authored synthetic evaluation and holdout, then rebuild the Python reproducibility manifest:

```bash
npm run validate:evaluation
npm run validate:holdout
npm run validate:manifest
```

Run the full Playwright suite separately:

```bash
npx playwright install chromium
npm run test:e2e
```

You can also run focused suites with `npm run test:temporal-e2e` and `npm run test:independent-review-e2e`.

The full browser suite is not part of the current GitHub Actions workflow. Run it locally with sufficient free memory and review the actual test output; do not substitute an earlier report for a fresh run. Some suites start a local production server, so close any conflicting WaterChain server before testing.

### What the evaluation numbers mean

The repository includes a controlled evaluation and a separate development-holdout suite. Their cases are developer-authored synthetic fixtures with predeclared expected software behavior. They help detect regressions in handling duplicates, failed QC, missing timestamps, ambiguous relationships, discordant results, and other adversarial inputs.

These results are **fixture conformance, not real-world accuracy**. The first-positive baseline used in the comparison is deliberately naive; it is not a fair substitute for a competent investigator or a validated operational workflow. The Uganda dataset adapter is descriptive and does not provide causal ground truth. Do not present these metrics as field accuracy, clinical or public-health effectiveness, or proof of superiority over experts.

## Repository guide

| Path | Purpose |
|---|---|
| `app/` | Next.js pages and API routes |
| `components/` | Investigation UI, diagnostics, evidence, follow-up and review workbenches |
| `lib/` | Evidence models, validation, provenance, case reports, ActionLoop and risk-register logic |
| `engine/` | Python diagnostic engine, CLI adapter, synthetic evaluation, holdout and tests |
| `research/datasets/` | Water Quality Uganda adapter and tests |
| `research/fixtures/` | Small synthetic fixtures used in reproducible software tests |
| `tests/` | Unit and Playwright end-to-end tests |
| `validation/` | Review/pilot protocols, reviewer tooling, submission materials and limitations |
| `.github/workflows/quality-gates.yml` | GitHub Actions quality gates |
| `supabase/migrations/` | Reference schema for possible future persistence; not connected to the current app |

## CI

The **WaterChain quality gates** workflow runs on pushes, pull requests, and manual dispatch. It checks the Python engine and synthetic evaluation in one job, and runs a clean `npm ci`, independent-review unit tests, TypeScript syntax parsing, typecheck, lint, and production build in a separate frontend job.

The current workflow does not run the full Playwright end-to-end suite. See the [Actions history](https://github.com/Rubai106/WaterChain/actions) for the latest run result.

## Project and submission documents

- [Step 20 project report](validation/STEP20_PROJECT_REPORT.md)
- [Registration abstract](validation/STEP20_ABSTRACT.md)
- [Evidence summary](validation/STEP20_EVIDENCE_SUMMARY.md)
- [Demo script](validation/STEP20_DEMO_SCRIPT.md)
- [Prior-art and differentiation matrix](STEP20_PRIOR_ART_MATRIX.md)
- [Evidence-linked judging scorecard](STEP20_SCORECARD.md)
- [Deployment readiness and limitations](DEPLOYMENT_READINESS.md)
- [Startup guide](STARTUP_GUIDE.md)
- [Judge demo checklist](JUDGE_DEMO_CHECKLIST.md)
- [Scientific validation report](SCIENTIFIC_VALIDATION_REPORT.md)

## CSV format

Required columns are `sample_code` and `stage`. Supported stages are `source`, `collection`, `storage`, and `serving`.

Optional columns include:

`record_code`, `collected_at`, `water_source_id`, `batch_id`, `analyte`, `result`, `numeric_value`, `unit`, `method`, `lab_name`, `positive_control`, `negative_control`, `blank_control`, `source_reference`, and `notes`.

Supported analytes include `e_coli_presence`, `e_coli_concentration`, `turbidity`, `free_chlorine`, and `other`. Supported results are `detected`, `not_detected`, `quantified`, `not_tested`, and `invalid`. For `quantified`, provide a nonnegative numeric value and unit. QC fields use `pass`, `fail`, or `not_recorded`. Preserve the original reported values and leave unknown fields blank rather than guessing.

## Intended use and limitations

WaterChain is intended to support qualified people reviewing whether documented records justify a cautious candidate interpretation and what evidence should be resolved next. It does not:

- prove when, where, or how contamination entered a water supply;
- establish that water is safe or unsafe;
- authenticate user-entered sample identifiers, laboratory reports, transfer events, or reviewer identities;
- replace laboratory quality systems, field investigation, or local water-safety procedures;
- provide calibrated probabilities or a validated health-risk score; or
- provide secure shared records, authenticated multi-user collaboration, or operational audit infrastructure.

Use synthetic fixtures for software testing. Do not enter sensitive real-case information into a shared or untrusted browser profile. Independent expert review, participant evaluation, and field validation remain necessary before stronger performance or deployment claims can be made.
