// Step 10: end-to-end workflows — creation, isolation, persistence,
// CSV validation, stale handling, backup/restore, accessibility, and
// responsive layout. All cases are synthetic QA fixtures.
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import {
  FIXTURES, addManualRecord, createCase, importCsv, runDiagnostic,
  signals, switchCase, uniqueCase,
} from './helpers';

test('investigation creation, switching and isolation', async ({ page }) => {
  await page.goto('/');
  const a = uniqueCase('CaseA');
  const b = uniqueCase('CaseB');
  await createCase(page, a);
  await importCsv(page, 'linked.csv');
  await expect(page.locator('#evidence-register')).toContainText('QA-01');
  await createCase(page, b);
  await expect(page.locator('#evidence-register')).not.toContainText('QA-01');
  await switchCase(page, a);
  await expect(page.locator('#evidence-register')).toContainText('QA-01');
  await switchCase(page, b);
  await expect(page.locator('#evidence-register')).not.toContainText('QA-01');
});

test('report persists across reloads and switches', async ({ page }) => {
  await page.goto('/');
  const name = uniqueCase('Persist');
  await createCase(page, name);
  await importCsv(page, 'linked.csv');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/earliest observed positive is at Serving/i);
  await page.reload();
  await page.waitForTimeout(1200);
  await expect(page.locator('#diagnostic-workbench')).toContainText(/earliest observed positive is at Serving/i);
  const other = uniqueCase('Other');
  await createCase(page, other);
  await expect(page.locator('#diagnostic-workbench')).not.toContainText(/earliest observed positive is at Serving/i);
  await switchCase(page, name);
  await expect(page.locator('#diagnostic-workbench')).toContainText(/earliest observed positive is at Serving/i);
});

test('manual evidence entry and stale-report protection', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Stale'));
  await importCsv(page, 'clean.csv');
  await runDiagnostic(page);
  expect(await signals(page)).toContain('Eligible positive observed');
  await addManualRecord(page, 'QA-EXTRA', 'serving', 'not_detected');
  await expect(page.locator('.diagnostic-stale')).toBeVisible();
  // Stale conclusions are hidden by default, with old output behind an explicit disclosure.
  await expect(page.locator('.diagnostic-result')).toHaveCount(0);
  const staleArchive = page.locator('.diagnostic-stale-archive');
  await expect(staleArchive).toBeVisible();
  await expect(staleArchive.locator('.diagnostic-stale-archive-body')).toBeHidden();
  await staleArchive.locator('summary').click();
  await expect(staleArchive.locator('.diagnostic-stale-archive-body')).toBeVisible();
  await expect(staleArchive.locator('.diagnostic-stale-archive-note')).toContainText(/must not be interpreted as the current assessment/i);
  await staleArchive.locator('summary').click();
  // A stale report must not feed the pathway: states fall back to
  // unresolved instead of showing the old report's states.
  expect(await signals(page)).toContain('Eligibility unresolved');
  expect(await signals(page)).not.toContain('Eligible positive observed');
  // Step 11 hides the whole current-result block (including its export)
  // while stale, so no export of the old report as current is possible.
  // Assert absence, not a disabled button, which no longer exists.
  await expect(page.locator('.review-bundle-export')).toHaveCount(0);
  expect(await page.locator('.review-bundle-export button:not([disabled])').count()).toBe(0);
  await expect(page.locator('.pathway-engine-status')).toContainText('stale');
  // Re-running restores current states.
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/has not permitted/i); // now discordant at Serving
  expect(await signals(page)).toContain('Evidence limited');
});

test('manual evidence entry generates distinct record codes', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('ManualIDs'));
  await addManualRecord(page, 'QA-MANUAL-A', 'source', 'not_detected');
  await addManualRecord(page, 'QA-MANUAL-B', 'collection', 'not_detected');
  const rows = page.locator('.evidence-data-row');
  await expect(rows).toHaveCount(2);
  const codes = await rows.locator('.sample-identity-button span').allTextContents();
  expect(codes).toHaveLength(2);
  expect(new Set(codes.map((code) => code.trim().toLocaleLowerCase())).size).toBe(2);
  await expect(rows.nth(0).locator('.sample-identity-button strong')).toHaveText('QA-MANUAL-A');
  await expect(rows.nth(1).locator('.sample-identity-button strong')).toHaveText('QA-MANUAL-B');
});

