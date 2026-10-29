import path from 'path';
import type { Page } from '@playwright/test';

export const FIXTURES = path.join(__dirname, 'fixtures');
export const SHOTS = path.join(__dirname, '..', 'screenshots');

export async function createCase(page: Page, name: string) {
  const start = page.getByRole('button', { name: 'New investigation' }).first();
  if (await start.isVisible().catch(() => false)) await start.click();
  else await page.getByRole('button', { name: 'Start an investigation' }).click();
  await page.fill('#case-name', name);
  await page.getByRole('button', { name: /Create workspace/ }).click();
  await page.waitForTimeout(800);
  await page.getByText(name).first().waitFor({ timeout: 10000 }).catch(() => {});
}

export async function importCsv(page: Page, file: string) {
  await page.locator('#evidence-register').scrollIntoViewIfNeeded();
  await page.locator('#evidence-csv-open').click();
  await page.waitForTimeout(400);
  await page.setInputFiles('input[aria-label="Choose CSV file"]', path.join(FIXTURES, file));
  await page.waitForTimeout(800);
  const modalImport = page.locator('.evidence-modal button', { hasText: 'Import' }).last();
  if (await modalImport.isVisible().catch(() => false)) await modalImport.click();
  await page.waitForTimeout(1200);
}

export async function importCsvRejected(page: Page, file: string) {
  // For imports the app rejects at preview time (duplicates, unknown
  // columns), the Import button stays disabled, so a successful-import
  // helper that clicks it would hang. Preview errors render on file
  // select; the caller asserts them, then this closes the modal.
  await page.locator('#evidence-register').scrollIntoViewIfNeeded();
  await page.locator('#evidence-csv-open').click();
  await page.waitForTimeout(400);
  await page.setInputFiles('input[aria-label="Choose CSV file"]', path.join(FIXTURES, file));
  await page.waitForTimeout(800);
}

export async function closeCsvModal(page: Page) {
  const cancel = page.locator('.evidence-modal button', { hasText: 'Cancel' }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click();
  else await page.locator('.evidence-modal .small-icon-button').first().click().catch(() => {});
  await page.waitForTimeout(300);
}

export async function runDiagnostic(page: Page) {
  const wb = page.locator('#diagnostic-workbench');
  await wb.scrollIntoViewIfNeeded();
  await page.locator('.diagnostic-run-button').first().click();
  // Wait for a FRESH result: the old (possibly stale) result stays visible
  // while the new review runs, so merely waiting for .diagnostic-result
  // to exist can return the previous report. A finished run has no
  // "Evaluating…" text, no stale banner, and a result block.
  await page.waitForFunction(() => {
    const el = document.querySelector('#diagnostic-workbench');
    if (!el) return false;
    const t = el.textContent || '';
    return !t.includes('Evaluating…') && !el.querySelector('.diagnostic-stale') && !!el.querySelector('.diagnostic-result');
  }, { timeout: 30000 });
  return (await wb.textContent()) || '';
}

export async function signals(page: Page): Promise<string[]> {
  return page.locator('.stage-signal').allTextContents();
}

export async function switchCase(page: Page, label: string) {
  await page.locator('.workspace-copy select').selectOption({ label });
  await page.waitForTimeout(800);
}

export async function addManualRecord(page: Page, code: string, stage: string, result: string, batchId = 'B-1', collectedAt = '2026-01-01T12:00') {
  await page.locator('#evidence-register').scrollIntoViewIfNeeded();
  // Scope to the register panel: the inspector empty state used to carry a
  // same-named button that only scrolls here, which made a global .first()
  // click open nothing. (That button is now labelled "Go to evidence
  // register", but the scoped selector stays correct either way.)
  await page.locator('#evidence-register').getByRole('button', { name: 'Add evidence' }).click();
  await page.fill('#sample-code', code);
  await page.selectOption('#sample-stage', stage);
  await page.fill('#collected-at', collectedAt);
  await page.fill('#water-source', 'SRC-1');
  await page.fill('#batch-id', batchId);
  await page.selectOption('#result-state', result);
  await page.fill('#method', 'Membrane filtration');
  await page.selectOption('#positiveControl', 'pass');
  await page.selectOption('#negativeControl', 'pass');
  await page.selectOption('#blankControl', 'pass');
  await page.getByRole('button', { name: /Save|Submit|Confirm|Done/ }).last().click().catch(() => {});
  await page.waitForTimeout(1000);
  if (await page.locator('.evidence-modal').isVisible().catch(() => false)) {
    await page.locator('.evidence-modal .primary-button').last().click();
    await page.waitForTimeout(800);
  }
}

export function uniqueCase(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}
