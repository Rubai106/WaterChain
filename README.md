# WaterChain — Evidence Investigation Workbench

**Current package: Step 16 — all prior investigation workflows plus a Decision Sensitivity Studio for single-record omission analysis.**

> **Verification source of truth:** `TEST_REPORT.md` is the later independent run report for this package; `BROWSER_TEST_REPORT.md` documents the browser-test run composition. `STEP16_VERIFICATION.md` and `STEP16_RELEASE_AUDIT.md` are preserved as historical implementation-pass snapshots, not current final-build status. The final full browser run had one timeout on a memory-constrained machine; that screenshot test passed on a standalone rerun, and targeted regression specs passed. Do not describe this as a single uninterrupted all-green run. See `RELEASE_RECONCILIATION.md`.

WaterChain is a research prototype for reviewing whether documented water-sample evidence is sufficient to discuss a *candidate* contamination transition along a conceptual pathway: source → collection/transport → household storage → serving. It is not a certified water-safety tool, and it does not prove contamination causation.

The project intentionally contains **no prefilled water-quality results or realistic-looking synthetic cases in the live investigation UI**. All evaluation fixtures are stored separately under `engine/` and labelled synthetic.

## What's implemented

- Light-first aquatic evidence-investigation workbench with custom WaterChain branding, subtle depth, four conceptual pathway stages, and evidence-inspector summaries.
- Multiple named investigations in browser-local storage. Each has its own evidence register; selecting a different investigation remounts the review component so a previous report is not carried across cases.
- One-time migration from the former `waterchain:evidence:v1` single-register store. The old key is removed only after the new case store is saved successfully. If stored records are malformed, automatic saving pauses and the available records enter read-only recovery mode.
- Investigation-specific CSV export plus exact JSON evidence backup. A validated WaterChain backup or review bundle can be restored as a new investigation without overwriting existing cases.
- Manual evidence entry and CSV import with preview, schema checks, row-specific errors, partial import of structurally valid rows, CSV template download, and current-investigation CSV export.
- Deterministic record-integrity checks for timestamps, source and batch identifiers, test methods, outcomes, quantitative values/units, quality-control metadata, report references, possible duplicates, and sample identity reuse.
- Python diagnostic engine with eligibility gates, four-stage coverage, lineage/source checks, chronology checks, mixed-analyte and discordant-repeat warnings, off-lineage exclusion, hypotheses with supporting/contradicting records, a cautious conclusion, and explainable next actions.
- **Explicit water-journey model (recommended for new cases):** distinct source, journey, sampling events and water/container entities; evidence-referenced transfers between exact `fromEntityRef`/`toEntityRef` entities; source-ID reconciliation; and a bounded 0/1/2+ complete-route resolver. The engine never assumes that four separate sample bottles are one physical batch. Zero or multiple complete routes blocks candidate-transition interpretation.
- **Provenance register:** file name, byte length, SHA-256, review status and storage mode. The browser attempts to retain original files in IndexedDB up to 10 MB per file and re-hashes/re-checks size before offering download. If local file storage fails, only fingerprint metadata remains. Original files are not uploaded or embedded in ledger exports.
- **Local relationship audit trail:** hash-linked source, sampling-event, transfer-event and provenance changes. It is a local integrity aid, not authenticated user identity, a server-side audit log or a digital signature.
- **Explainable next-action planner:** separates documentation/linkage repair from a physical sample or repeat review, explains what possible positive/negative results would and would not establish, and never invents prices, test turnaround time or guaranteed information gain.
- **ActionLoop (Step 13):** converts current diagnostic findings, planner recommendations, or manual follow-ups into assigned actions with owner, creator label, due date, priority, linked evidence records, completion references, separate verification, reasoned cancellation/reopening/reassignment, and a local history. It preserves a snapshot of the originating finding and marks the source stale if the diagnostic context changes. “Verified & closed” is a workflow state only, not proof of water safety or contamination resolution. Actions are stored separately per investigation in browser `localStorage`; export the ActionLoop log separately from the evidence backup. Names are self-entered, not authenticated. See `ACTIONLOOP_GUIDE.md`.
- **Guided next-action card (Step 16):** a context-aware prompt directs the user to add evidence, run a review, refresh a stale report, inspect follow-up options, or test evidence dependence. It is a workflow aid, explicitly not a water-safety rating. Legacy late-stage dark CSS overrides were also corrected to preserve the light-first aquatic design and improve contrast in navigation and diagnostic states.
- **Decision Sensitivity Studio (Step 16):** for a current report, select up to four engine-eligible on-pathway records and rerun the real diagnostic API with one selected record omitted at a time (and its linked sampling event omitted for explicit journeys). The feature reports whether the decision category changes, leaves original evidence untouched, marks results stale when the evidence fingerprint changes, and exports a compact JSON artifact. This is an evidence-availability sensitivity check—not a physical-world counterfactual, probability, or causal proof. See `STEP16_DECISION_ROBUSTNESS.md` and `STEP16_NOVELTY_AND_PRODUCT_STRATEGY.md`.
- **Temporal evidence & sampling planner (Step 15):** displays dated observations in chronological order, separates undated records instead of inventing timestamps, describes repeat-result patterns only when the current engine report marks records eligible, and distinguishes pathway-linked observations from eligible but off-pathway results. Compares up to three follow-up actions side-by-side with the reason for ranking, what possible positive/negative results would mean, prerequisites, and remaining unknowns. Ranking is deterministic and rule-based; no probabilities, costs, or guaranteed information gain are invented. Temporal planner proposals can open a prefilled ActionLoop draft, but do not silently save an action. See `TEMPORAL_EVIDENCE_GUIDE.md` and `TEMPORAL_PLANNER_PROTOCOL.md`.
- **Risk & Control Register (Step 14):** records observed/suspected hazards separately from diagnostic conclusions; links them to evidence and external references; records preventive, monitoring, mitigation, and corrective controls; and distinguishes proposed, documented, implemented-unverified, effectiveness-reviewed, ineffective, and unknown control states. A small qualitative severity/likelihood matrix is clearly labelled as unvalidated screening—not a risk probability or certified health-risk score. Evidence-linked control reviews store SHA-256 snapshots and become stale if linked evidence changes. Risk review closure requires a current verified-control review, a note, reviewer label, and a traceable closure reference. Controls can create linked corrective ActionLoop tasks. See `RISK_CONTROL_REGISTER_GUIDE.md`.
- **Open research-data adapter:** `research/datasets/waterqualityuganda_adapter.py` profiles four user-downloaded Water Quality Uganda CSVs, hashes inputs, audits visit/sample joins and lab blanks, handles censored TNTC values, and summarizes only unambiguous within-visit transport/storage pairs. It is a separate analysis pipeline, not a source of causal ground truth or prefilled production records.
- Next.js `POST /api/diagnose` route. The Node.js route validates the request, invokes the standard-library Python engine as a child process without a shell, caps request/output size, enforces a timeout, validates the response schema, and returns a request ID plus SHA-256 evidence fingerprint.
- Diagnostic review export in JSON with investigation ID/name, submitted evidence snapshot, report, run metadata, engine identifier, and evidence hash. The export is disabled if the current evidence differs from the reviewed snapshot. Review bundles and evidence backups can be restored as a separate investigation after schema validation.
- Synthetic controlled evaluation, adversarial tests, a development-holdout suite, reproducibility manifest builder, blinded reviewer packet generator, and GitHub Actions quality-gate workflow.
- Judge demo guide and visible interpretation guardrails instead of navigation links that promise unfinished features.

