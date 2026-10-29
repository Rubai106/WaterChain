# WaterChain Startup and Operations Guide

This guide covers local setup, the main investigation workflow, data handling, and verification commands for the current WaterChain prototype. The product overview is in [README.md](README.md); current competition evidence is in [TEST_REPORT_STEP20.md](TEST_REPORT_STEP20.md) and the linked Step 20 submission documents.

## Status and intended use

WaterChain is a **local-first research prototype** for reviewing whether documented water-sample records support a cautious *candidate contamination transition* along a documented journey. It is a decision-support workbench for qualified reviewers, not a laboratory system, a water-safety certification, or proof of where contamination originated.

Case and workflow state is stored in this browser's `localStorage`. Original files may be retained in browser `IndexedDB` when available. There is no connected shared database, authenticated multi-user access, server-side case persistence, or operational audit authority. Operational deployment is not ready.

## 1. Prerequisites

- Node.js 20.9 or newer (Node.js 22 is used by GitHub Actions).
- npm.
- Python 3.10 or newer. The Python engine uses only the standard library.
- Chromium / Playwright browser dependencies if running browser tests.

Verify installation:

```bash
node --version
npm --version
python --version
```

On Windows, use `py --version` if the `python` command is not available.

## 2. Install and start locally

Run from the project root (the directory containing `package.json`):

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the Node.js process cannot locate Python on Windows, set the explicit interpreter path in PowerShell:

```powershell
$env:PYTHON_EXECUTABLE = "C:\Path\To\Python\python.exe"
npm run dev
```

Use your actual Python executable path. Keep the terminal open while the development server is running.

## 3. Main investigation workflow

1. **Create a named investigation.** Work in the intended case. Investigations have separate browser-local evidence registers.
2. **Add evidence.** Enter records manually or import a CSV. Review the import preview, schema errors, and rejected rows before accepting records. Never fill unknown fields with guesses.
3. **Establish the journey.** For new cases, define the source, sampling events, water/container entities, and documented transfers using the actual references available. A journey map records a supported relationship; it does not independently prove physical continuity.
4. **Run the diagnostic review.** The API validates the request and invokes the standard-library Python engine. Inspect the overall result and the per-record eligibility/exclusion reasons, unresolved relationships, chronology, QC issues, and lineage.
5. **Follow the next action.** Resolve documentation/identity/transfer gaps or arrange qualified review or further sampling where appropriate. ActionLoop tasks and risk-control records are local workflow records, not authenticated approvals.
6. **Export the result.** Use the readable Markdown case report for a human-readable summary, and JSON/evidence backups for structured records. A report is disabled as stale when its evidence no longer matches the reviewed snapshot; run a fresh review before exporting a current report.
7. **Preserve local records.** Export the evidence backup, ActionLoop log, and risk-register data separately where applicable. Clearing browser data can remove local cases and workflow history.

## 4. CSV input

The minimum required columns are `sample_code` and `stage`. Supported stages are `source`, `collection`, `storage`, and `serving`.

Common optional columns include `record_code`, `collected_at`, `water_source_id`, `batch_id`, `analyte`, `result`, `numeric_value`, `unit`, `method`, `lab_name`, `positive_control`, `negative_control`, `blank_control`, `source_reference`, and `notes`.

Supported analytes include `e_coli_presence`, `e_coli_concentration`, `turbidity`, `free_chlorine`, and `other`. Supported results are `detected`, `not_detected`, `quantified`, `not_tested`, and `invalid`. For a quantified result, provide a nonnegative numeric value and unit. Quality-control fields use `pass`, `fail`, or `not_recorded`.

Prefer the in-app CSV template as the schema source of truth. Keep original source values, preserve units, and leave unreported fields blank.

## 5. Verification commands

Run frontend checks:

```bash
npm run check:ts-syntax
npm run test:independent-review
npm run typecheck
npm run lint
npm run build
```

Run Python suites and validation tools:

```bash
npm run test:engine
npm run test:dataset-adapter
npm run test:step19-tools
npm run validate:evaluation
npm run validate:holdout
npm run validate:manifest
```

Run the complete Playwright suite separately:

```bash
npx playwright install chromium
npm run test:e2e
```

Focused browser suites are available through `npm run test:temporal-e2e` and `npm run test:independent-review-e2e`. The complete browser suite is sequential and can take substantial time. Close other WaterChain servers and keep sufficient free memory available before running it.

GitHub Actions runs the Python engine/synthetic-validation job and the frontend quality-gate job. The current workflow does not execute the full Playwright end-to-end suite, so that suite must be run separately. See the [Actions history](https://github.com/Rubai106/WaterChain/actions) for the current remote CI status.

## 6. Evaluation and interpretation safeguards

The controlled evaluation and holdout use developer-authored synthetic fixtures with expected software behavior declared in advance. They verify whether the rule engine handles specified edge cases; they do not establish real-world diagnostic accuracy. The comparison baseline is deliberately naive, not a competent-investigator benchmark.

The Water Quality Uganda adapter profiles public observational records and join quality. These data do not supply causal ground truth for WaterChain.

- A positive test result establishes an observed result, not when or how contamination entered the water.
- A negative result does not prove the water is safe.
- If eligibility, sample identity, timing, QC, or transfer relationships are insufficient or ambiguous, abstention is an intended outcome.
- SHA-256 fingerprints help detect file-content changes; they do not authenticate a source or establish scientific truth.
- Names entered for action owners and reviewers are not authenticated identities.
- Risk-severity/likelihood output is a qualitative screening aid, not a validated health-risk score.

Do not use WaterChain as the sole basis for drinking-water safety decisions. Follow applicable laboratory procedures, field protocols, and local water-safety requirements.

## 7. Current documentation

- [README and repository map](README.md)
- [Step 20 technical test report](TEST_REPORT_STEP20.md)
- [Scientific validation limitations](SCIENTIFIC_VALIDATION_REPORT.md)
- [Research data audit](RESEARCH_DATA_AUDIT.md)
- [Deployment readiness](DEPLOYMENT_READINESS.md)
- [Judge demo checklist](JUDGE_DEMO_CHECKLIST.md)
- [Step 20 prior-art matrix](STEP20_PRIOR_ART_MATRIX.md)
- [Step 20 scorecard](STEP20_SCORECARD.md)
- [ActionLoop guide](ACTIONLOOP_GUIDE.md)
- [Risk & Control Register guide](RISK_CONTROL_REGISTER_GUIDE.md)
- [Temporal evidence guide](TEMPORAL_EVIDENCE_GUIDE.md)
- [Decision Sensitivity Studio](STEP16_DECISION_ROBUSTNESS.md)

Historical implementation, bug-fix, and verification records are retained under [docs/history](docs/history/README.md). They are development history, not the current source of truth for release status.
