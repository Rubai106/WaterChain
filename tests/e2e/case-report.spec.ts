import { expect, test } from '@playwright/test';
import fs from 'fs';
import { createCase, importCsv, runDiagnostic, uniqueCase } from './helpers';

// Regression tests for the human-readable case-report export (Step 20, Phase D.C).
// The export must reproduce the workbench's conclusion AND its uncertainties —
// exclusions with reasons, unresolved findings, and engine-stated limitations —
// without inventing probabilities or causal claims, and must stay disabled on
// stale reports just like the machine-readable review bundle.

test('R1: readable case report exports the conclusion, eligibility, and limitations', async ({ page }) => {
  const name = uniqueCase('Case report');
  await page.goto('/');
  await createCase(page, name);
  await importCsv(page, 'linked.csv');
  const text = await runDiagnostic(page);
  expect(text).toContain('ENGINE CONCLUSION');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export readable case report' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const content = fs.readFileSync(filePath!, 'utf8');

  // Reproducible provenance
  expect(content).toContain('# WaterChain case report');
  expect(content).toContain(name);
  expect(content).toContain('Evidence SHA-256:');
  expect(content).toContain('Request ID:');
  expect(content).toContain('waterchain-rule-engine-v1');
  // Conclusion reproduced, with the anti-causation guard
  expect(content).toContain('## Engine conclusion');
  expect(content).toContain('does not establish water safety');
  // Eligibility table with exclusions and reasons
  expect(content).toContain('## Record eligibility (engine gate)');
  expect(content).toMatch(/\| QA-01 \| Source \|/);
  // Integrity findings and limitations travel with the conclusion
  expect(content).toContain('## Integrity and inference findings');
  expect(content).toContain('## Limitations (engine-stated)');
  // No invented probabilities, no affirmative causal-proof claims. The document
  // legitimately uses "prove" inside honest negations ("does not prove",
  // "not definitive causal proof", "remains uncertain") and inside
  // "provenance", so assert on the specific forbidden affirmative phrases.
  expect(content).not.toMatch(/probability of|percent confident|% confident|proves contamination|proof of origin|proof of causation/i);
  expect(content).toContain('not definitive causal proof');
  expect(content).toContain('does not establish water safety');
  // Honest about what the export does and does not contain
  expect(content).toContain('references records by code');
  expect(content).toContain('detects whether this evidence snapshot changed; it does not authenticate');
});

test('R2: case-report export is disabled while the report is stale', async ({ page }) => {
  const name = uniqueCase('Case report stale');
  await page.goto('/');
  await createCase(page, name);
  await importCsv(page, 'linked.csv');
  await runDiagnostic(page);
  // Make the report stale by adding a record; the workbench hides the
  // conclusion and the whole export block (bundle + case report) is not
  // rendered for a stale report, so neither export can emit the old
  // conclusion as current.
  await importCsv(page, 'single.csv');
  await page.locator('#diagnostic-workbench').scrollIntoViewIfNeeded();
  await expect(page.locator('#diagnostic-workbench .diagnostic-stale')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Export readable case report' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export review bundle' })).toHaveCount(0);
});