## Run locally

Prerequisites: **Node.js 20.9+**, npm, and **Python 3.10+**. The Python engine has no third-party Python package dependencies.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

On Windows, if `python` is not available to the Node.js process, set `PYTHON_EXECUTABLE` to the full path of your Python executable in PowerShell:

```powershell
$env:PYTHON_EXECUTABLE = "C:\Path\To\Python\python.exe"
npm run dev
```

Run frontend checks after installing dependencies:

```bash
npm run typecheck
npm run lint
npm run build
```

Run the Step 15 temporal-planner browser tests with `npm run test:temporal-e2e` (the full browser suite uses `npm run test:e2e`).

The repository includes `.github/workflows/quality-gates.yml` to run frontend checks and Python checks on GitHub Actions. The workflow has been added but still needs to execute in a connected CI environment before it can count as a passing CI run.

## Python tests and evaluation

Run the Python test suites:

```bash
python -m unittest discover -s engine -p "test_*.py" -v
python -m unittest discover -s research/datasets -p "test_*.py" -v
```

Regenerate the synthetic controlled evaluation:

```bash
python engine/evaluate.py
```

Regenerate the separately authored synthetic development holdout:

```bash
python engine/run_holdout_validation.py
```

Build the reviewer packet (expected decisions are excluded from the packet):

