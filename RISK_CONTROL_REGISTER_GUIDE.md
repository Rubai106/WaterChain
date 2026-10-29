# WaterChain Risk & Control Register (Step 14)

The Risk & Control Register records observations about potential hazards, the controls that are reported to exist or are planned, corrective follow-up, and later effectiveness reviews. It is separate from the diagnostic engine: **adding a hazard does not generate a contamination diagnosis or alter pathway inference**.

## Record a risk / hazard

1. Open an investigation and go to **Risk & controls**.
2. Select **Record risk / hazard**.
3. Enter a concise title, category, observation basis, description, location/entity, and optional time.
4. Select evidence records or provide an external inspection/report reference where applicable. Laboratory findings and sanitary-inspection findings require an evidence link or reference.
5. Enter the self-reported name of the person recording the observation.
6. Set severity and likelihood only when an operator has a basis to do so. Leave them unknown when they have not been assessed.

### Screening priority

The displayed low/moderate/high category comes from a small, explicit qualitative matrix using the selected severity and likelihood. It is **not a validated health-risk score, exposure estimate, probability, regulatory classification, or substitute for a locally approved water safety plan/risk method**. Unknown severity or likelihood yields `not assessed`.

## Record a control

Controls can be preventive, monitoring, mitigation, or corrective. Supply an accountable owner and description. If a reference or evidence record is supplied at creation, the control is labelled **Documented**; otherwise it begins **Proposed**. That label records the information entered by the user. It does not authenticate the reference or establish that the control is present or effective.

Control lifecycle:

- **Proposed:** a control idea is recorded.
- **Documented:** at least one record/reference is supplied for the control.
- **Implemented · not verified:** implementation note, actor, and supporting evidence are recorded.
- **Effectiveness verified:** a differently named reviewer records a note and evidence reference. If evidence-record IDs are selected, WaterChain stores a SHA-256 fingerprint of those exact record contents.
- **Ineffective:** an implementation exists, but a review records that the control did not achieve its intended purpose.
- **Unknown:** status cannot be established.

When a record used in a control-effectiveness review is edited, removed, or no longer matches its saved fingerprint, the UI marks the review stale. A stale review cannot qualify a risk review for administrative closure; the control must be reopened and reviewed against current evidence. External references are not content-hashed because the application does not retain or authenticate their source document.

The reviewer must have a different self-entered name from the control owner. This is a workflow check only; no user identity is authenticated.

## Corrective action integration

Use **Create corrective ActionLoop task** on a control to create a linked task in ActionLoop. The task includes the risk/control context and linked evidence record IDs. Its completion does not automatically change the control's status. A control effectiveness review remains a separate action and must be recorded independently.

## Risk-review status

Risk review records can be open, monitoring, or administratively closed. Moving between open and monitoring requires a self-entered actor and reason. Closing a review requires:

- at least one linked control with a current effectiveness review;
- a closure note;
- a self-entered reviewer label; and
- a traceable closure reference.

A closed review record is **not** a statement that the hazard has been eliminated or that the water is safe. Reopening a review clears current closure fields while preserving the local event history.

## Data, storage, and audit limits

Risk records, controls, and their event history are stored in this browser's `localStorage` under a key scoped to the investigation. They are exported separately as `waterchain-risk-register-*.json`; the main evidence backup does not currently bundle risk-register data. Preserve the risk-register export separately before clearing browser data.

Names, owners, reviewers, observations, and references are self-entered and not authenticated. The history is useful for local traceability, but it is mutable browser data, not a secure server audit log. Do not use the prototype as a certified water safety plan or production public-health system.

## Testing

The main browser regression suite is `tests/e2e/risk-control-register.spec.ts`. It covers risk creation, qualitative priority, control lifecycle, self-review prevention, corrective ActionLoop integration, administrative closure gating, verification staleness when linked evidence changes, and investigation isolation. Run it through `npm run test:e2e` after installing dependencies and the Playwright browser.
