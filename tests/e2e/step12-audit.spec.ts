import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addManualRecord, createCase, uniqueCase } from './helpers';

async function createJourney(page: import('@playwright/test').Page, sourceId = 'SRC-1', journeyName = 'Audit journey one') {
  const area = page.locator('#water-journey-model');
  const form = area.locator('form').filter({ hasText: 'Create source & journey' });
  await form.getByLabel('Source name').fill('Synthetic audit source');
  await form.getByLabel('Recorded source ID used in evidence records').fill(sourceId);
  await form.getByLabel('Source type').selectOption('borehole');
  await form.getByLabel('Journey name').fill(journeyName);
  await form.getByRole('button', { name: 'Create journey' }).click();
  await expect(area).toContainText(journeyName);
  return area;
}

async function linkRecord(area: import('@playwright/test').Locator, sampleCode: string, entityRef: string) {
  const form = area.locator('form').filter({ hasText: 'Link an existing sample' });
  const recordSelect = form.locator('select').nth(0);
  const option = recordSelect.locator('option').filter({ hasText: sampleCode }).first();
  const value = await option.getAttribute('value');
  // The linked row shows the auto-generated record code, not the sample code:
  // the option label is "RECORD-CODE · SAMPLE-CODE".
  const recordCode = ((await option.textContent()) || '').split('·')[0].trim();
  expect(value).toBeTruthy();
  expect(recordCode).toBeTruthy();
  await recordSelect.selectOption(value!);
  await form.locator('select').nth(1).selectOption('directly_documented');
  await form.getByLabel('Field record / visit reference').fill('SYNTHETIC-AUDIT-VISIT');
  await form.getByLabel('Water entity / container ID').fill(entityRef);
  await form.getByRole('button', { name: 'Link sample event' }).click();
  await expect(area.locator('.journey-linked-ledger').first()).toContainText(recordCode);
}

function provenancePanel(area: import('@playwright/test').Locator) {
  return area.locator('.journey-workflow-grid').locator('div.journey-form-card').filter({ hasText: 'Document provenance' });
}

test('same record linked to a second journey shows a cross-journey warning', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12CrossJourney'));
  await addManualRecord(page, 'WJ-XJ', 'source', 'not_detected');
  const area = await createJourney(page, 'SRC-1', 'Audit journey one');
  await linkRecord(area, 'WJ-XJ', 'SRC-1');
  const secondForm = area.locator('form').filter({ hasText: 'Create journey from existing source' });
  await secondForm.getByLabel('Registered source').selectOption({ index: 1 });
  await secondForm.getByLabel('New journey name').fill('Audit journey two');
  await secondForm.getByRole('button', { name: 'Create separate journey' }).click();
  await expect(area).toContainText('Audit journey two');
  const linkForm = area.locator('form').filter({ hasText: 'Link an existing sample' });
  const recordSelect = linkForm.locator('select').nth(0);
  const value = await recordSelect.locator('option').filter({ hasText: 'WJ-XJ' }).first().getAttribute('value');
  expect(value).toBeTruthy();
  await recordSelect.selectOption(value!);
  await expect(linkForm).toContainText(/already linked to Audit journey one/i);
});