```bash
python engine/build_reviewer_packet.py
```

Build the reproducibility manifest:

```bash
python engine/build_reproducibility_manifest.py
```

Outputs are under `engine/` and `validation/`. Do not copy those fixtures into a real case and do not call the generated test scores real-world diagnostic accuracy.

## ActionLoop workflow

See `ACTIONLOOP_GUIDE.md` for lifecycle states and verification rules. In short: assign an action to a named owner, record work and references, submit it for verification, and require a differently named reviewer plus verification evidence before setting it to “Verified & closed”. The names are self-entered; the browser-local history is not authenticated or tamper-proof. ActionLoop records are exported separately from the evidence backup.

## Step 14 — Risk & Control Register

Open **Risk & controls** in an active investigation to record a hazard/risk observation, its basis, location, linked sample records, external references, severity and likelihood judgement. Unknown severity/likelihood remains `not assessed`. The low/moderate/high output is only a transparent qualitative screening matrix; it is not validated and must not replace an adopted local water-safety risk method.

Controls are separate records with an accountable owner. A documented reference is not proof that the control is implemented. Implementation requires a note and supporting evidence. Effectiveness review requires a differently named reviewer plus a verification note and reference/linked record. When selected verification evidence records change, the stored SHA-256 snapshot is compared with the current record content; a mismatch makes the review stale and blocks administrative closure until the control is reviewed again. The risk-review state being closed does not mean the hazard has been eliminated or the water is safe.

Corrective tasks can be created from a control and appear in ActionLoop. Both the risk register and ActionLoop remain browser-local, names are self-entered, and their histories are not authenticated or immutable. Risk-register JSON exports are separate from the main evidence backup; preserve them separately. See `RISK_CONTROL_REGISTER_GUIDE.md` and `RISK_CONTROL_TEST_PLAN.md`.

Step 14 browser tests are in `tests/e2e/risk-control-register.spec.ts`. The test file was added, but this build environment's `npm ci` timed out. Its full Playwright execution, frontend typecheck, lint and Next.js production build are not claimed as verified in this package. Python/evaluation and TypeScript/TSX syntax checks are reported in `STEP14_VERIFICATION.md`.

## Diagnostic semantics

- A reported positive locates an observed test result; it does not identify when or how contamination entered the water.
- A negative result does not prove that a stage was uncontaminated. Timing, intermittent contamination, test sensitivity, sampling technique, and handling affect interpretation.
- Batch and source IDs are user-entered metadata and are not authenticated.
- In legacy mode, cross-stage attribution is blocked unless the four stages share one unique batch and meet the record/source/chronology/quality gates. In explicit-journey mode, a separate graph of sampling events, source IDs, water/container entity IDs, and referenced transfers must resolve to exactly one complete path; 0 or 2+ paths abstain. The graph records a user-supported relationship, not proof of physical continuity or causation.
- If the evidence does not satisfy the rules, abstention is the intended outcome. No numerical probabilities or calibrated confidence scores are produced.
- “No register flags” means only that the register's configured checks did not find an issue. Engine eligibility and the selected path membership are reported separately. A negative result is not proof that water is safe.

## CSV schema

The CSV template is header-only. Required columns are `sample_code` and `stage`. Supported stages are `source`, `collection`, `storage`, and `serving`.

Optional columns include:

`record_code`, `collected_at`, `water_source_id`, `batch_id`, `analyte`, `result`, `numeric_value`, `unit`, `method`, `lab_name`, `positive_control`, `negative_control`, `blank_control`, `source_reference`, `notes`.

