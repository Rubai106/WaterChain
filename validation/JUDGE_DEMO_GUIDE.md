# WaterChain judge-demo guide (Step 8)

This guide is for a truthful, practical demonstration. Do not insert synthetic results into an investigation or present a controlled test fixture as a real household/laboratory record.

## Two-minute setup checklist

1. Use Node.js 20.9+ and Python 3.10+.
2. Run `npm install`, `npm run typecheck`, `npm run lint`, and `npm run build`.
3. Run the Python checks listed in the root README.
4. Open the application locally, create a named investigation, reload the page, and confirm the workspace still exists.
5. Create a second empty investigation, switch between them, and verify that record counts do not leak across workspaces.
6. If using actual records, confirm that the submitter has permission to use them and that personally identifying household details are omitted.

## Suggested 3-minute live walkthrough

### 0:00–0:30 — Explain the real problem

WaterChain is a prototype for checking whether sample identity, timing, method/QC information, and batch lineage are sufficient to support a candidate contamination-pathway hypothesis. It is not a water-safety certification tool.

### 0:30–1:10 — Show case isolation and evidence intake

Create an investigation with a neutral descriptive name. Enter or import only documented sample records. Show the per-record metadata flags. Explain that missing information stays missing and the system does not invent results.

### 1:10–2:10 — Run a diagnostic review

Run the Python rule engine on the currently selected investigation. Explain eligible versus excluded records, pathway lineage, warnings, and the recommended evidence step. If the real evidence is incomplete, demonstrate that the correct outcome is abstention—not a forced culprit.

### 2:10–2:40 — Show traceability

Export the review bundle and show the investigation name/ID, evidence fingerprint, run time, report, and the included records. Explain that a SHA-256 hash detects changes to the bundled bytes but does not authenticate the truth of a record.

### 2:40–3:00 — Be explicit about limits

State that current validation is synthetic software-fixture testing. No independent external reviewer or real-world diagnostic study has been completed unless one has actually occurred and is documented.

## If no legitimate sample data is available

Do not fabricate a realistic-looking case. Show the empty investigation and its abstention behavior, then run `python engine/evaluate.py` in the terminal and explain that its synthetic scenarios are software tests only. Keep the CLI fixtures and their reports separate from the app's live case register.

## Judge questions to prepare for

- **What is novel?** The proposed contribution is the integrated evidence-integrity/lineage gate and explicit abstention workflow. Do not claim that probabilistic source localization or adaptive sampling is globally new.
- **How is it validated?** Currently with deterministic developer-authored synthetic fixtures and adversarial tests. Independent review and field validation remain future work.
- **Can it prove which stage introduced contamination?** No. At best it reports a candidate transition under strict assumptions and still requires independent scientific review.
- **Is it production-ready?** No. It is a local prototype with browser storage and a Next.js-to-Python subprocess bridge. Authentication, shared case storage, deployment hardening, and field validation remain open.

## Step 8 case-isolation and restore checks

Before the demo, perform this short data-safety check with empty investigations (no fabricated evidence needed):

1. Create Investigation A and Investigation B.
2. Enter actual records into A only; switch to B and verify B remains empty; switch back and verify A records remain.
3. Export a JSON evidence backup from A; restore it and verify WaterChain creates a separate `Restored — ...` investigation without overwriting A.
4. Run a diagnostic review in A, export the review bundle, then restore that bundle as another new investigation. The restored case should not display the prior report until a fresh review is run.
5. Reload the app and confirm the new investigations persist.

Do not use fabricated sample results to pass this interface check. Empty cases are sufficient to test case creation, switching, and persistence; record restore should use an actual backup created from records you are authorized to handle.
