// Step 10: screenshots of the actual running application (not mockups).
// Every case is a synthetic QA fixture, labelled as such in the test
// report. Screenshots land in tests/screenshots/ and ship in the ZIP.
import { test } from '@playwright/test';
import path from 'path';
import { SHOTS, createCase, importCsv, runDiagnostic, addManualRecord, uniqueCase } from './helpers';

test('screenshots: workspace, pathway states, results, mobile, stale', async ({ page }) => {
  await page.goto('/');

  // 1. Pathway with no evidence (empty investigation).
  const emptyName = uniqueCase('ShotEmpty');
  await createCase(page, emptyName);
  await page.locator('#water-pathway').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#water-pathway').screenshot({ path: path.join(SHOTS, 'pathway-empty.png') });

  // 2. Blocked positive (failed blank control at Serving).
  const blockedName = uniqueCase('ShotBlocked');
  await createCase(page, blockedName);
  await importCsv(page, 'blocked-positive.csv');
  await runDiagnostic(page);
  await page.locator('#water-pathway').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#water-pathway').screenshot({ path: path.join(SHOTS, 'pathway-blocked-positive.png') });
  await page.locator('#diagnostic-workbench').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#diagnostic-workbench').screenshot({ path: path.join(SHOTS, 'diagnostic-blocked-positive.png') });

  // 3. Clean eligible positive + full workspace + results/limitations.
  const cleanName = uniqueCase('ShotClean');
  await createCase(page, cleanName);
  await importCsv(page, 'clean.csv');
  await runDiagnostic(page);
  await page.locator('#water-pathway').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#water-pathway').screenshot({ path: path.join(SHOTS, 'pathway-eligible-positive.png') });
  const limitations = page.locator('.diagnostic-limitations summary');
  if (await limitations.isVisible().catch(() => false)) await limitations.click();
  await page.locator('#diagnostic-workbench').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#diagnostic-workbench').screenshot({ path: path.join(SHOTS, 'diagnostic-results-limitations.png') });
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'workspace-light.png') });

  // 4. Mobile viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'workspace-mobile.png'), fullPage: true });

  // 5. Stale-report state (add a record after a current review).
  await page.setViewportSize({ width: 1280, height: 900 });
  await createCase(page, uniqueCase('ShotStale'));
  await importCsv(page, 'clean.csv');
  await runDiagnostic(page);
  await addManualRecord(page, 'QA-EXTRA', 'serving', 'not_detected');
  await page.locator('#diagnostic-workbench').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('#diagnostic-workbench').screenshot({ path: path.join(SHOTS, 'diagnostic-stale.png') });
});