Supported analytes: `e_coli_presence`, `e_coli_concentration`, `turbidity`, `free_chlorine`, `other`.

Supported results: `detected`, `not_detected`, `quantified`, `not_tested`, `invalid`. For `quantified`, provide a nonnegative numeric value and unit. QC fields use `pass`, `fail`, or `not_recorded`. Use original reported values; leave unreported fields blank rather than guessing.

## Architecture

- `app/`, `components/`, `lib/`: Next.js UI, workspace handling, evidence types/validation, CSV helpers, and API response contracts.
- `app/api/diagnose/route.ts`: request validation and process boundary between Node.js and Python.
- `engine/diagnose.py`: conservative rule engine.
- `engine/diagnose_cli.py`: JSON stdin/stdout adapter used by the API.
- `engine/evaluate.py`, `engine/holdout_validation.py`: developer-authored synthetic evaluation fixtures.
- `research/datasets/waterqualityuganda_adapter.py`: independent local profiling of original CSV downloads; no dataset is bundled.
- `lib/investigation-model.ts`, `components/journey/WaterJourneyWorkbench.tsx`: relationship model, transfer graph, provenance register/vault and next-action planner.
- `lib/action-loop.ts`, `components/actions/ActionLoop.tsx`: finding-to-action workflow, evidence-backed verification and local action history.
- `lib/risk-register.ts`, `components/risks/RiskControlRegister.tsx`: hazard/control schema, qualitative screening matrix, evidence-snapshotted control review, ActionLoop integration and local risk history.
- `lib/provenance-vault.ts`: browser-local IndexedDB original-file vault and SHA-256 verification.
- `supabase/migrations/`: optional future owner-scoped relational schema, not connected to the app.
- `validation/`: external-review protocol, reviewer packet materials, deployment checklist, demo guide, novelty/prior-art notes, and verification notes.

## Current limitations and honest status

- This is a **local prototype**. Investigation and relationship metadata live in browser `localStorage`, original attached files (when IndexedDB retention succeeds) live in this browser only, and reports are cached locally. There is no live authentication, shared database, multi-user access control, cloud sync, or durable server-side case storage. An optional Supabase/PostgreSQL migration is a deployment starting point only; it has not been applied or connected.
- The Python engine is invoked as a subprocess from the Next.js Node.js server. A production deployment must host the Python engine in a suitable environment, secure the internal API, and enforce authentication/authorization.
- No original lab documents are uploaded or independently verified; the app records report references only.
- Explicit-journey mode models separate sample bottles and water/container entities plus referenced transfers; it permits a candidate route only when exactly one complete entity-connected path exists. Real journeys can still involve mixing, split/merge transfers, alternate routes, and unrecorded movements. These remain unresolved until modeled and supported by evidence. Legacy shared-batch mode remains for compatibility and is less expressive.
- Synthetic tests are developer-authored software fixtures. An independent reviewer has not completed a review unless a signed/dated response is added to the validation record. No field study or independent real-world validation is claimed.
- The original Step 8 authoring environment could not install npm dependencies because requests to the npm registry timed out, so its full typecheck, ESLint, production build, and browser-to-Python behavior were unverified. An independent audit on 2026-10-28 (see `TEST_REPORT.md`) reproduced that gap, found and fixed two build blockers (missing `autoprefixer` dependency; an ESLint flat-config import that does not resolve), and then verified typecheck, lint, production build, the live API, and browser workflows in this package. The GitHub Actions workflow in `.github/workflows/quality-gates.yml` is still configured but has not yet run on a remote runner; do not describe it as a passing CI run until it has.

## Step 19 — external evidence and pilot preparation

Read `STEP19_CHANGELOG.md` for Step 19 changes and `validation/STEP19_READINESS_AND_SCORECARD.md` for the current evidence-based score estimate and remaining gates. `validation/STEP19_PROJECT_REPORT.md` and `validation/STEP19_EVIDENCE_SUMMARY.md` are the updated submission/report drafts.

