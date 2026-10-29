# WaterChain browser tests (Playwright)

These tests run against a production build of the real application and
the real Python diagnostic engine through `/api/diagnose`. They use
Playwright's isolated browser contexts, so test cases never touch a
real user's investigations. Every case is a synthetic QA fixture
(`QA-`, `QB-`, `QC-`, `QN-`, `QS-`, `QD-`, `QL-` prefixes).

## Run

```bash
npm ci
npm run build
npm run start -- -p 3107   # or let the webServer in playwright.config.ts start it
npx playwright install chromium   # first run only
npm run test:e2e
```

In a sandbox without the Playwright browser cache, set
`PLAYWRIGHT_CHROMIUM_PATH` to an existing Chromium binary, or run
`npx playwright install chromium` first. The config reuses an
already-running server on port 3107 when one exists.

## What is covered

- `pathway.spec.ts` — engine-authoritative stage states: empty,
  unresolved-before-review, clean eligible positive, blocked
  positive (failed blank control), valid negative, incomplete,
  conflicting, and lineage-failure evidence.
- `workflows.spec.ts` — creation/switching/isolation, report
  persistence, manual entry, stale protection + disabled export,
  CSV rejection, backup/restore + malformed backups, keyboard
  focus + accessible labels, responsive pathway, console errors.
- `screenshots.spec.ts` — screenshots of the actual running app
  into `tests/screenshots/` (workspace, pathway states,
  diagnostic results/limitations, mobile, stale).
- `step11-audit.spec.ts` — independent Step 11 audit tests written
  for the verification pass (off-pathway labelling and counts,
  stale hiding across reload/switch/rapid edits, unique manual
  codes and internal ids, CSV duplicate scope, CSV edges, CSV
  and bundle exports, tampered-bundle rejection, branding and
  console cleanliness). Fixtures are `audit-*.csv` in `fixtures/`.
- `step11-screenshots.spec.ts` — captures
  `pathway-off-pathway-positive.png` and
  `diagnostic-stale-disclosure.png` into `tests/screenshots/`.

Screenshots are evidence of the running app, not mockups, and
their cases are synthetic fixtures.

## Step 11 regression coverage

The pathway tests also assert that an eligible positive result from a different/unselected batch is shown as off-pathway, not as a positive on the selected pathway. The workflow tests assert that stale diagnostic conclusions are hidden until explicitly expanded and that two manual entries receive distinct user-visible record codes. These new E2E checks are included in `tests/e2e/pathway.spec.ts` and `tests/e2e/workflows.spec.ts`. Run them with `npm run test:e2e` after installing dependencies and a Chromium browser.


## Step 12 explicit journey model

`step12-journey-model.spec.ts` exercises explicit sample-event and transfer relationships, no-common-batch review, source ID mapping failures, missing source/transfer references and browser-local provenance-file storage/hash recheck. The test uses synthetic records and a synthetic text file that is explicitly not a lab report.

`step12-audit.spec.ts` is the independent Step 12 audit suite: a record
linked to a second journey shows a cross-journey warning; the vault rejects
files over 10 MB and stores empty and unicode-named files; corrupting a vault
blob in IndexedDB is detected on reload and blocks download; tampering a
stored audit event breaks live hash-chain verification; an exported ledger
re-verifies while a tampered export fails; and the journey workbench renders
at a 390 px viewport with reduced-motion hero animation disabled.

Note on linked-row assertions: the journey linked-events list shows the
auto-generated record code (e.g. `EV-…`), not the sample code entered in the
register. Assertions on a linked row must therefore use the record code
taken from the link form's option label (`RECORD-CODE · SAMPLE-CODE`), not
the sample code alone.


## Step 14 — Risk & Control Register

`e2e/risk-control-register.spec.ts` covers hazard entry, screening labels, control lifecycle, evidence-backed implementation/effectiveness review, self-review rejection, corrective ActionLoop integration, risk closure gating, evidence-snapshot staleness, reload persistence, and per-investigation isolation. Run with `npx playwright test tests/e2e/risk-control-register.spec.ts` after dependencies and Chromium are installed.


## Step 15 — Temporal evidence & sampling planner

`e2e/temporal-evidence.spec.ts` covers empty-state behaviour,
chronological ordering, undated-record disclosure, repeat-result
interpretation, stale-report behaviour, and the ActionLoop draft
handoff. Run with `npx playwright test tests/e2e/temporal-evidence.spec.ts`
after dependencies and Chromium are installed.

## Step 16 — Decision Sensitivity Studio

`e2e/decision-robustness.spec.ts` covers single-record omission runs
through the real `/api/diagnose` endpoint, preservation of the original
evidence, "Decision changed" comparison pills, sensitivity-report export
(schema, fingerprint format, and absence of raw evidence rows),
stale-report unmounting of the panel after evidence edits, and
export re-verification (a genuine export verifies; a tampered export is
flagged "altered after export"). Run with
`npx playwright test tests/e2e/decision-robustness.spec.ts` after
dependencies and Chromium are installed.

## Step 17 — Blinded independent review

- `tests/unit/independent-review.test.cjs` tests packet-bound response CSV templates, valid response parsing, packet mismatch rejection, invalid record aliases, candidate support citation requirements, invalid dates/rationales, duplicate/unknown case handling, multi-reviewer comparison summaries, anonymization fields, and CSV formula guarding. It transpiles the TypeScript utility through the project's `typescript` package and runs via Node's built-in test runner.
- `tests/e2e/independent-validation.spec.ts` tests actual packet export through the workbench, absence of engine outcomes/raw identifiers in the exported JSON, importing one and two reviewer responses, stored sessions across reload, rejection of duplicate rows, unknown cases, packet mismatch, unknown aliases, and detection of a tampered saved packet that then blocks download/import.

No external reviewer is simulated as a real reviewer. Test CSVs are synthetic fixtures and test only the workflow.
