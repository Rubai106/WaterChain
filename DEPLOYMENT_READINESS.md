# WaterChain Step 12 — Deployment Readiness

Readiness is judged at three separate levels. Conflating them is the most
likely way this project gets oversold.

| Level | Verdict |
|---|---|
| Competition demo (BCS ICT Fest project showcasing) | **READY**, with the precautions in `STARTUP_GUIDE.md` |
| Pilot with an expert collaborator (WASH / laboratory reviewer) | **READY to pilot**, as a decision-support prototype under expert supervision |
| Actual operational deployment (public-health decisions, multi-user service) | **NOT READY** |

## Current deployment shape

The shipped application is entirely browser-local: investigations, evidence,
relationship models, reports, and the audit ledger live in `localStorage`;
original provenance files live in IndexedDB on one browser/device. There is
no authentication, no server-side storage, no cloud sync, and no Supabase
code anywhere in `app/`, `lib/`, or `components/` (verified by search). The
`supabase/migrations/` file is a reference migration only. Clearing browser
storage deletes the investigation and any locally retained originals; JSON
backups/ledger exports are the only portability mechanism, and exported
ledgers deliberately exclude file bytes.

## Supabase migration — static analysis (no live database available)

File: `supabase/migrations/202610280001_waterchain_relational_foundation.sql`.
Live application of the migration and all live security tests are **BLOCKED**
(no test database, no credentials used, no real database touched). What
static review establishes:

**Present and sound**

- All 8 tables carry `owner_id uuid NOT NULL REFERENCES auth.users(id) ON
  DELETE CASCADE`, and every child row repeats `owner_id` with composite
  foreign keys `(id, owner_id)` so a child cannot reference another owner's
  parent (e.g. journeys → investigations/sources, sampling events →
  journeys/evidence, transfers → journeys).
- Unique constraints: source identifier per owner (case-insensitive),
  record code per investigation (case-insensitive), one sampling event per
  (journey, evidence record), one audit event per (owner, event hash).
- Useful indexes: evidence by (investigation, stage, collected_at).
- Check constraints mirror the app rules: stage enums, analyte/result/
  control enums (identical value sets to `lib/evidence.ts`), transfer
  adjacency (only source→collection→storage→serving), documented transfers
  require a source reference, observed transfers require a reference or
  note, quantified results require a value and unit, numerics are
  non-negative, SHA-256 format is enforced, closed journeys require a
  closeout note.
- Row-level security is enabled on all 8 tables with owner-scoped
  select/insert policies everywhere, update/delete policies on the 7 mutable
  domain tables, and insert-only policies on `waterchain_audit_events`
  (no update/delete policies: append-only at the policy surface), with an
  additional guard that a client cannot write an arbitrary `actor_user_id`.
- The migration itself documents its two main caveats: a database
  owner/service role can bypass RLS, and audit `journey_id` intentionally
  has no foreign key so history survives journey deletion.

**Divergences to reconcile before any activation**

1. `waterchain_sampling_events.water_entity_ref` is `NOT NULL` in SQL, but
   the frontend schema allows it to be null (the engine then flags the
   event as unlinked). A migrated app must either require it at write time
   or relax the column.
2. `waterchain_sources.source_identifier` is `NOT NULL` in SQL, but the
   frontend schema allows null (unmapped source). Same reconciliation
   needed.
3. No database constraint can enforce hash-chain linkage
   (`previous_event_hash` → prior `event_hash`); chain integrity would
   still depend on application-level verification, exactly as in the
   browser-local ledger.
4. `create extension if not exists pgcrypto` needs sufficient privilege in
   the target project; confirm before applying.

**What static review cannot establish**: that RLS actually blocks a second
user in practice, that the migration applies cleanly to a fresh project,
transactional behaviour under concurrent edits, or backup/restore behaviour.
All of those require a disposable Supabase project and must be tested before
any shared use. The presence of the schema and policies is not evidence of
a secure deployment.

## What would be required for operational deployment

- A disposable-database migration test (apply, exercise RLS as two users,
  verify cross-owner access is denied, test cascade deletes and audit
  append-only behaviour).
- Authentication with a real identity provider, and replacement of the
  local `actorLabel: 'Local browser user'` with authenticated actor identity.
- Server-side audit events (the browser ledger must not be the system of
  record once data leaves one device).
- Reconciliation of the two nullability divergences above, plus a
  server-side mirror of the engine's eligibility and route gates (the
  browser must not be the only enforcement point).
- Backup/restore and data-export testing, accessibility testing beyond the
  checks in this audit (screen reader), and the independent WASH/laboratory
  review described in `SCIENTIFIC_VALIDATION_REPORT.md`.
- Incident handling for storage loss: localStorage/IndexedDB deletion today
  silently removes investigations and originals except for exported files.

## Demo precautions (unchanged from Step 11, still required)

Pre-import a linked case and an off-pathway contrast case; keep JSON backups
ready; re-run review after any live evidence edit; state the
one-complete-path rule aloud once; never present synthetic evaluation
conformance as real-world accuracy; never present the browser-local ledger
as tamper-proof or authenticated; never describe a hash as proof that a
document is genuine.
