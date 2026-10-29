# WaterChain deployment readiness checklist

**Current recommendation: local prototype only. Do not deploy with real sensitive evidence until all required controls below are implemented and verified.**

## Implemented in Step 7

- Request body cap (2 MiB), maximum 500 records, Zod validation of request records.
- Python subprocess uses argument-array invocation with `shell: false`, timeout and output cap.
- Python output is validated against the report schema server-side before sending a success response.
- Diagnostic failures return a generic client error with a request ID; detailed errors are logged without logging submitted evidence records.
- A SHA-256 fingerprint of normalized, sorted input records is returned to bind the report to the exact submitted evidence snapshot.
- UI can export a JSON review bundle containing the submitted evidence snapshot, report, request ID, engine version, hash, and privacy/interpretation notices. Export is disabled when the displayed report is stale.

## Required before deployment with real data

- [ ] Add authentication and authorization; limit each investigation to its owning users/roles.
- [ ] Add case/workspace isolation and a defined retention/deletion workflow.
- [ ] Decide whether evidence should leave the browser. Document location, processing, backups, and access policy before server-side storage.
- [ ] Use TLS and protect any external Python service with service authentication if subprocess invocation is replaced by HTTP.
- [ ] Run Node.js and Python as unprivileged users; pin and scan dependencies; use a reproducible lockfile and build image.
- [ ] Configure process/container resource limits, request rate limits, health checks, and operational alerts.
- [ ] Avoid logs containing water-source identifiers, lab notes, test values, or raw request bodies. Review platform and crash logs too.
- [ ] Define schema/API versioning and backward compatibility for imported records and exported review bundles.
- [ ] Conduct security review for uploaded CSVs, formula injection, output rendering, stored XSS, denial of service, and authorization failures.
- [ ] Verify database backup/restore and deletion if persistence is added.
- [ ] Run TypeScript typecheck, lint, production build, route-level HTTP tests, browser E2E tests, and container smoke tests in CI.
- [ ] Get independent domain review of the decision policy and a prespecified empirical validation protocol.

## Runtime architecture note

The current API route uses a local Python child process and is intended for a Node.js server/container that includes Python and the `engine/` directory. Do not assume it runs on serverless hosts that prohibit child processes or omit runtime files. Evidence records remain browser-local except for the records sent transiently to `/api/diagnose` during a review. No shared database or authentication is included.

## Evidence fingerprint note

The SHA-256 fingerprint is an integrity aid for comparing bundles, not a digital signature, trusted timestamp, identity proof, or proof that source records are authentic. Anyone with the data can recompute it. The exported JSON includes evidence fields and may be sensitive; share only with authorized reviewers.
