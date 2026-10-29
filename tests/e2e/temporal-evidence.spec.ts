import { test, expect } from '@playwright/test';
import { addManualRecord, createCase, importCsv, runDiagnostic, uniqueCase } from './helpers';

test.describe('Step 15 — Temporal evidence & sampling planner', () => {
  test('empty investigation does not fabricate a timeline or data-based recommendation', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Temporal empty'));
    const panel = page.locator('#temporal-evidence');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('No dated records match this view');
    await expect(panel).toContainText('No data-based action can be ranked yet');
  });

  test('timeline shows entered observations and marks eligibility unresolved until a current review', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Temporal chronological'));
    await importCsv(page, 'clean.csv');
    const panel = page.locator('#temporal-evidence');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('QC-01');
    await expect(panel).toContainText('QC-04');
    await expect(panel).toContainText('Eligibility unresolved');
    await runDiagnostic(page);
    await expect(panel).toContainText('Eligible');
    const codes = await panel.locator('.temporal-event-main > div:first-child strong').allTextContents();
    expect(codes).toEqual(['QC-01', 'QC-02', 'QC-03', 'QC-04']);
  });


  test('undated records are disclosed separately and are never assigned an invented time', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Temporal undated'));
    await importCsv(page, 'temporal-undated.csv');
    const panel = page.locator('#temporal-evidence');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Missing / invalid time');
    await expect(panel.locator('.temporal-undated')).toContainText('TU-01');
    await expect(panel.locator('.temporal-undated')).toContainText('excluded from the timeline');
  });

  test('repeat results are described as observations, not causal proof', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Temporal repeat'));
    await importCsv(page, 'clean.csv');
    await addManualRecord(page, 'TIME-S2', 'source', 'detected', 'B-1', '2026-01-02T09:00');
    await runDiagnostic(page);
    const panel = page.locator('#temporal-evidence');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Observed result categories vary over time');
    await expect(panel).toContainText('not proof of intermittent contamination or a causal transition');
  });

  test('planner comparison is rule-ranked and hands a draft to ActionLoop without saving silently', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Temporal action handoff'));
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    const panel = page.locator('#temporal-evidence');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('No expected-information-gain probabilities are estimated');
    const actionButton = panel.getByRole('button', { name: /Use in ActionLoop/ }).first();
    await expect(actionButton).toBeVisible();
    await actionButton.click();
    const actionPanel = page.locator('#action-loop');
    await expect(actionPanel.locator('form.action-editor')).toBeVisible();
    await expect(actionPanel.locator('#action-title')).not.toHaveValue('');
    await expect(actionPanel.locator('#action-details')).toHaveValue(/What remains unknown/);
    await expect(actionPanel).toContainText('No follow-up actions recorded');
    await actionPanel.getByRole('button', { name: 'Cancel create action' }).click();
  });

  test('stale diagnostic report is not represented as current temporal eligibility', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Temporal stale'));
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    await addManualRecord(page, 'TIME-EDIT', 'source', 'not_detected', 'B-1', '2026-01-03T09:00');
    const panel = page.locator('#temporal-evidence');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Diagnostic report is stale');
    await expect(panel).toContainText('Eligibility unresolved');
  });
});