For blind review, send only `WaterChain_Step19_Blind_Reviewer_Packet.zip`; do not send implementation source or the expected-decision report before the reviewer's response is frozen. The scoring tool is `validation/score_independent_review.py`. For the spreadsheet-vs-WaterChain formative study, see `validation/MANUAL_WORKFLOW_BASELINE.md`, `validation/pilot_study/`, the empty capture template, and `validation/analyze_user_evaluation.py`. No independent review or participant study is claimed complete.

## Judge-facing preparation

Read `validation/JUDGE_DEMO_GUIDE.md` and `validation/STEP18_DEMO_SCRIPT.md`. They describe the live walkthrough, what can be truthfully claimed, which limitations to disclose, and how to demonstrate abstention without injecting real-looking evidence into the application.


## Step 8 — Judge readiness and case isolation

Step 8 adds per-investigation evidence separation, evidence backup and restore without overwriting a case, more defensive local-storage recovery, request-body size limiting, and CI quality gates. It also includes a judge-demo guide and a verification report.

Before a competition demo, follow `validation/JUDGE_DEMO_GUIDE.md`. The local browser workflow, complete Next.js build, and API integration still require a dependency-enabled run. Do not describe synthetic test results as real-world water testing or diagnostic accuracy.


## Step 9 — Persistent investigation reviews and import guardrails

- The latest diagnostic report is cached locally per investigation, using a workspace-specific browser-storage key. It survives reloads and switching investigations.
- The saved report stores its evidence fingerprint. If evidence changes, the workbench marks the report stale and disables review-bundle export until a fresh review is run.
- A report cache that is malformed is left untouched and surfaced to the user rather than silently overwritten. Reports remain in the browser only; clearing browser data removes them.
- Evidence register labels now say **No register flags** instead of “Metadata clear,” with an explicit note that register-level checks are not the same as engine eligibility.
- CSV imports reject duplicate `record_code` values within the imported file or against the active investigation, and reject unsupported columns rather than silently discarding their values.

These changes do not add sample records or change the diagnostic inference rules.

## Step 11 audit fixes

- Pathway stage status now prioritizes engine-confirmed `on_pathway` eligibility. Eligible observations from another batch are labeled as off-pathway and do not appear as selected-pathway positives or negatives.
- The stage detail panel maps each record to the engine's eligibility response by its immutable internal `record_id`, not its human-visible record code.
- When evidence changes, the prior diagnostic conclusion and result panels are hidden by default. A clearly marked collapsed archive preserves the old conclusion for audit context; exporting the stale review bundle remains disabled.
- Manual evidence entry generates a unique human-readable record code within the current investigation and checks for a duplicate before saving. Internal record identity continues to use a UUID.
- New browser regression tests cover off-pathway positive evidence, collapsed stale conclusions, and distinct record codes during manual entry.

See `STEP11_FIXES.md` and `STEP11_VERIFICATION.md` for the changes and verification limitations. These fixes do not modify the Python diagnostic decision rules.


## Step 12: explicit water journeys and provenance

For new investigations, create/register a source, create a separate water journey, map existing sample records to sampling events with actual field/visit references and water/container entity IDs, then record adjacent-stage transfers with their actual from/to entity IDs and a documented/observed basis. A `documented` transfer requires a source reference; an `observed` transfer requires a reference or explanatory note. Source IDs on linked evidence must match the selected source's configured ID.

WaterChain resolves a path through the entity graph. It reports **0**, **1**, or **2+** complete routes; `2` is a deliberate multiple-route sentinel, not an exact route count. Only one complete route can be considered for candidate-transition review. A route map is not proof of physical continuity or causation.

The next-action planner can recommend resolving a transfer reference, reconciling source identity, reviewing QC, collecting a missing-stage sample, or reviewing discordant results. It is rule-based and does not report fabricated expected information gain, cost, price or lab turnaround.

### Local original-file vault

Provenance artifacts store a SHA-256 and metadata. The application attempts to retain the selected original in IndexedDB (maximum 10 MB per file) and verifies byte length/hash before download. If browser storage fails, only fingerprint metadata is saved. Original files remain browser-local and are not embedded in JSON ledger exports. Hashes detect file changes; they do not authenticate who created a document or whether its contents are true.

