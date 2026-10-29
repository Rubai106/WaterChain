import { test, expect } from '@playwright/test';
import { addManualRecord, createCase, runDiagnostic, uniqueCase } from './helpers';

const stages = [
  { sample: 'WJ-SOURCE', stage: 'source', result: 'not_detected', batch: 'borehole-visit-01', time: '2026-01-01T08:00' },
  { sample: 'WJ-COLLECTION', stage: 'collection', result: 'not_detected', batch: 'transport-container-17', time: '2026-01-01T09:00' },
  { sample: 'WJ-STORAGE', stage: 'storage', result: 'detected', batch: 'storage-container-17', time: '2026-01-01T10:00' },
  { sample: 'WJ-SERVING', stage: 'serving', result: 'detected', batch: 'serving-event-17', time: '2026-01-01T11:00' },
] as const;

async function createLinkedJourney(page: import('@playwright/test').Page, sourceIdentifier = 'SRC-1') {
  const area = page.locator('#water-journey-model');
  const createForm = area.locator('form').filter({ hasText: 'Create source & journey' });
  await createForm.getByLabel('Source name').fill('Synthetic WASH source');
  await createForm.getByLabel('Recorded source ID used in evidence records').fill(sourceIdentifier);
  await createForm.getByLabel('Source type').selectOption('borehole');
  await createForm.getByLabel('Journey name').fill('Synthetic household water journey');
  await createForm.getByRole('button', { name: 'Create journey' }).click();
  await expect(area).toContainText('Synthetic household water journey');
  return area;
}

async function addSampleLink(area: import('@playwright/test').Locator, sampleCode: string, index: number, entityRef: string) {
  const form = area.locator('form').filter({ hasText: 'Link an existing sample' });
  const recordSelect = form.locator('select').nth(0);
  const option = recordSelect.locator('option').filter({ hasText: sampleCode }).first();
  const value = await option.getAttribute('value');
  expect(value).toBeTruthy();
  // Linked rows show the auto-generated record code, not the sample code:
  // the select option label is "RECORD-CODE · SAMPLE-CODE". Read it BEFORE
  // clicking: once linked, the record leaves the dropdown, so the option
  // no longer exists to read afterwards.
  const recordCode = ((await option.textContent()) || '').split('·')[0].trim();
  expect(recordCode).toBeTruthy();
  await recordSelect.selectOption(value!);
  await form.locator('select').nth(1).selectOption('directly_documented');
  await form.getByLabel('Field record / visit reference').fill(`SYNTHETIC-FIELD-VISIT-${index}`);
  await form.getByLabel('Water entity / container ID').fill(entityRef);
  await form.getByRole('button', { name: 'Link sample event' }).click();
  await expect(area.locator('.journey-linked-ledger').first()).toContainText(recordCode);
}

async function addTransfer(area: import('@playwright/test').Locator, fromStage: 'source' | 'collection' | 'storage', sourceRef = 'SRC-1') {
  const form = area.locator('form').filter({ hasText: 'Record a transfer' });
  await form.getByLabel('From stage').selectOption(fromStage);
  await form.getByLabel('Evidence basis').selectOption('documented');
  const entities = { source: sourceRef, collection: 'TRANSPORT-17', storage: 'STORAGE-17', serving: 'SERVING-17' } as const;
  const nextStage = fromStage === 'source' ? 'collection' : fromStage === 'collection' ? 'storage' : 'serving';
  await form.getByLabel('From water/container entity ID').fill(entities[fromStage]);
  await form.getByLabel('To water/container entity ID').fill(entities[nextStage]);
  await form.getByLabel('Transfer log / source reference').fill(`SYNTHETIC-TRANSFER-${fromStage}`);
  await form.getByRole('button', { name: 'Add transfer evidence' }).click();
  await expect(area.locator('.journey-linked-ledger').nth(1)).toContainText(fromStage === 'source' ? 'Source → Collection / transport' : fromStage === 'collection' ? 'Collection / transport → Storage' : 'Storage → Serving');
}

test('explicit journey supports related sampling events without a shared batch ID', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12ExplicitJourney'));
  for (const item of stages) {
    await addManualRecord(page, item.sample, item.stage, item.result, item.batch, item.time);
  }

  const area = await createLinkedJourney(page);
  for (let index = 0; index < stages.length; index++) {
    const entity = { source: 'SRC-1', collection: 'TRANSPORT-17', storage: 'STORAGE-17', serving: 'SERVING-17' } as const;
    await addSampleLink(area, stages[index].sample, index + 1, entity[stages[index].stage]);
  }
  await addTransfer(area, 'source');
  await addTransfer(area, 'collection');
  await addTransfer(area, 'storage');

  const report = await runDiagnostic(page);
  expect(report).toMatch(/explicit journey/i);
  // The engine conclusion uses the app's stage display name, "Household
  // storage", not the bare label "Storage".
  expect(report).toMatch(/earliest observed positive is at Household storage/i);
  expect(report).toMatch(/candidate transition interval/i);
  expect(report).not.toMatch(/proven contamination source|confirmed source/i);
  await expect(area.locator('.journey-success')).toContainText(/does not establish causation/i);
});

