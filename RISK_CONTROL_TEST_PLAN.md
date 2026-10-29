# Step 14 Risk & Control Register regression plan

## Browser tests

Run:

```bash
npm ci
npm run build
npm run start -- -p 3107
# in a second terminal, after Chromium is installed:
WATERCHAIN_BASE_URL=http://localhost:3107 npx playwright test tests/e2e/risk-control-register.spec.ts
```

The repository's Playwright configuration uses `WATERCHAIN_BASE_URL` and may start the production server itself. The preferred project command is `npm run test:e2e`; a filtered run can use `npx playwright test tests/e2e/risk-control-register.spec.ts`.

Current browser scenarios:

1. Record a risk, add a documented control, record implementation, reject self-verification, record effectiveness review, create an ActionLoop task, close the risk review only with evidence, then reload and verify persistence.
2. Reject administrative closure without an effectiveness-reviewed control; require named actor/reason for movement to monitoring and record the status-change event.
3. Change a record linked to a control-effectiveness review, reload, verify the fingerprint mismatch marks the review stale, and reject risk-review closure.
4. Create a risk in one investigation, switch to another, and confirm the register is isolated.

## Manual checks still required

- Test browser `localStorage` quota exhaustion and corrupt risk-register payload recovery.
- Test screen-reader announcements and full keyboard-only operation.
- Verify layout at 200% browser zoom and narrow mobile widths.
- Test linked external references against local expert review procedures.
- Validate the severity/likelihood screening matrix with the WASH team's adopted risk methodology before real field use.

Names and evidence references are self-entered. No browser test authenticates user identity or certifies control effectiveness in the real world.
