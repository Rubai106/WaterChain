import { test, expect } from '@playwright/test';
import { addManualRecord, createCase, uniqueCase } from './helpers';

test.describe('Risk & Control Register — Step 14', () => {
  test('records a hazard, documents a control, requires implementation evidence and a different reviewer, links ActionLoop, and records administrative closure', async ({ page }) => {
    const caseName = uniqueCase('Risk control lifecycle');
    const riskTitle = 'Source protection barrier damage';
    const controlTitle = 'Repair and inspect source cover';
    await page.goto('/');
    await createCase(page, caseName);
    const register = page.locator('#risk-control-register');
    await register.scrollIntoViewIfNeeded();
    await register.getByRole('button', { name: /Record risk \/ hazard/ }).click();
    await page.locator('#risk-title').fill(riskTitle);
    await page.locator('#risk-type').selectOption('sanitary_condition');
    await page.locator('#risk-basis').selectOption('sanitary_inspection');
    await page.locator('#risk-severity').selectOption('high');
    await page.locator('#risk-likelihood').selectOption('possible');
    await page.locator('#risk-location').fill('Demo source SRC-DEMO');
    await page.locator('#risk-description').fill('Illustrative test fixture: a field inspection reports visible damage. This does not imply a laboratory-confirmed contamination event.');
    await page.locator('#risk-refs').fill('INSPECTION-REF-001');
    await page.locator('#risk-created-by').fill('Case coordinator');
    await register.getByRole('button', { name: /Save risk record/ }).click();

    const riskCard = register.locator('.risk-item-card').filter({ hasText: riskTitle });
    await expect(riskCard).toBeVisible();
    await expect(riskCard.locator('.risk-priority-high')).toContainText('Screening priority: high');
    await expect(riskCard).toContainText('Sanitary inspection');
    await expect(riskCard).toContainText('INSPECTION-REF-001');

    await riskCard.getByRole('button', { name: /Add control/ }).click();
    await page.locator('#control-title').fill(controlTitle);
    await page.locator('#control-description').fill('Repair the barrier, then retain an inspection record.');
    await page.locator('#control-owner').fill('Maintenance owner');
    await page.locator('#control-refs').fill('CONTROL-PROCEDURE-02');
    await page.locator('#control-created-by').fill('Case coordinator');
    await page.locator('form.risk-control-editor').filter({ hasText: 'Add a control' }).getByRole('button', { name: /Save control/ }).click();

    const controlCard = riskCard.locator('.risk-control-card').filter({ hasText: controlTitle });
    await expect(controlCard).toBeVisible();
    await expect(controlCard).toContainText('Documented');
    await expect(controlCard).toContainText('CONTROL-PROCEDURE-02');
    await expect(controlCard).not.toContainText('Effectiveness verified');

    await controlCard.getByRole('button', { name: /Record implementation/ }).click();
    await page.locator('#risk-control-actor').fill('Maintenance owner');
    await page.locator('#risk-control-note').fill('Repair was performed and inspected visually; formal effectiveness review is still pending.');
    await page.locator('#risk-control-refs').fill('MAINTENANCE-LOG-006');
    await page.locator('form.risk-control-editor').filter({ hasText: 'Record implementation' }).getByRole('button', { name: /Record review/ }).click();
    await expect(controlCard).toContainText('Implemented · not verified');

    await controlCard.getByRole('button', { name: /Verify effectiveness/ }).click();
    await page.locator('#risk-control-actor').fill('Maintenance owner');
    await page.locator('#risk-control-note').fill('Inspected the completed control and documented the result.');
    await page.locator('#risk-control-refs').fill('VERIFICATION-REF-009');
    const verifyForm = page.locator('form.risk-control-editor').filter({ hasText: 'Review effectiveness' });
    await verifyForm.getByRole('button', { name: /Record review/ }).click();
    await expect(verifyForm.getByRole('alert')).toContainText('reviewer must differ from the control owner');

    await page.locator('#risk-control-actor').fill('Independent reviewer');
    await verifyForm.getByRole('button', { name: /Record review/ }).click();
    await expect(controlCard).toContainText('Effectiveness review recorded · external reference');
    await expect(controlCard).toContainText('VERIFICATION-REF-009');

    await controlCard.getByRole('button', { name: /Create corrective ActionLoop task/ }).click();
    await page.locator('#risk-action-owner').fill('Field follow-up owner');
    await page.locator('#risk-action-created-by').fill('Case coordinator');
    await page.locator('#risk-action-priority').selectOption('high');
    await page.locator('form.risk-control-editor').filter({ hasText: 'Create corrective follow-up' }).getByRole('button', { name: /Create linked action/ }).click();
    await expect(controlCard).toContainText('Action linked');
    const actionLoop = page.locator('#action-loop');
    await expect(actionLoop.getByText(`Corrective action: ${controlTitle}`)).toBeVisible();
    await expect(actionLoop).toContainText('Open');

    await riskCard.getByRole('button', { name: /Close review record/ }).click();
    await page.locator('#risk-closure-reviewer').fill('Case reviewer');
    await page.locator('#risk-closure-note').fill('Administrative review completed; the risk record is closed for this review cycle. Ongoing monitoring remains governed by the linked control process.');
    await page.locator('#risk-closure-refs').fill('CLOSURE-REVIEW-REF-01');
    await page.locator('form.risk-control-editor').filter({ hasText: 'Close this risk review record?' }).getByRole('button', { name: /Close review record/ }).click();
    await register.locator('.risk-filter-label select').selectOption('all');
    await expect(riskCard).toContainText('Review record closed');
    await expect(riskCard).toContainText('does not mean the hazard has been eliminated');

    await page.reload();
    await page.locator('#risk-control-register .risk-filter-label select').selectOption('all');
    const restoredRisk = page.locator('#risk-control-register .risk-item-card').filter({ hasText: riskTitle });
    await expect(restoredRisk).toBeVisible();
    await restoredRisk.getByRole('button', { name: /Controls & history/ }).click();
    await expect(restoredRisk.locator('.risk-control-card').filter({ hasText: controlTitle })).toContainText('Effectiveness review recorded · external reference');
    await expect(page.locator('#action-loop').getByText(`Corrective action: ${controlTitle}`)).toBeVisible();
  });

  test('requires evidence-backed control effectiveness before closing a risk review, and records status-change actor and reason', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Risk closure gating'));
    const register = page.locator('#risk-control-register');
    await register.scrollIntoViewIfNeeded();
    await register.getByRole('button', { name: /Record risk \/ hazard/ }).click();
    await page.locator('#risk-title').fill('Potential container handling concern');
    await page.locator('#risk-basis').selectOption('observed_hazard');
    await page.locator('#risk-description').fill('Illustrative test fixture, not a real field observation.');
    await page.locator('#risk-created-by').fill('Investigator');
    await register.getByRole('button', { name: /Save risk record/ }).click();
    const riskCard = register.locator('.risk-item-card').filter({ hasText: 'Potential container handling concern' });
    await riskCard.getByRole('button', { name: /Close review record/ }).click();
    await page.locator('#risk-closure-reviewer').fill('Reviewer');
    await page.locator('#risk-closure-note').fill('Attempted closure before controls were reviewed.');
    await page.locator('#risk-closure-refs').fill('CLOSURE-ATTEMPT-REF');
    const closeForm = page.locator('form.risk-control-editor').filter({ hasText: 'Close this risk review record?' });
    await closeForm.getByRole('button', { name: /Close review record/ }).click();
    await expect(closeForm.getByRole('alert')).toContainText('At least one linked control must have a current, evidence-backed effectiveness review');
    await closeForm.getByRole('button', { name: 'Cancel' }).click();

    await riskCard.getByRole('button', { name: /Move to monitoring/ }).click();
    await page.locator('#risk-status-actor').fill('Investigator');
    await page.locator('#risk-status-reason').fill('The field observation needs periodic follow-up.');
    await page.locator('form.risk-control-editor').filter({ hasText: 'Move review to Monitoring' }).getByRole('button', { name: /Record status change/ }).click();
    await expect(riskCard).toContainText('Monitoring');
    // New risk cards auto-expand on creation, so the toggle may read
    // "Hide details" instead of "Controls & history". Ensure the details
    // section is open either way before inspecting the event history.
    const detailsToggle = riskCard.getByRole('button', { name: /Controls & history|Hide details/ });
    if ((await detailsToggle.textContent())?.includes('Controls & history')) await detailsToggle.click();
    await riskCard.locator('.risk-event-history > summary').click();
    await expect(riskCard.locator('.risk-event-list')).toContainText('Investigator');
    await expect(riskCard.locator('.risk-event-list')).toContainText('The field observation needs periodic follow-up.');
  });

  test('a linked record change marks a control effectiveness review stale and blocks risk-review closure', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Risk evidence freshness'));
    await addManualRecord(page, 'RISK-EVIDENCE-01', 'source', 'not_detected', 'B-RISK', '2026-01-01T08:00');
    const recordId = await page.evaluate(() => {
      const raw = localStorage.getItem('waterchain:workspaces:v1');
      if (!raw) throw new Error('Workspace store missing');
      const store = JSON.parse(raw) as { activeWorkspaceId: string; workspaces: Array<{ id: string; records: Array<{ id: string; sampleCode: string }> }> };
      const workspace = store.workspaces.find((item) => item.id === store.activeWorkspaceId);
      const record = workspace?.records.find((item) => item.sampleCode === 'RISK-EVIDENCE-01');
      if (!record) throw new Error('Test evidence record not found');
      return record.id;
    });

    const register = page.locator('#risk-control-register');
    await register.scrollIntoViewIfNeeded();
    await register.getByRole('button', { name: /Record risk \/ hazard/ }).click();
    await page.locator('#risk-title').fill('Documented physical barrier concern');
    await page.locator('#risk-description').fill('Controlled test record for verifying a stored control review against its evidence snapshot.');
    await page.locator('#risk-created-by').fill('Investigator');
    await page.locator('#risk-evidence').selectOption(recordId);
    await register.getByRole('button', { name: /Save risk record/ }).click();
    const riskCard = register.locator('.risk-item-card').filter({ hasText: 'Documented physical barrier concern' });

    await riskCard.getByRole('button', { name: /Add control/ }).click();
    await page.locator('#control-title').fill('Inspect barrier condition');
    await page.locator('#control-owner').fill('Control owner');
    await page.locator('#control-created-by').fill('Investigator');
    await page.locator('#control-evidence').selectOption(recordId);
    await page.locator('form.risk-control-editor').filter({ hasText: 'Add a control' }).getByRole('button', { name: /Save control/ }).click();
    const controlCard = riskCard.locator('.risk-control-card').filter({ hasText: 'Inspect barrier condition' });

    await controlCard.getByRole('button', { name: /Record implementation/ }).click();
    await page.locator('#risk-control-actor').fill('Control owner');
    await page.locator('#risk-control-note').fill('Inspection recorded in the field register.');
    await page.locator('#risk-control-refs').fill('FIELD-OBS-11');
    await page.locator('#risk-control-evidence').selectOption(recordId);
    await page.locator('form.risk-control-editor').filter({ hasText: 'Record implementation' }).getByRole('button', { name: /Record review/ }).click();

    await controlCard.getByRole('button', { name: /Verify effectiveness/ }).click();
    await page.locator('#risk-control-actor').fill('Independent reviewer');
    await page.locator('#risk-control-note').fill('Reviewed the linked inspection record.');
    await page.locator('#risk-control-refs').fill('CONTROL-REVIEW-02');
    await page.locator('#risk-control-evidence').selectOption(recordId);
    await page.locator('form.risk-control-editor').filter({ hasText: 'Review effectiveness' }).getByRole('button', { name: /Record review/ }).click();
    await expect(controlCard).toContainText('Effectiveness verified');

    await page.evaluate((id) => {
      const raw = localStorage.getItem('waterchain:workspaces:v1');
      if (!raw) throw new Error('Workspace store missing');
      const store = JSON.parse(raw) as { workspaces: Array<{ records: Array<{ id: string; result: string }> }> };
      const record = store.workspaces.flatMap((workspace) => workspace.records).find((item) => item.id === id);
      if (!record) throw new Error('Linked record missing before mutation');
      record.result = 'detected';
      localStorage.setItem('waterchain:workspaces:v1', JSON.stringify(store));
    }, recordId);
    await page.reload();
    const loadedRisk = page.locator('#risk-control-register .risk-item-card').filter({ hasText: 'Documented physical barrier concern' });
    await loadedRisk.getByRole('button', { name: /Controls & history/ }).click();
    const loadedControl = loadedRisk.locator('.risk-control-card').filter({ hasText: 'Inspect barrier condition' });
    await expect(loadedControl).toContainText('Verification stale · linked evidence changed');
    await loadedRisk.getByRole('button', { name: /Close review record/ }).click();
    await page.locator('#risk-closure-reviewer').fill('Review coordinator');
    await page.locator('#risk-closure-note').fill('Attempted to close with stale evidence');
    await page.locator('#risk-closure-refs').fill('CLOSURE-REF-STALE');
    const closeForm = page.locator('form.risk-control-editor').filter({ hasText: 'Close this risk review record?' });
    await closeForm.getByRole('button', { name: /Close review record/ }).click();
    await expect(closeForm.getByRole('alert')).toContainText('current, evidence-backed effectiveness review');
  });

  test('risk records are isolated to their own investigation', async ({ page }) => {
    const firstCase = uniqueCase('Risk isolation A');
    const secondCase = uniqueCase('Risk isolation B');
    await page.goto('/');
    await createCase(page, firstCase);
    const register = page.locator('#risk-control-register');
    await register.scrollIntoViewIfNeeded();
    await register.getByRole('button', { name: /Record risk \/ hazard/ }).click();
    await page.locator('#risk-title').fill('Isolation-only hazard');
    await page.locator('#risk-description').fill('Test fixture for workspace isolation.');
    await page.locator('#risk-created-by').fill('Test operator');
    await register.getByRole('button', { name: /Save risk record/ }).click();
    await expect(register.getByRole('heading', { name: 'Isolation-only hazard' })).toBeVisible();

    await createCase(page, secondCase);
    await page.locator('#risk-control-register').scrollIntoViewIfNeeded();
    await expect(page.locator('#risk-control-register')).toContainText('No risk records in this investigation');
    await page.locator('select[aria-label="Select investigation"]').selectOption({ label: firstCase });
    await expect(page.locator('#risk-control-register').getByRole('heading', { name: 'Isolation-only hazard' })).toBeVisible();
  });
});
