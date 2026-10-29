# Step 14 changelog — Water Safety Risk & Control Register

## Added

- Investigation-scoped Risk & Control Register with explicit hazard type, observation basis, description, location, observed-at timestamp, linked evidence-record IDs, external references, self-entered recorder, severity, likelihood, and lifecycle status.
- Transparent qualitative low/moderate/high screening matrix with `not_assessed` output for unknown severity or likelihood. The UI labels it as a screening aid, not a validated risk score.
- Control register for preventive, monitoring, mitigation, and corrective controls with owner, description, evidence/reference basis, proposed/documented/implemented-unverified/effectiveness-verified/ineffective/unknown statuses.
- State transitions that require implementation evidence, a separate named reviewer, a verification note, and traceable evidence before effectiveness can be recorded.
- SHA-256 fingerprints for selected evidence records at control-effectiveness review. The UI recalculates them when evidence changes and flags stale verification; stale controls cannot satisfy administrative risk-review closure.
- Integration that creates linked corrective tasks in ActionLoop and refreshes the ActionLoop panel through a same-tab event, with a best-effort rollback if the risk-control link cannot be saved.
- Administrative risk-review states (open, monitoring, review closed) with named actor/reason for status changes and evidence-backed closure requirements.
- Local event history for risk/control creation, status changes and corrective-action linking; per-investigation JSON export.
- E2E tests for the control lifecycle, corrective action integration, stale verification, closure gating, and investigation isolation.

## Scientific and product safeguards

- Adding a risk does not change the diagnostic engine or assert contamination.
- A documented or implemented control is not assumed effective.
- A closed review is an administrative record state, not proof that a hazard was eliminated or the water is safe.
- The qualitative severity/likelihood matrix is explicitly unvalidated and should be replaced or configured to the method adopted by an expert team before operational use.
- Actor/owner/reviewer labels are self-entered and unauthenticated; all data remain browser-local.

## Validation status in this authoring environment

- Python engine and dataset-adapter suites and both synthetic evaluation scripts are run independently and documented in `STEP14_VERIFICATION.md`.
- TypeScript/TSX syntax parsing is run independently.
- `npm ci` timed out. Therefore full typecheck, lint, Next.js production build, and Playwright execution are **blocked here**, not claimed as passed. The Playwright test file is included for execution in a dependency-enabled environment.
