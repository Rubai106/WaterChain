# WaterChain Step 12 — Bug Fix Summary (independent audit)

Supplied archive: `WaterChain_Step12_Scientific_Foundation.zip`
(md5 `9c76d20d58326a73153d11207ecde2b0`, preserved untouched in the audit
working area). The supplied `STEP12_VERIFICATION.md` honestly reported its own
gaps: `npm ci` had timed out there, so typecheck, lint, build, and browser
tests were NOT rerun by the supplier, and the real Uganda dataset was NOT
processed. This pass closes those gaps. Every fix below was verified by
re-running the affected suite; no diagnostic decision rule was weakened to
improve a score.

## Defects found in the supplied ZIP

### D1 — HIGH — Production build and typecheck failed (audit-trail caller type)

`npm run typecheck` failed (exit 2) and `npm run build` failed (exit 1):

```
components/journey/WaterJourneyWorkbench.tsx(188,26): error TS2345:
Property 'actorLabel' is missing in type '{ eventType; entityType; entityId; summary }'
```

Root cause: `enqueueAudit` declared its input as
`Parameters<typeof appendAuditEvent>[1]`, which still requires `actorLabel`,
even though `enqueueAudit` itself supplies `actorLabel: 'Local browser user'`
before calling `appendAuditEvent`. The sibling helper `patchStore` already
used the correct `Omit<..., 'actorLabel'>` shape.

Fix: `enqueueAudit` now takes
`Omit<Parameters<typeof appendAuditEvent>[1], 'actorLabel'>`.
No runtime behaviour changed; the audit events produced are identical.
Verified: `npm run typecheck` exit 0, `npm run build` exit 0.

### D2 — HIGH — Lint failed (unescaped entity + Node script linted as app code)

- `components/journey/WaterJourneyWorkbench.tsx` line 512: an unescaped
  apostrophe in JSX text (`engine's`) tripped `react/no-unescaped-entities`
  (an error under the Next.js config, and the reason `next build` failed even
  apart from D1). Fixed with `&rsquo;`.
- `scripts/check-typescript-syntax.cjs` uses `require()`, which is idiomatic
  for a `.cjs` Node script but was flagged by `@typescript-eslint/no-require-imports`.
  Fixed by adding `scripts/**/*.cjs` to `globalIgnores` in
  `eslint.config.mjs` (the script itself is unchanged and still runs).
- Also removed now-unused imports flagged by lint in
  `WaterJourneyWorkbench.tsx` (`evidenceRecordSchema`, `stageLabels`,
  `WaterJourney`, `WaterSource`, `SamplingEvent`, `TransferEvent`) and the
  unused `model` parameter of `planNextActions` in
  `lib/investigation-model.ts` (its only caller updated accordingly).

Verified: `npm run lint` reports 0 errors and 1 pre-existing warning
(`react-hooks/exhaustive-deps` in `app/page.tsx` line 138, already present in
Step 11 and unrelated to Step 12).

### D3 — MINOR (engine) — Duplicate transfer IDs were silently accepted

The engine flagged duplicate *sampling-event* IDs but never checked
*transfer* IDs: two transfer rows sharing one ID were silently merged by the
adjacency-set path resolver, so a duplicated transfer ledger row produced no
finding at all. The brief lists duplicate transfer IDs as a case the model
must handle.

Fix (`engine/diagnose.py`, `_explicit_journey_review`): a transfer hygiene
pre-pass now flags a missing or duplicated transfer ID as a blocker finding
(`duplicate_transfer_id`) and drops the duplicate row before path resolution.
Regression tests added in `engine/test_explicit_journey.py`
(`TransferHygieneTests.test_duplicate_transfer_ids_are_flagged`).
A duplicated row still cannot change the attribution outcome (adjacency sets
dedupe), so this is an audit-integrity fix, not a wrong-attribution fix.

### D4 — MINOR (engine) — Reversed / non-adjacent transfers were silently ignored

A transfer running backwards (e.g. storage → collection) or skipping a stage
(e.g. source → storage) matched no forward adjacent boundary, so the engine
ignored it without any finding. The web API's zod schema already rejects such
rows (400), but the engine used directly (CLI, future callers) did not.

