# Step 17 changelog

## Added — Blinded independent-review workbench
- Prepare anonymized reviewer packets from investigations with current diagnostic reports.
- Keep expected engine classifications and original-record alias mappings in a separate local private key; exclude engine conclusions from the exported packet.
- Export a response CSV template and import completed reviewer sessions.
- Compare each reviewer's decision/stage with the prototype engine and calculate pairwise inter-reviewer decision agreement when at least two reviewers rate the same case.
- Export a comparison report while explicitly stating that agreement is not accuracy or a gold standard.

## Hardening performed during implementation
- Packet-scoped random case IDs prevent case identifiers from colliding across separate packets.
- Reviewer responses now include the exact packet ID on every row; cross-packet response imports are rejected.
- Supporting evidence aliases are validated against the alias map for that exact case.
- Candidate-transition responses require a valid candidate stage, at least one known support alias, and a meaningful rationale.
- Reviewer code/role/date consistency and valid ISO dates are enforced.
- Duplicate reviewer sessions are rejected instead of silently overwriting previously imported responses.
- Packet JSON receives a SHA-256 fingerprint in the local private key; missing/corrupted/tampered packet data blocks download and response import.
- Added Node-based unit tests and Playwright browser regressions for the blind review workflow, multiple reviewers, invalid CSVs, cross-packet imports, alias validation, persistence and packet tampering.

## Not changed
- No Python diagnostic decision rule was changed.
- No synthetic results were added to the real evidence register.
- No independent reviewer has been assumed or fabricated.

## Additional hardening after release audit
- Persisted reviewer sessions are revalidated against the exact private packet manifest when restored and before a new reviewer response is appended.
- Stored summaries are recomputed from validated response rows instead of trusting mutable localStorage summary values.
- Invalid/tampered saved sessions are not loaded and are not overwritten by a subsequent import.
- Added regression coverage for tampered stored summaries, cross-packet response rows, aliases cited from another case, and duplicate reviewer codes.
