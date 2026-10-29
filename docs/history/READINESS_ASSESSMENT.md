# WaterChain Step 11 — Readiness Assessment (BCS ICT Fest project showcasing)

Assessment date: 2026-10-28, after the independent verification
pass in TEST_REPORT.md. This assessment covers this package
only: the supplied `WaterChain_Step11_Fixed.zip` plus the
verification-pass fixes in BUG_FIX_SUMMARY_STEP11.md. It
supersedes the Step 8 assessment previously held under this
name. Verdict in one line: **yes, ready for a reliable
competition demonstration** — with the demo-day precautions
below, which are about presentation, not about hidden defects.

## 1. Does the production build succeed?

**Yes.** `npm ci` from the existing lockfile (exit 0),
`npm run typecheck` (exit 0), `npm run lint` (0 errors, 1
pre-existing warning), `npm run build` (exit 0), homepage and
favicon both 200 on the production server. The supplied Step 11
report's BLOCKED items (typecheck, build, browser tests) were
blocked only by a timed-out install in its environment; all of
them execute here.

## 2. Does the application genuinely run?

**Yes.** The full app was exercised in Chromium against the
production build and the real Python engine: 33/33 browser
tests, plus direct API calls, plus engine-failure simulations
in a scratch copy. Investigations, evidence intake, diagnostic
review, staleness, backup/restore, and exports were all driven
through the UI, not inspected statically.

## 3. Did the real browser-to-API-to-Python workflow pass?

**Yes.** Every diagnostic run in the browser suite goes
browser → `/api/diagnose` → Python subprocess → report, with
engine name, request id, and SHA-256 fingerprint visible in the
UI. Failure modes were simulated separately: missing Python,
malformed engine output, and a 15-second timeout all produce a
generic HTTP 503 with no evidence echoed.

## 4. Did all three Step 11 fixes pass browser-level tests?

**Yes, all three, independently re-tested (not just re-run from
the supplied suite):**

- **Off-pathway evidence:** unrelated-batch positives are
  labelled off-pathway, counted as `On pathway: 0`, and cannot
  support a candidate transition; linked + off-pathway records
  at one stage are shown side by side with the correct verdict
  per row.
- **Stale reports:** the old conclusion is hidden by default
  behind an explicitly labelled disclosure; no export of the old
  report as current is available; the state survives reloads
  and investigation switches and clears on a fresh review;
  rapid edits and double review clicks settle on the latest
  evidence.
- **Unique record codes:** rapid manual creation yields unique
  codes and unique UUID internal ids; the generator function
  itself was executed for format, collision retry, bounded
  failure (20 attempts), and 200 same-second generations;
  CSV duplicates are rejected per investigation (case and
  whitespace included) without losing saved evidence.

## 5. Do persistence, stale protection, and isolation work?

**Yes.** Reports persist across reloads and investigation
switches; stale detection follows the correct investigation's
fingerprint; restored backups create a separate investigation
and never overwrite an existing one; tampered review bundles
are rejected by their SHA-256 check.

## 6. Did the complete test suite pass?

**Yes.** Typecheck, lint, build, Python 52/52, evaluation
(100% / 20.0% / 100% / 0%), holdout (16/16, 0/13 unsupported),
reproducibility manifest (52 tests, 44 files, 0 missing), and
Playwright 33/33. No diagnostic decision rule changed, so both
synthetic baselines are identical to Step 10 — which is the
expected result, not a regression.

## 7. Which defects were fixed in this pass?

Only test-side defects and one UI label (see
BUG_FIX_SUMMARY_STEP11.md for the full list): three outdated
pathway-test expectations, one stale-export assertion written
for the old design, the ambiguous duplicate `Add evidence`
button (renamed to `Go to evidence register`) plus a scoped
test-helper click, a hanging import helper for rejected CSVs,
three audit-test expectation errors, and one lint error. The
three supplied Step 11 app fixes themselves needed no changes.

## 8. Issues that remain (all known, none blocking a demo)

1. **Pathway-selection rule needs one spoken sentence.** A
   pathway exists only when one batch links all four stages.
   If a judge's test case has an excluded record at one stage,
   the other stages will read as off-pathway rather than as
   pathway negatives. This is correct per the engine and is
   explained in the UI's lineage note — say it out loud once
   before the demo case, and use a fully linked case for the
   headline transition.
2. **Stale archive is conclusion-only.** The disclosure shows
   the old conclusion and metadata, not the old full panels.
   That is the intended design; do not promise a full old
   report behind it.
3. **Browser-local storage.** Clearing site data deletes
   investigations. Demo with a JSON backup file ready, and
   preferably with the demo case already imported before the
   judges arrive.
4. **Pre-existing lint warning** (`react-hooks/exhaustive-deps`
   in `app/page.tsx`); warning only, no behaviour impact.
5. **Dialogs lack focus trap / Escape handling; no
   screen-reader walkthrough** has been done. Do not claim
   accessibility beyond keyboard focus and aria labels, which
   were tested.
6. **Coverage limits:** Chromium on Linux only; Node 24 /
   Python 3.12 here (minima Node 20.9 / Python 3.10 untested);
   no remote CI; no external scientific review or field
   validation. All evaluation figures are synthetic fixture
   conformance — never describe them as real-world accuracy.
7. **Fonts need network.** Google Fonts fall back offline;
   appearance is unchanged in substance but type may differ
   from a connected machine.

## 9. Demo-day checklist (from the verified behaviour)

- Run `npm ci`, `npm run build`, `npm run start -- -p 3107`
  (or any free port; update `playwright.config.ts` only for
  tests). Confirm the homepage loads and Python 3 is on PATH
  — without it, reviews return a generic 503 (tested).
- Pre-import the headline case (linked 4-stage batch with a
  serving positive) and one contrast case (off-pathway
  positive) so both labels can be shown without live typing.
- Keep a JSON backup of each demo case on a USB stick or
  second device.
- If a judge edits evidence live, re-run the review before
  interpreting anything — the UI will say the report is stale
  and hide the old conclusion, which is itself a good thing
  to demonstrate.
- Say the one-sentence pathway rule (item 8.1) and the
  abstention rule (a positive is an observation, never proof
  of origin) before showing a transition.

## 10. Bottom line

The project is ready for a reliable BCS ICT Fest
project-showcasing demonstration. The three Step 11 fixes do
what they claim, the complete suite passes, failure modes are
handled without leaking evidence, and the remaining items are
documented presentation precautions rather than defects.