Fix (same pre-pass): non-adjacent or reversed transfers now produce a blocker
finding (`transfer_not_adjacent`) and are excluded from path resolution, and
transfers belonging to another journey produce `transfer_journey_mismatch`
(matching the existing sampling-event journey check). Regression tests added
for reversed, non-adjacent, and foreign-journey transfers. Documented
transfers that skip a stage should be described in notes and assessed
separately, per the model contract — they are not silently joined into a path.

### D5 — MINOR (UI) — One record could silently support two journeys

`linkedRecordIds` in the journey workbench only considered the *selected*
journey, so the same evidence record could be linked to a second journey in
the same investigation with no indication anywhere. The engine judges one
journey model at a time and cannot detect this, so one observation could
support two candidate transitions without the reviewer noticing.

Fix (`WaterJourneyWorkbench.tsx`): linked rows now show
"Also linked to: <journey>" when the record appears in another journey, and
choosing such a record in the link form shows a non-blocking warning
explaining that the same observation would support two paths. Linking is
deliberately not hard-blocked: a shared comparison sample can be a legitimate
reason to link one record twice, but it must be visible, not silent.
Browser regression test: `tests/e2e/step12-audit.spec.ts`
("same record linked to a second journey shows a cross-journey warning").

### D6 — MINOR (UI) — An exported audit ledger could not be re-verified

The audit panel could verify the *live* hash chain and could *export* the
ledger as JSON, but there was no way to verify an exported file afterwards —
so an exported ledger handed to a reviewer could not be checked for tampering
in the app.

Fix: a "Verify exported ledger file" control in the audit panel reads a JSON
file (exported payload or bare event array), schema-checks every row with
`auditEventSchema`, and runs the same `verifyAuditChain` over it, reporting
"Exported ledger verified: N event(s), hash links intact" or the exact
failure point. Browser regression test covers both the clean export and a
tampered export (one summary edited) failing verification.

### D7 — MINOR (adapter) — Sample/visit date disagreements were unreported

The Uganda adapter audited visit-key joins and sample-type/visit mismatches,
but never compared a sample's `date_sampled` with its joined visit's
`date_sampled`, even though the dataset defines the visit date as the
collection date. A wrong-date join therefore passed silently.

Fix (`research/datasets/waterqualityuganda_adapter.py`): for samples joined
to a unique visit, a date disagreement is now recorded in
`data_profile.sample_visit_date_mismatch_rows` and
`sample_visit_link_audit.sample_visit_date_mismatches` (first 200 rows), with
a relationship warning explaining that a mismatch is a data-quality signal,
not proof of a wrong join, and is never repaired automatically. Regression
test added (`test_sample_visit_date_mismatch_is_reported_not_repaired`).

### D8 — TEST-SIDE (full-suite failures, no app defect) — Stale assertions in two specs

The first full Playwright run (40 passed, 4 failed) exposed three
test-side failures, all in assertions written against older UI copy or an
older row layout — the app behaviour underneath was correct in each case:

- The supplied `step12-journey-model.spec.ts` asserted that a linked
  sampling-event row contains the *sample* code (`WJ-SOURCE`, …). Linked
  rows show the auto-generated *record* code; the sample code appears
  only in the link form's select option label
  (`RECORD-CODE · SAMPLE-CODE`). Fixed the helper to parse the record
  code from the option label and assert that (the same pattern this
  pass's own `step12-audit.spec.ts` already used).
- The Step 11 `step11-audit.spec.ts` A2 test asserted the serving stage
  card contains the literal word `off-pathway`. The supplied Step 12
  tree reworded that card note to "1 additional eligible record(s) are
  not included in this pathway" (verified present in the supplied ZIP,
  not introduced by this pass). The exclusion is still explicit on the
  card (`On pathway: 1 of 2` + the note), and the stage detail panel
  retains the exact `Eligible · off selected pathway` label, which the
  test still asserts. Updated the card assertion to the current wording.
- Two further stale strings in the same supplied journey spec surfaced
  only after the helper fix let the tests reach the report assertions:
  the explicit-journey test expected "earliest observed positive is at
  Storage", while the engine conclusion uses the app's stage display
  name "Household storage" (the observation itself — earliest positive
  at the storage stage, candidate transition only — was correct); and
  the mismatch test expected the blockers panel to say "source ID
  mapping conflicts", while the panel says the source ID "does not
  match the selected source mapping" (the engine report's finding label
  is asserted separately and passes). Both assertions were updated to
  the app's actual wording; no app copy was changed to satisfy a test.

### D9 — MINOR (UI) — Transfer-form validation was unreachable behind native `required`

