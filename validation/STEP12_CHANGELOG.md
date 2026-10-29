# WaterChain Step 12 changelog

## Implemented

- Added explicit source, water-journey, sample-event, water/container entity, and transfer-event model alongside legacy batch review, including recorded source-ID mapping and administrative workflow lifecycle states.
- Added source-ID mapping and reconciliation with each selected journey's evidence records.
- Added referenced sample-event relationships and exact from/to transfer entity IDs.
- Added bounded 0/1/2+ entity-connected route resolution. 2 is a multiple-route sentinel, not an exact count.
- Added blockers and actionable next steps for no route, ambiguous routes, mismatched source IDs, missing references, missing stage evidence, QC, and discordant observations.
- Added local relationship audit events with hash chaining; documented that they are not authenticated identities or server-signed logs.
- Added investigation workflow lifecycle states (`intake`, `sampling`, `evidence_review`, `assessment`, `follow_up`, `closed`) and a required closeout note for administrative closure; this is not a water-safety certification.
- Added a browser-local IndexedDB file vault with a 10 MB per-file limit, SHA-256 verification, size checks, and explicit fingerprint-only fallback if file retention fails.
- Added a local Water Quality Uganda CSV profiler with hashes, visit/sample linkage audit, cautious handling of lab blanks and censored TNTC values, and precise transport/storage pair summaries only for eligible matched rows.
- Added adapter tests for duplicate visit/sample identifiers, ambiguous joins, invalid numeric values and malformed CSV shape.
- Expanded reproducibility-manifest builder to run both Python suites and both synthetic evaluation scripts and hash Step 12 inputs.
- Updated the optional future database reference migration with entity-reference fields needed by the model.

## Explicitly not activated

- No cloud authentication, live Supabase queries, multi-user sync or role management.
- No automatic download of the research dataset and no real dataset bundled.
- No causal labels, invented probabilities or real-world diagnostic performance claims.

## Verification caveat

Python unit tests and synthetic evaluation can be run locally with the included scripts. A full Next.js typecheck/lint/build and browser-to-Python test still requires dependency-enabled execution and should be marked blocked if the npm registry is not reachable.