### Water Quality Uganda adapter

See [`research/datasets/README.md`](research/datasets/README.md). Download the four dataset CSVs from the official maintainers, keep them unchanged, and run the local adapter. The adapter profiles source records, join quality, sample-type counts, censored TNTC results, lab blanks, and strictly matched within-visit transport/storage pairs. The dataset is observational and `visit_id` does not prove an actual physical transfer; it is not causal ground truth. See [`validation/STEP12_NOVELTY_AND_PRIOR_ART.md`](validation/STEP12_NOVELTY_AND_PRIOR_ART.md) for what is and is not being claimed as novel.

### Step 12 checks

```bash
python -m unittest discover -s engine -p "test_*.py" -v
python -m unittest discover -s research/datasets -p "test_*.py" -v
python engine/evaluate.py
python engine/run_holdout_validation.py
python engine/build_reproducibility_manifest.py
```


## Step 12 — current verification status

The current audit is documented in [`TEST_REPORT.md`](TEST_REPORT.md) and [`RESEARCH_DATA_AUDIT.md`](RESEARCH_DATA_AUDIT.md). The audit report records 79 engine tests, 12 adapter tests, the 15-scenario synthetic evaluation, the 16-case synthetic holdout, and profiling of the four published Water Quality Uganda CSVs (the original CSVs are not bundled). It also records a successful `npm ci`, typecheck, lint, production build, API checks, and 45 passing browser tests across a full run plus targeted reruns—not one single 45-test run. Those frontend and browser results were executed in the audit environment; they could not be independently reproduced in every environment because package-registry access can time out. See `TEST_REPORT.md` for the exact accounting and limitations. The older `validation/STEP12_VERIFICATION.md` and `BROWSER_TEST_REPORT.md` are retained as historical snapshots and are explicitly superseded by the final audit reports.


## Step 16 — Decision Sensitivity Studio

See `STEP16_VERIFICATION.md` for the current build/test status and `tests/e2e/decision-robustness.spec.ts` for browser regression coverage. This is a rule-engine sensitivity tool, not a calibrated robustness measure or proof of contamination origin.

## Step 17 — Blinded independent-review workbench

The new **Blind validation** tool prepares a de-identified JSON packet from investigations with current diagnostic reviews, exports a blank reviewer CSV, and imports a completed CSV after an external reviewer has assessed the packet. It keeps engine decisions and alias-to-record mappings in a separate browser-local private key, and compares reviewer decisions with the rule engine only after the response has been frozen/imported.

The exported packet omits expected decisions and exact source identifiers. Response imports require the exact packet ID, packet-specific case IDs, a pseudonymous reviewer code, an ISO review date, a meaningful rationale, and only valid per-case aliases for cited records. Reusing a reviewer code or importing a response from another packet is rejected. The private packet SHA-256 is verified before download/import; tampered packet content blocks use.

The private key and returned reviewer sessions remain in browser-local storage. This is a single-user review utility, not secure multi-user infrastructure. A user with access to the browser profile can modify local storage. No independent review is implied until an actual reviewer returns a frozen response. Reviewer-engine agreement is descriptive and not diagnostic accuracy.

Read `validation/STEP17_INDEPENDENT_REVIEW.md` for reviewer instructions and the recommended independent review protocol.

### Step 17 tests

```bash
npm run test:independent-review
npm run test:independent-review-e2e
npm run validate:manifest
```

The unit tests can run with the project's TypeScript dependency installed. The Playwright tests require `npm ci`, the supported Python runtime, Chromium/Playwright setup, and the application configuration described in `STARTUP_GUIDE.md`.

### Step 17 persistence integrity hardening

On startup and before appending reviewer responses, the blind-review workbench validates every saved reviewer session against the selected packet's private manifest. It checks packet ID, case completeness, per-case record aliases, reviewer metadata, dates, decisions, rationale, and duplicate reviewer codes. Stored comparison summaries are recalculated from validated responses. If saved reviewer data fail validation, the existing browser-local data are preserved and the responses are not used. This is a local integrity safeguard, not authenticated storage or protection against an attacker who can modify the entire browser profile.