test('provenance vault rejects oversize files and stores empty and unicode-named files', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12VaultLimits'));
  await addManualRecord(page, 'WJ-VAULT', 'source', 'not_detected');
  const area = await createJourney(page);
  const panel = provenancePanel(area);
  const input = panel.locator('input[type="file"][aria-label="Choose document to fingerprint"]');
  await input.setInputFiles({ name: 'too-big-synthetic.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(10_000_001, 65) });
  await expect(area.locator('[role="alert"]')).toContainText(/10 MB per file/i);
  await input.setInputFiles({ name: 'empty-synthetic.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) });
  await expect(panel).toContainText('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  await input.setInputFiles({ name: 'synthetic-üñïçødé-lab.txt', mimeType: 'text/plain', buffer: Buffer.from('SYNTHETIC ONLY. Not a real laboratory result.\n') });
  await expect(panel).toContainText('synthetic-üñïçødé-lab.txt');
  await expect(panel).toContainText(/Original stored in this browser; hash verified/i);
});

test('corrupting a vault blob in IndexedDB is detected on reload and blocks download', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12VaultTamper'));
  await addManualRecord(page, 'WJ-TAMPER', 'source', 'not_detected');
  const area = await createJourney(page);
  const panel = provenancePanel(area);
  await panel.locator('input[type="file"][aria-label="Choose document to fingerprint"]').setInputFiles({
    name: 'tamper-target.txt', mimeType: 'text/plain',
    buffer: Buffer.from('SYNTHETIC ORIGINAL. Not a real laboratory result.\n'),
  });
  await expect(panel).toContainText(/Original stored in this browser; hash verified/i);
  const vaultRows = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('waterchain-provenance-vault-v1', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const req = db.transaction('original-files', 'readonly').objectStore('original-files').getAll();
      req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
      req.onerror = () => reject(req.error);
    });
    const row = rows[0];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('original-files', 'readwrite');
      tx.objectStore('original-files').put({ ...row, blob: new Blob(['TAMPERED BY TEST'], { type: 'text/plain' }) });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return rows.length;
  });
  expect(vaultRows).toBeGreaterThan(0);
  await page.reload();
  const reloaded = provenancePanel(page.locator('#water-journey-model'));
  await expect(reloaded).toContainText(/HASH \/ SIZE CHECK FAILED/i, { timeout: 10000 });
  await expect(reloaded.getByRole('button', { name: 'Verify & download' })).toHaveCount(0);
});

test('tampering a stored audit event breaks live hash-chain verification', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12LedgerTamper'));
  await addManualRecord(page, 'WJ-LEDGER', 'source', 'not_detected');
  await createJourney(page);
  const tampered = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('waterchain:journey-model:v1:'));
    if (!key) return 0;
    const store = JSON.parse(localStorage.getItem(key)!);
    if (!Array.isArray(store.auditEvents) || store.auditEvents.length === 0) return 0;
    store.auditEvents[0].summary = 'TAMPERED BY TEST';
    localStorage.setItem(key, JSON.stringify(store));
    return store.auditEvents.length;
  });
  expect(tampered).toBeGreaterThan(0);
  await page.reload();
  const area = page.locator('#water-journey-model');
  await area.getByRole('button', { name: 'Verify hash chain' }).click();
  await expect(area).toContainText(/Hash-chain problem/i);
});

test('exported ledger re-verifies, and a tampered export fails verification', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12LedgerExport'));
  await addManualRecord(page, 'WJ-EXPORT', 'source', 'not_detected');
  const area = await createJourney(page);
  const downloadPromise = page.waitForEvent('download');
  await area.getByRole('button', { name: 'Export relationship and audit ledger' }).click();
  const download = await downloadPromise;
  const originalPath = await download.path();
  expect(originalPath).toBeTruthy();
  const verifyInput = area.locator('input[type="file"][accept="application/json,.json"]');
  await verifyInput.setInputFiles(originalPath!);
  await expect(area).toContainText(/Exported ledger verified:/i);
  const parsed = JSON.parse(await fs.readFile(originalPath!, 'utf-8'));
  parsed.data.auditEvents[0].summary = 'TAMPERED BY TEST';
  const tamperedPath = join(tmpdir(), `waterchain-tampered-ledger-${Date.now()}.json`);
  await fs.writeFile(tamperedPath, JSON.stringify(parsed));
  await verifyInput.setInputFiles(tamperedPath);
  await expect(area).toContainText(/Exported ledger problem/i);
});

test('planner recommends transfer-resolution actions for an incomplete journey', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12Planner'));
  await addManualRecord(page, 'WJ-PLAN', 'source', 'not_detected');
  const area = await createJourney(page);
  await linkRecord(area, 'WJ-PLAN', 'SRC-1');
  await expect(area.locator('.journey-action-list')).toContainText(/Resolve source → collection transfer evidence/i);
  await expect(area.locator('.journey-action-list')).toContainText(/What would possible outcomes mean\?/i);
});

test('mobile viewport shows the journey workbench and reduced motion disables hero animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await createCase(page, uniqueCase('Step12Mobile'));
  await expect(page.locator('#water-journey-model')).toBeVisible();
  await expect(page.locator('#water-journey-model')).toContainText('Create source & journey');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const animation = await page.evaluate(() => {
    const el = document.querySelector('.hero-waves svg');
    return el ? getComputedStyle(el).animationName : 'missing';
  });
  expect(animation).toBe('none');
});
