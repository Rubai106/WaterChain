# WaterChain Step 9 — Change log

## Changes

1. **Per-investigation diagnostic cache:** the latest API response is saved under `waterchain:diagnostic-review:v1:<workspaceId>`. Cache content is schema-validated on read. Invalid cache values are left untouched and reported to the user.
2. **Fingerprint-based staleness:** the saved `analysedFingerprint` is compared with the current record list. A changed record set marks the review stale and prevents review-bundle export. Export uses the current records only while their fingerprint matches the saved review.
3. **Storage failure transparency:** a successful review is still shown if localStorage cannot save it, but the UI warns that the report will not survive a reload and recommends exporting the bundle.
4. **Clearer evidence-status language:** “Metadata clear” was changed to “No register flags,” with an explanation that engine eligibility is stricter and the engine findings state its exclusion reasons.
5. **CSV data-loss prevention:** duplicate record codes inside a CSV or already in the active investigation are row errors. Unknown header columns are rejected rather than silently ignored.

## Explicitly not changed

- No synthetic sample data is added to the product UI.
- No diagnostic algorithm, evaluation label, or reported performance score is changed.
- No cloud sync, server-side persistence, authentication, or independent scientific validation is claimed.

## Verification

The Step 8 Python test suite and synthetic evaluation were rerun after packaging preparation. The local environment could not complete `npm ci` due to a registry timeout, so the Step 9 TypeScript typecheck, lint, production build, and real-browser checks remain **not verified in this environment**. They must be run using `STARTUP_GUIDE.md` before demoing this Step 9 package.
