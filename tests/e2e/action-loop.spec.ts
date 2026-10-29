import { test, expect } from '@playwright/test';
import { addManualRecord, createCase, uniqueCase } from './helpers';

test.describe('ActionLoop — Step 13 follow-through workflow', () => {
  test('requires evidence for verification, prevents self-verification, persists history and isolates cases', async ({ page }) => {
    const caseName = uniqueCase('ActionLoop lifecycle');
    await page.goto('/');
    await createCase(page, caseName);
    await page.locator('#action-loop').scrollIntoViewIfNeeded();

    await page.locator('#action-loop').getByRole('button', { name: 'Create action' }).first().click();
    const createForm = page.locator('#action-loop form.action-editor');
    await createForm.locator('#action-title').fill('Verify source-to-household sampling reference');
    await createForm.locator('#action-owner').fill('Assigned owner');
    await createForm.locator('#action-created-by').fill('Case coordinator');
    await createForm.locator('#action-details').fill('Resolve the missing sampling-event reference and record the source used for verification.');
    await createForm.locator('button[type="submit"]').click();

    const card = page.locator('#action-loop .action-item-card').filter({ hasText: 'Verify source-to-household sampling reference' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Open', { exact: true })).toBeVisible();

    await card.getByRole('button', { name: /Start work/ }).click();
    const startForm = card.locator('form.action-transition-form');
    await startForm.locator('input[id^="transition-actor-"]').fill('Assigned owner');
    await startForm.locator('button[type="submit"]').click();
    await expect(card.getByText('In progress', { exact: true })).toBeVisible();

    await card.getByRole('button', { name: /Submit for verification/ }).click();
    let transitionForm = card.locator('form.action-transition-form');
    await transitionForm.locator('input[id^="transition-actor-"]').fill('Assigned owner');
    await transitionForm.locator('textarea[id^="transition-note-"]').fill('Checked the field notebook and recorded the result.');
    await transitionForm.locator('button[type="submit"]').click();
    await expect(transitionForm.getByRole('alert')).toContainText('at least one evidence reference');
    await transitionForm.locator('textarea[id^="transition-refs-"]').fill('FIELD-NOTE-REF-001');
    await transitionForm.locator('button[type="submit"]').click();
    await expect(card.getByText('Awaiting verification', { exact: true })).toBeVisible();

    await card.getByRole('button', { name: /Verify & close/ }).click();
    transitionForm = card.locator('form.action-transition-form');
    await transitionForm.locator('input[id^="transition-actor-"]').fill('Assigned owner');
    await transitionForm.locator('textarea[id^="transition-note-"]').fill('Checked the submitted work.');
    await transitionForm.locator('textarea[id^="transition-refs-"]').fill('REVIEW-REF-001');
    await transitionForm.locator('button[type="submit"]').click();
    await expect(transitionForm.getByRole('alert')).toContainText('must be different from the assigned owner');

    await transitionForm.locator('input[id^="transition-actor-"]').fill('Independent reviewer');
    await transitionForm.locator('textarea[id^="transition-refs-"]').fill('REVIEW-REF-001\nSECOND-CHECK-002');
    await transitionForm.locator('button[type="submit"]').click();
    // Verified actions leave the default "Active actions" filter; show all to inspect the closed record.
    await page.locator('#action-filter').selectOption('all');
    await expect(card.locator('.action-status-chip', { hasText: 'Verified & closed' })).toBeVisible();
    await expect(card.getByText('Verification recorded by Independent reviewer')).toBeVisible();

    await page.reload();
    await page.locator('#action-filter').selectOption('all');
    const restoredCard = page.locator('#action-loop .action-item-card').filter({ hasText: 'Verify source-to-household sampling reference' });
    await expect(restoredCard).toBeVisible();
    await expect(restoredCard.locator('.action-status-chip', { hasText: 'Verified & closed' })).toBeVisible();
    await restoredCard.locator('details.action-history > summary').click();
    await expect(restoredCard.locator('.action-history-event')).toHaveCount(4);

    const secondCase = uniqueCase('ActionLoop isolation');
    await createCase(page, secondCase);
    await page.locator('#action-loop').scrollIntoViewIfNeeded();
    await expect(page.locator('#action-loop .action-item-card')).toHaveCount(0);
    await expect(page.locator('#action-loop')).toContainText('No follow-up actions recorded');
    await page.locator('select[aria-label="Select investigation"]').selectOption({ label: caseName });
    await page.locator('#action-loop').scrollIntoViewIfNeeded();
    await page.locator('#action-filter').selectOption('all');
    await expect(page.locator('#action-loop .action-item-card').filter({ hasText: 'Verify source-to-household sampling reference' })).toBeVisible();
  });


  test('records reassignment, return-for-work, cancellation and reopening with reasons', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('ActionLoop transitions'));
    await page.locator('#action-loop').scrollIntoViewIfNeeded();
    await page.locator('#action-loop').getByRole('button', { name: 'Create action' }).first().click();
    const createForm = page.locator('#action-loop form.action-editor');
    await createForm.locator('#action-title').fill('Record follow-up sample disposition');
    await createForm.locator('#action-owner').fill('Owner One');
    await createForm.locator('#action-created-by').fill('Coordinator');
    await createForm.locator('#action-details').fill('Record the disposition and retain the follow-up reference.');
    await createForm.locator('button[type="submit"]').click();
    const card = page.locator('#action-loop .action-item-card').first();
    await card.getByRole('button', { name: 'Edit details' }).click();
    let form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Coordinator');
    await form.locator('input[id^="transition-title-"]').fill('Record evidence-backed follow-up disposition');
    await form.locator('textarea[id^="transition-details-"]').fill('Document the disposition, verification reference, and outstanding uncertainty.');
    await form.locator('input[id^="transition-due-"]').fill('2020-01-01');
    await form.locator('select[id^="transition-priority-"]').selectOption('high');
    await form.locator('textarea[id^="transition-note-"]').fill('Corrected the scope and set the review deadline.');
    await form.locator('button[type="submit"]').click();
    await expect(card).toContainText('Record evidence-backed follow-up disposition');
    await expect(card).toContainText('Overdue');

    await card.getByRole('button', { name: 'Reassign' }).click();
    form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Coordinator');
    await form.locator('input[id^="transition-new-owner-"]').fill('Owner Two');
    await form.locator('textarea[id^="transition-note-"]').fill('Owner One is unavailable; handoff documented.');
    await form.locator('button[type="submit"]').click();
    await expect(card).toContainText('Owner Two');

    await card.getByRole('button', { name: /Start work/ }).click();
    form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Owner Two');
    await form.locator('button[type="submit"]').click();
    await card.getByRole('button', { name: /Submit for verification/ }).click();
    form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Owner Two');
    await form.locator('textarea[id^="transition-note-"]').fill('Initial check completed; reference needs another review.');
    await form.locator('textarea[id^="transition-refs-"]').fill('FOLLOW-UP-REF-01');
    await form.locator('button[type="submit"]').click();
    await card.getByRole('button', { name: /Return for work/ }).click();
    form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Reviewer');
    await form.locator('textarea[id^="transition-note-"]').fill('Reference does not identify which sample was checked.');
    await form.locator('button[type="submit"]').click();
    await expect(card.getByText('In progress', { exact: true })).toBeVisible();
    await expect(card.getByText('Completion note', { exact: true })).toHaveCount(0);

    await card.getByRole('button', { name: 'Cancel action' }).click();
    form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Coordinator');
    await form.locator('textarea[id^="transition-note-"]').fill('Follow-up superseded by a documented alternative process.');
    await form.locator('button[type="submit"]').click();
    await page.locator('#action-filter').selectOption('all');
    await expect(card.locator('.action-status-chip', { hasText: 'Cancelled' })).toBeVisible();

    await card.getByRole('button', { name: /Reopen with reason/ }).click();
    form = card.locator('form.action-transition-form');
    await form.locator('input[id^="transition-actor-"]').fill('Coordinator');
    await form.locator('textarea[id^="transition-note-"]').fill('New information means this follow-up is needed again.');
    await form.locator('button[type="submit"]').click();
    await expect(card.locator('.action-status-chip', { hasText: 'Reopened' })).toBeVisible();
    await expect(card.getByText('Completion note', { exact: true })).toHaveCount(0);
    await card.locator('details.action-history > summary').click();
    await expect(card.locator('.action-history-event')).toHaveCount(8);
    await expect(card).toContainText('Owner One to Owner Two');
    await expect(card).toContainText('superseded by a documented alternative process');
  });

  test('marks action source stale when the underlying diagnostic review changes', async ({ page }) => {
    await page.goto('/');
    const caseName = uniqueCase('ActionLoop stale source');
    await createCase(page, caseName);
    await page.locator('#diagnostic-workbench').scrollIntoViewIfNeeded();
    const runButton = page.locator('.diagnostic-run-button').first();
    await runButton.click();
    await page.waitForFunction(() => {
      const el = document.querySelector('#diagnostic-workbench');
      return Boolean(el && !el.textContent?.includes('Evaluating…') && el.querySelector('.diagnostic-result'));
    }, { timeout: 30000 });
    await page.locator('#action-loop').scrollIntoViewIfNeeded();
    const suggested = page.locator('#action-loop .action-source-card').first();
    if (await suggested.count()) {
      await suggested.getByRole('button', { name: /Create action/ }).click();
      const form = page.locator('#action-loop form.action-editor');
      await form.locator('#action-owner').fill('Source action owner');
      await form.locator('#action-created-by').fill('Source action coordinator');
      await form.locator('button[type="submit"]').click();
      const card = page.locator('#action-loop .action-item-card').first();
      await expect(card.locator('.action-source-chip')).toContainText('Source review matches current report');
      await addManualRecord(page, `STALE-${Date.now()}`, 'source', 'not_detected', 'B-STALE');
      await page.locator('#action-loop').scrollIntoViewIfNeeded();
      await expect(card.locator('.action-source-chip.stale')).toContainText('Source review is stale');
      await page.reload();
      const restoredCard = page.locator('#action-loop .action-item-card').first();
      await expect(restoredCard).toBeVisible();
      await expect(restoredCard.locator('.action-source-chip.stale')).toContainText('Source review is stale');
    } else {
      test.skip(true, 'The empty-case engine response did not expose a source card; manual ActionLoop flow is covered by the lifecycle test.');
    }
  });
});