test('explicit journey blocks source identifier mismatches', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12SourceMismatch'));
  for (const item of stages) {
    await addManualRecord(page, item.sample, item.stage, item.result, item.batch, item.time);
  }
  const area = await createLinkedJourney(page, 'WRONG-SOURCE-ID');
  for (let index = 0; index < stages.length; index++) {
    const entity = { source: 'WRONG-SOURCE-ID', collection: 'TRANSPORT-17', storage: 'STORAGE-17', serving: 'SERVING-17' } as const;
    await addSampleLink(area, stages[index].sample, index + 1, entity[stages[index].stage]);
  }
  await addTransfer(area, 'source', 'WRONG-SOURCE-ID');
  await addTransfer(area, 'collection', 'WRONG-SOURCE-ID');
  await addTransfer(area, 'storage', 'WRONG-SOURCE-ID');
  const report = await runDiagnostic(page);
  expect(report).toMatch(/source ID mapping conflicts|does not match/i);
  expect(report).not.toMatch(/earliest observed positive is at Storage.*candidate transition interval/i);
  // The blockers panel words this as a source-mapping mismatch, not with
  // the engine report's "source ID mapping conflicts" finding label; the
  // report assertion above already covers that label.
  await expect(area.locator('.journey-blockers')).toContainText(/does not match the selected source mapping/i);
});

test('explicit journey UI rejects undocumented direct links and transfers', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12References'));
  await addManualRecord(page, 'WJ-ONE-SAMPLE', 'source', 'not_detected');
  const area = await createLinkedJourney(page);
  const sampleForm = area.locator('form').filter({ hasText: 'Link an existing sample' });
  const recordSelect = sampleForm.locator('select').nth(0);
  const value = await recordSelect.locator('option').filter({ hasText: 'WJ-ONE-SAMPLE' }).first().getAttribute('value');
  await recordSelect.selectOption(value!);
  await sampleForm.getByRole('button', { name: 'Link sample event' }).click();
  await expect(area.locator('[role="alert"]')).toContainText(/real field\/visit reference/i);

  const transferForm = area.locator('form').filter({ hasText: 'Record a transfer' });
  await transferForm.getByRole('button', { name: 'Add transfer evidence' }).click();
  await expect(area.locator('[role="alert"]')).toContainText(/requires a real field-log or source-document reference/i);
});


test('provenance original is stored locally and re-hashed before download', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12ProvenanceVault'));
  await addManualRecord(page, 'WJ-PROVENANCE', 'source', 'not_detected');
  const area = await createLinkedJourney(page);
  const provenancePanel = area.locator('.journey-workflow-grid').locator('div.journey-form-card').filter({ hasText: 'Document provenance' });
  await provenancePanel.locator('input[type="file"][aria-label="Choose document to fingerprint"]').setInputFiles({
    name: 'synthetic-lab-document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('SYNTHETIC TEST DOCUMENT ONLY. Not a real laboratory report or water-quality result.\n'),
  });
  await expect(provenancePanel).toContainText(/Original stored in this browser; hash verified/i, { timeout: 10000 });
  const downloadPromise = page.waitForEvent('download');
  await provenancePanel.getByRole('button', { name: 'Verify & download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('synthetic-lab-document.txt');
  await page.reload();
  const reloadedPanel = page.locator('#water-journey-model').locator('.journey-workflow-grid').locator('div.journey-form-card').filter({ hasText: 'Document provenance' });
  await expect(reloadedPanel).toContainText(/Original stored in this browser; hash verified/i, { timeout: 10000 });
});


test('journey workflow status persists and closed status requires a documented disposition', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Step12WorkflowStatus'));
  const area = await createLinkedJourney(page);
  const statusForm = area.locator('form.journey-workflow-status');
  const statusSelect = statusForm.getByLabel('Investigation workflow stage');
  await statusSelect.selectOption('closed');
  await expect(statusForm.getByRole('button', { name: 'Save investigation stage' })).toBeDisabled();
  await statusForm.getByLabel(/Disposition \/ closeout note/).fill('Synthetic QA disposition: investigation remains unvalidated; no water-safety conclusion made.');
  await expect(statusForm.getByRole('button', { name: 'Save investigation stage' })).toBeEnabled();
  await statusForm.getByRole('button', { name: 'Save investigation stage' }).click();
  await expect(statusForm).toContainText('Closed with documented disposition');
  await page.reload();
  const restored = page.locator('#water-journey-model').locator('form.journey-workflow-status');
  await expect(restored.getByLabel('Investigation workflow stage')).toHaveValue('closed');
  await expect(restored.getByLabel(/Disposition \/ closeout note/)).toHaveValue(/Synthetic QA disposition/);
  await expect(restored).toContainText(/does not certify water safety/i);
});
