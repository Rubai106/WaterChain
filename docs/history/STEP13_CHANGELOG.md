# Step 13 changelog — ActionLoop MVP

## Added

- Per-investigation ActionLoop with manual actions and actions derived from current diagnostic findings, planner recommendations, and the engine's next-step recommendation.
- Required owner and creator labels, optional due date, priority, details, and links to existing evidence records.
- Workflow: Open → In progress → Awaiting verification → Verified & closed; plus reasoned return-for-work, cancellation, reassignment, editing, and reopening.
- Completion requires a note and at least one evidence reference or linked record. Verification requires a note, supporting reference or linked record, and a reviewer label that differs from the assigned owner's label.
- Per-investigation local persistence, action history, overdue sorting, filtering, source report freshness labels, and separate JSON action-log export.
- Three Playwright E2E tests for lifecycle, verification guardrails, persistence/isolation, transitions, and stale source context.
- Strict calendar date validation for due dates, including valid day/month combinations and leap-year handling.

## Scientific and integrity boundaries

- Creating, completing, verifying, or cancelling an action does not change a diagnostic finding or prove a hazard was removed.
- Linked evidence stores immutable internal record IDs with display snapshots. User-entered text references are not authenticated and may not point to retained files.
- The source report fingerprint is a consistency mechanism to surface stale context, not a signature or source-authentication mechanism.
- Actor names are self-entered and not authenticated. `localStorage` is mutable and not a secure server-side audit authority.
- ActionLoop records are stored separately from the evidence workspace backup; export the action register separately.
- No synthetic records, scientific outcomes, probabilities, or performance claims are seeded into the production investigation register.

See `STEP13_VERIFICATION.md` for test statuses and environment limitations.