In the supplied tree, the transfer form's two entity-ID inputs carried
HTML `required` attributes while the reference input did not. Submitting
an empty documented transfer therefore tripped native browser validation
before the React handler ever ran: no in-app error appeared, and a stale
error from an earlier form stayed on screen, misleadingly. The supplied
journey test expected the handler's friendly message
("A documented transfer requires a real field-log or source-document
reference.") and failed for exactly this reason.

Fix (`components/journey/WaterJourneyWorkbench.tsx`): removed the two
native `required` attributes. No validation was weakened — the handler
still rejects a documented/observed transfer with missing entity IDs
("Directly supported transfers require both the physical from-entity ID
and to-entity ID.") and rejects a missing reference first, now with the
friendly message reachable in all cases. This also makes the transfer
form consistent with the link form, which already relied on handler
errors. The supplied journey test now serves as the regression test.

**Verification status for D8/D9: CONFIRMED.** The three affected specs
re-ran against a fresh production build: 24/26 passed, with the only
failures the two journey-model link tests failing on the helper-ordering
detail (option text read after the click) — fixed by reading before the
click, plus the two further stale strings above. The journey spec then
re-ran **5/5 passed**, and the step11-audit (including A2), step12-audit
(including the new planner-UI test), and transfer-validation tests all
passed in the three-spec re-run. See TEST_REPORT.md §6 for the composed
full-suite accounting.

## Verified correct — no change made

- **Explicit-journey gates** (independent probe, 38 cases): valid linked
  journey with four different batch IDs permits a candidate transition;
  missing source registration, source mismatch, missing link/transfer/event,
  undocumented or unconfirmed links, observed-without-reference-or-note,
  duplicate sampling-event/record/sample IDs, ghost entities, branching
  (2 complete paths → abstain), discordant repeats, failed blanks/controls,
  missing method, unsupported analyte, NaN/infinity/boolean/negative
  quantified values, invalid and conflicting timestamps all abstain. A valid
  path mixed with a weak extra event conservatively abstains; a valid path
  with an incomplete extra branch still attributes on the resolved path.
  Positives outside the selected journey are reported as observations, not
  used in hypotheses.
- **Provenance vault**: 10 MB limit enforced; empty file stored with the
  well-known empty SHA-256; unicode filenames preserved; duplicate filenames
  allowed (distinct artifact IDs); IndexedDB blob corruption detected on
  reload (`HASH / SIZE CHECK FAILED`, download button withheld); removal
  deletes the stored blob as well as the metadata row.
- **Audit ledger**: live chain verification, tampered live event detection,
  and (after D6) exported-file verification. The ledger remains a
  browser-local tamper-evidence aid: anyone with access to the browser
  profile can rewrite the whole chain consistently, so it is not
  tamper-proof and not authenticated identity — this limitation is stated
  in the UI, the foundation doc, and `DEPLOYMENT_READINESS.md`.
- **Next-action planner**: every action names its target gap, explains what
  positive/negative outcomes would and would not establish, and lists
  prerequisites; no costs, durations, probabilities, or guaranteed
  information gain are invented. Sample actions target stages, never
  invented entities. Limitation (not a defect): the planner is stateless, so
  an action keeps appearing until its gap is resolved — there is no
  dismiss/defer control yet.
- **API contract**: missing Python, malformed engine output, and a 15 s
  engine timeout all return generic HTTP 503 with a request ID and no
  evidence echoed; invalid payloads return 400 with field paths only;
  explicit-journey payloads round-trip through the API with
  `lineage_mode: explicit_journey`, `path_count: 1`, and correct
  `on_pathway` flags.

## Known limitations carried forward (not defects introduced here)

- `npm run test:engine` / `test:dataset-adapter` / `test:all-python` use
  bare `python`; this environment provides only `python3`. The suites were
  run with `python3` using the identical commands. The API route already
  defaults to `python3` on non-Windows. See `STARTUP_GUIDE.md`.
- The Supabase migration is reference-only and was NOT applied to a live
  database (no test database available); live RLS/ownership tests are
  BLOCKED. Static analysis findings are in `DEPLOYMENT_READINESS.md`,
  including two schema/frontend nullability divergences to reconcile before
  any activation.
- Screen-reader testing, Windows/macOS browsers, Node 20 / Python 3.10
  minima, remote CI, and field validation remain NOT TESTED (same as Step 11).