test('duplicate IDs and unknown headers are rejected', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Reject'));
  await page.locator('#evidence-register').scrollIntoViewIfNeeded();
  await page.locator('#evidence-csv-open').click();
  await page.waitForTimeout(400);
  await page.setInputFiles('input[aria-label="Choose CSV file"]', path.join(FIXTURES, 'dup.csv'));
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText(/duplicate/i);
  await page.locator('.evidence-modal .small-icon-button').first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('#evidence-csv-open').click();
  await page.waitForTimeout(400);
  await page.setInputFiles('input[aria-label="Choose CSV file"]', path.join(FIXTURES, 'badheader.csv'));
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText(/Unsupported CSV column/i);
});

test('JSON backup, restore as separate investigation, malformed backups', async ({ page }) => {
  await page.goto('/');
  const name = uniqueCase('Backup');
  await createCase(page, name);
  await importCsv(page, 'linked.csv');
  const downloadPromise = page.waitForEvent('download', { timeout: 8000 });
  await page.getByRole('button', { name: 'JSON backup' }).first().click();
  const dl = await downloadPromise;
  const backupPath = path.join(FIXTURES, '..', 'tmp-backup.json');
  await dl.saveAs(backupPath);
  expect(fs.existsSync(backupPath)).toBe(true);

  await page.getByRole('button', { name: 'Restore backup' }).first().click();
  await page.setInputFiles('input[aria-label="Select a WaterChain backup JSON file"]', backupPath);
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText(/separate investigation/i);
  await page.getByRole('button', { name: /Restore separately/ }).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.breadcrumb')).toContainText(`Restored — ${name}`);

  // Malformed (non-JSON) backup: friendly error, no crash, no restore.
  await page.getByRole('button', { name: 'Restore backup' }).first().click();
  await page.setInputFiles('input[aria-label="Select a WaterChain backup JSON file"]', path.join(FIXTURES, 'malformed.json'));
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText(/not valid JSON/i);
  // Valid JSON with an unsupported schema: also a friendly error.
  await page.getByRole('button', { name: 'Restore backup' }).first().click();
  await page.setInputFiles('input[aria-label="Select a WaterChain backup JSON file"]', path.join(FIXTURES, 'wrongschema.json'));
  await page.waitForTimeout(800);
  await expect(page.locator('body')).toContainText(/Unsupported JSON format/i);
  fs.unlinkSync(backupPath);
});

test('keyboard focus and accessible stage labels', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Keyboard'));
  await importCsv(page, 'linked.csv');
  const card = page.locator('.stage-card').first();
  await expect(card).toHaveAttribute('aria-label', /Source stage:/);
  // Tab through the page until a stage card receives keyboard focus.
  let focusedStageCard = false;
  let outlineOk = false;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { stage: false, outline: '' };
      const style = getComputedStyle(el);
      return {
        stage: el.classList.contains('stage-card'),
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
      };
    });
    if (info.stage) {
      focusedStageCard = true;
      outlineOk = !/none 0px/.test(info.outline);
      break;
    }
  }
  expect(focusedStageCard).toBe(true);
  expect(outlineOk).toBe(true);
  // Stage signals carry accessible labels too.
  await expect(page.locator('.stage-signal').first()).toHaveAttribute('aria-label', /Stage status:/);
});

test('responsive pathway: desktop ribbon, mobile stacked nodes', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Responsive'));
  await importCsv(page, 'linked.csv');
  await expect(page.locator('.pathway-ribbon')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await expect(page.locator('.hero-tidal')).toBeVisible();
  const ribbonDisplay = await page.evaluate(() => getComputedStyle(document.querySelector('.pathway-ribbon') as HTMLElement).display);
  expect(ribbonDisplay).toBe('none');
  expect((await signals(page)).length).toBe(4);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.hero-waves svg') as HTMLElement).animationName);
  expect(anim).toBe('none');
});

test('no page errors or unexpected console errors', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (/fonts\.gstatic\.com|fonts\.googleapis\.com|ERR_TUNNEL/.test(t)) return; // offline font host in sandboxes
      consoleErrors.push(t);
    }
  });
  await page.goto('/');
  await createCase(page, uniqueCase('Console'));
  await importCsv(page, 'linked.csv');
  await runDiagnostic(page);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
