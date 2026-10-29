# Step 8 verification status

## Changes implemented

- Added multiple named investigations, each with its own locally persisted evidence register.
- Added separate-case creation, switching, and state reset behavior so one investigation’s evidence and diagnostic report do not carry into another.
- Added migration from the former `waterchain:evidence:v1` single-register key. The old key is removed only after the new case store is written successfully. If stored records are malformed, saving pauses and compatible records are visible in a read-only recovery view.
- Remounts the evidence register and diagnostic workbench when the selected investigation changes, preventing the prior case's report state from carrying into another case.
- Added a per-investigation JSON evidence backup and matching CSV filename, plus a restore flow for validated WaterChain backups and review bundles. Restore always creates a separate investigation, never overwrites the active case, and rejects malformed record schemas or a mismatched declared record count.
- Added guards that keep the manual evidence form from writing if storage becomes read-only while the dialog is open. Removed the registered-mark symbol from the wordmark to avoid implying trademark registration.
- Includes investigation ID/name in the exported diagnostic review bundle and download filename.
- Added a 5 MB restore-file limit and record schema checks; a backup is not treated as proof of evidence authenticity.
- Replaced obvious nonfunctional navigation/timeline placeholders with a working search-focus action, privacy notice, and an interpretation-guardrails section.
- Delayed CSV object-URL revocation to avoid prematurely revoking a download URL.
- Added a streaming 2 MiB request-body cap to the diagnostic API rather than reading arbitrary request bodies fully into memory before checking their size.
- Added GitHub Actions gates for Python tests, synthetic evaluations, TypeScript typecheck, ESLint, and a production build.
- Added a judge-demo guide that explicitly prohibits presenting synthetic test fixtures as real sample records.

## Checks run in the authoring environment (2026-10-28)

- Python unit suite: **35/35 passed**.
- Synthetic development holdout: **16/16 predeclared expected decisions matched**; all 13 cases expected to abstain did abstain.
- Original controlled evaluation: **15 synthetic fixtures** executed; results regenerated from the engine.
- TypeScript/TSX syntax diagnostics: **10 files checked, 0 syntax errors** using the available TypeScript transpiler.
- `package.json`: valid JSON.
- Python compilation: passed during the engine validation workflow.
- Frontend `npm install` / package-lock generation: timed out while requesting the npm registry.
- Full TypeScript typecheck, ESLint, Next.js production build, and browser-level workspace create/switch/backup/restore/API path: **not verified here**. Use the connected CI workflow and manual checklist before a judging event.

## Required manual QA before demo

- Create two empty investigations; add a record to only one and verify it never appears in the other.
- Reload the browser and confirm both cases and the active case selection persist.
- Export a JSON backup, restore it, and confirm it creates a new case with the same record content without modifying the source case.
- Export a diagnostic review bundle, restore it as a new case, and confirm no old diagnostic result is shown in that new case until the engine runs again.
- Verify malformed JSON, over-5-MB files, unsupported backup schema, mismatched record counts, and invalid evidence fields are rejected without partially importing records.
- Run `npm run typecheck`, `npm run lint`, `npm run build`, then test `/api/diagnose` in the browser with both empty and real evidence cases.

## Remaining risks

- Browser `localStorage` is not a secure, shared, or backed-up case database; users should export records and avoid sensitive personal data.
- The CI workflow is configured but has not yet run on a remote runner.
- No independent external reviewer, controlled physical-sample study, or real-world validation is claimed.
- Batch IDs are user-entered metadata. The current rule engine does not authenticate lineage or prove when contamination entered a water journey.

## Independent audit addendum — 2026-10-28 (corrected package)

The original Step 8 checks above were honest about their limits: the
frontend had never been built or run in the authoring environment. This
addendum records what an independent audit actually ran against this
corrected package; the full evidence is in the archived `../docs/history/TEST_REPORT.md`.

- `npm install` succeeded (Node 24.22.1, npm 10.9.4; `package-lock.json`
  generated during the audit is now included). Two blockers found and
  fixed: missing `autoprefixer` (production build failed) and an
  ESLint flat-config import that did not resolve (lint failed).
- TypeScript typecheck: PASS. ESLint: PASS (0 errors, 1 pre-existing
  warning). Production build: PASS. Homepage: HTTP 200.
- Python suite: 40/40 (35 original + 5 audit regression tests).
  Synthetic evaluation: 15/15 fixture accuracy 100%. Development
  holdout: 16/16 expected decisions matched.
- Live API: 19-case matrix plus failure modes (missing Python,
  garbage output, non-zero exit, 15 s timeout) all returned the
  expected HTTP status; SHA-256 fingerprints recomputed exactly.
- Browser (Chromium, desktop + mobile): investigation isolation,
  persistence, stale-report handling, CSV import/export, JSON backup
  and review-bundle restore, malformed-storage protection, and
  formula-injection guarding were all exercised and passed after fixes.
- Remaining: no independent external reviewer, no real-world study,
  and no remote CI run — those claims are still not made.
