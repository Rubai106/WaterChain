import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createCase, importCsv, runDiagnostic, uniqueCase, addManualRecord } from './helpers';

test.describe('Step 16 — decision sensitivity studio', () => {
  test('runs single-record omission analyses without modifying the underlying evidence', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Sensitivity analysis'));
    await expect(page.locator('#guided-next-action')).toContainText('Add your first evidence records');
    await importCsv(page, 'clean.csv');
    await expect(page.locator('#guided-next-action')).toContainText('Run a diagnostic review');
    await runDiagnostic(page);
    await expect(page.locator('#guided-next-action')).toContainText('Test which evidence the conclusion depends on');

    const studio = page.locator('#decision-robustness');
    await studio.scrollIntoViewIfNeeded();
    await expect(studio).toContainText('single-record-omission analysis');
    await expect(studio.getByLabel('Temporarily omit QC-01')).toBeVisible();
    await expect(studio.getByLabel('Temporarily omit QC-04')).toBeVisible();

    await studio.getByLabel('Temporarily omit QC-01').check();
    await studio.getByLabel('Temporarily omit QC-04').check();
    await studio.getByRole('button', { name: 'Run sensitivity test' }).click();
    await expect(studio.locator('.decision-robustness-results')).toBeVisible({ timeout: 60000 });
    await expect(studio.locator('.decision-robustness-summary')).toContainText('2/2');
    await expect(studio).toContainText('Omit QC-01');
    await expect(studio).toContainText('Omit QC-04');
    // Both omissions genuinely change the engine's decision (attribution
    // permitted -> withheld); the comparison path must surface that.
    await expect(studio.locator('.pill-changed')).toHaveCount(2);
    await expect(studio).toContainText('does not estimate probabilities');

    // Each omission is sent as a temporary API payload; the stored register stays intact.
    const evidenceRegister = page.locator('#evidence-register');
    await expect(evidenceRegister).toContainText('QC-01');
    await expect(evidenceRegister).toContainText('QC-04');

    const downloadPromise = page.waitForEvent('download');
    await studio.getByRole('button', { name: 'Export sensitivity report' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^waterchain-sensitivity-[a-f0-9]{12}\.json$/);
    const savedPath = await download.path();
    expect(savedPath).not.toBeNull();
    const artifact = JSON.parse(await fs.readFile(savedPath!, 'utf8')) as { schema: string; evidenceSnapshotSha256: string; scenarios: unknown[]; evidenceRecords?: unknown[] };
    expect(artifact.schema).toBe('waterchain-decision-sensitivity-v1');
    expect(artifact.evidenceSnapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.scenarios).toHaveLength(2);
    expect(artifact.evidenceRecords).toBeUndefined();
  });

  test('a changed evidence set makes the prior sensitivity result unavailable with the stale report', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Sensitivity stale'));
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    await expect(page.locator('#decision-robustness')).toBeVisible();
    await addManualRecord(page, 'SENS-NEW', 'source', 'not_detected', 'B-1', '2026-01-03T08:00');
    await expect(page.locator('#diagnostic-workbench')).toContainText('Evidence changed since this report');
    await expect(page.locator('#guided-next-action')).toContainText('Refresh the diagnostic review');
    await expect(page.locator('#decision-robustness')).toHaveCount(0);
  });

  test('exported reports verify against the current snapshot; tampered exports are flagged', async ({ page }) => {
    await page.goto('/');
    await createCase(page, uniqueCase('Sensitivity verify'));
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    const studio = page.locator('#decision-robustness');
    await studio.scrollIntoViewIfNeeded();
    await studio.getByLabel('Temporarily omit QC-01').check();
    await studio.getByRole('button', { name: 'Run sensitivity test' }).click();
    await expect(studio.locator('.decision-robustness-results')).toBeVisible({ timeout: 60000 });

    const downloadPromise = page.waitForEvent('download');
    await studio.getByRole('button', { name: 'Export sensitivity report' }).click();
    const download = await downloadPromise;
    const savedPath = await download.path();
    expect(savedPath).not.toBeNull();
    const artifact = JSON.parse(await fs.readFile(savedPath!, 'utf8')) as { contentSha256?: string; scenarios: Array<Record<string, unknown>> };
    expect(artifact.contentSha256).toMatch(/^[a-f0-9]{64}$/);

    // Tamper with a scenario conclusion after export.
    const tampered = { ...artifact, scenarios: [{ ...artifact.scenarios[0], decisionClassificationChanged: !artifact.scenarios[0].decisionClassificationChanged }] };
    const tamperedPath = path.join(os.tmpdir(), `sensitivity-tampered-${Date.now()}.json`);
    await fs.writeFile(tamperedPath, JSON.stringify(tampered));

    await studio.getByText('Verify an exported sensitivity report').click();
    const verifyInput = studio.locator('input[aria-label="Choose a sensitivity report to verify"]');
    const message = studio.locator('.decision-robustness-verify-message');
    await verifyInput.setInputFiles(savedPath!);
    await expect(message).toContainText('Verified:');
    await verifyInput.setInputFiles(tamperedPath);
    await expect(message).toContainText('altered after export');
  });
});
