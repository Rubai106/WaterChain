# WaterChain ActionLoop — Step 13 guide

ActionLoop turns a diagnostic finding, planner recommendation, diagnostic next step, or manually entered follow-up into an assigned and reviewable action. It is designed to close the loop between identifying an evidence gap and documenting what was done about it.

## Workflow

1. Run a current diagnostic review.
2. In **ActionLoop**, create an action from a listed finding/recommendation or create a manual action.
3. Add a concise title, intended outcome, owner, creator label, optional due date, priority, and links to existing evidence records.
4. Start work. The status becomes `In progress`.
5. Submit completed work for verification. A completion note and at least one evidence reference or linked evidence record are required.
6. A verifier records a verification note plus at least one verification reference or linked evidence record. The verifier's self-entered name must differ from the assigned owner's name. Successful verification changes the status to `Verified & closed`.
7. A verifier can return the action for additional work; cancelled or verified actions can be reopened with a reason. Reassignment also requires a reason.
8. Use **Export action log** to download a JSON snapshot of actions and their transition history.

## Status meanings

- `Open`: created and assigned; work has not started.
- `In progress`: an actor recorded that work started.
- `Awaiting verification`: a completion note and supporting references were submitted.
- `Verified & closed`: a differently named, self-entered reviewer recorded a verification note and supporting reference.
- `Reopened`: a previously verified/cancelled action was explicitly reopened with a reason.
- `Cancelled`: stopped with a recorded reason; not treated as completed.

## Evidence links and provenance

ActionLoop links existing WaterChain evidence using an immutable internal record ID and a snapshot of the displayed record code, sample code, and stage. It can also record user-entered references such as a lab-report ID, sampling-event ID, file hash, or document location. A text reference is not the same as a retained attachment and is not authenticated by WaterChain.

The origin field keeps a snapshot of the finding/recommendation that motivated the action. If the diagnostic report becomes stale or changes, the action stays available but receives a stale-source label. Creating, assigning, completing, or verifying an action does **not** change the diagnostic finding or prove that a water-quality hazard was removed.

## Local storage, security, and limitations

- ActionLoop uses a dedicated localStorage key per investigation: `waterchain:action-loop:v1:<workspaceId>`.
- The action log is not currently included in the evidence-only workspace backup. Export it separately before clearing site data or switching browsers.
- Owner, creator, actor, and verifier names are self-entered labels. There is no authentication, authorization, server-side history, or cryptographic actor identity.
- The local history is useful for review and workflow traceability, but a user with access to browser storage can edit it. Do not call it a tamper-proof audit log.
- “Verified & closed” means a named reviewer recorded a workflow outcome and references. It does not authenticate the reviewer, establish laboratory validity, confirm water safety, or prove contamination causation.
- ActionLoop is a local single-browser prototype. Shared team access, permission enforcement, server-side storage, and database transactions are future work.

## Manual checks

1. Create a manual action with an owner and creator. Confirm it persists after reload.
2. Start work; try to submit without a completion note and without evidence. Confirm it is rejected.
3. Add a completion note and a reference or record link; submit for verification.
4. Try to verify using the assigned owner's name. Confirm it is blocked.
5. Verify with a different self-entered name, note, and reference. Confirm the action closes and history contains all transitions.
6. Return an action for more work, reassign with a reason, cancel with a reason, and reopen a closed action.
7. Create an action from a diagnostic finding, then change evidence. Confirm the old source context is marked stale and preserved as a snapshot.
8. Switch investigations and reload. Confirm actions remain isolated by workspace ID.
9. Export the action log and inspect the schema, source snapshot, evidence links, and history.
10. Fill browser storage or simulate a write failure. Confirm a failed write is not represented as saved.

Run the automated browser tests with `npm run test:e2e` after installing the project's pinned dependencies. No result from this guide implies that the action workflow has been tested in a particular environment.
