// Step 10: pathway states come from the current engine report, never from
// register guesses. All cases are synthetic QA fixtures (QA-/QB-/QC-/QN-/
// QS-/QD-/QL- prefixes), never presented as real observations.
import { test, expect } from '@playwright/test';
import { createCase, importCsv, runDiagnostic, signals, uniqueCase } from './helpers';

test('homepage, navigation and empty pathway', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/WaterChain/);
  await expect(page.locator('.hero-tidal-title')).toContainText('like a river');
  await expect(page.locator('.brand-mark svg').first()).toBeVisible();
  const name = uniqueCase('Empty');
  await createCase(page, name);
  await expect(page.locator('.breadcrumb')).toContainText(name);
  // No records at all: every stage is unassessed, never negative/clean.
  expect(await signals(page)).toEqual([
    'Unassessed', 'Unassessed', 'Unassessed', 'Unassessed',
  ]);
  await expect(page.locator('.pathway-engine-status')).toContainText('not run yet');
  await expect(page.locator('.pathway-ribbon')).toBeVisible();
});

test('records without a review stay eligibility-unresolved', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Unresolved'));
  await importCsv(page, 'linked.csv');
  await expect(page.locator('#evidence-register')).toContainText('QA-01');
  // The old bug: this used to read "Positive on file" before any engine
  // run. Now every assessed stage is unresolved until a review runs.
  expect(await signals(page)).toEqual([
    'Eligibility unresolved', 'Eligibility unresolved',
    'Eligibility unresolved', 'Eligibility unresolved',
  ]);
  await expect(page.locator('.pathway-engine-status')).toContainText('not run yet');
});

test('clean eligible positive: candidate transition, no source claim', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('CleanPositive'));
  await importCsv(page, 'clean.csv');
  await expect(page.locator('#evidence-register')).toContainText('No register flags');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/earliest observed positive is at Serving/i);
  expect(wb).toMatch(/candidate transition/i);
  expect(await signals(page)).toEqual([
    'Eligible negative observed', 'Eligible negative observed',
    'Eligible negative observed', 'Eligible positive observed',
  ]);
  // The pathway must not claim Serving is the proven origin.
  const pathwayText = await page.locator('#water-pathway').textContent();
  expect(pathwayText).not.toMatch(/proven source|confirmed source|contamination source is/i);
  // Stage detail: click Serving and inspect its records + engine status.
  await page.locator('.stage-card').nth(3).click();
  const detail = page.locator('.stage-detail');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('Eligible positive observed');
  await expect(detail).toContainText('QC-04');
  await expect(detail).toContainText('Eligible');
  await expect(page.locator('.stage-card').nth(3)).toHaveAttribute('aria-pressed', 'true');
});

test('blocked positive (failed blank control) is excluded, not eligible', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('BlockedPositive'));
  await importCsv(page, 'blocked-positive.csv');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/has not permitted/i);
  expect(wb).toMatch(/Quality-control failure/i);
  expect(wb).not.toMatch(/earliest observed positive is at Serving/i);
  // Step 11: with the serving record excluded, no batch links all four
  // stages, so no pathway is selected and the eligible negatives read as
  // off-pathway (pathway_eligible_by_stage is 0 for those stages).
  expect(await signals(page)).toEqual([
    'Eligible negative — off selected pathway', 'Eligible negative — off selected pathway',
    'Eligible negative — off selected pathway', 'Result excluded',
  ]);
  await page.locator('.stage-card').nth(3).click();
  await expect(page.locator('.stage-detail')).toContainText('Quality-control failure');
});

test('valid negative evidence is not proof of absence', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('AllNegative'));
  await importCsv(page, 'negative.csv');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/not proof/i);
  expect(await signals(page)).toEqual([
    'Eligible negative observed', 'Eligible negative observed',
    'Eligible negative observed', 'Eligible negative observed',
  ]);
});

test('incomplete evidence: only the recorded stage is assessed', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Incomplete'));
  await importCsv(page, 'single.csv');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/has not permitted/i);
  // Step 11: a single-stage record cannot select a four-stage pathway.
  expect(await signals(page)).toEqual([
    'Eligible negative — off selected pathway', 'Unassessed', 'Unassessed', 'Unassessed',
  ]);
});

test('conflicting evidence stays ambiguous', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Conflicting'));
  await importCsv(page, 'discord.csv');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/has not permitted/i);
  expect(wb).toMatch(/Both positive and not-detected outcomes are present at Serving/i);
  const sig = await signals(page);
  expect(sig[3]).toBe('Evidence limited');
  // The conflicting stage must not read as a clean eligible positive.
  expect(sig[3]).not.toBe('Eligible positive observed');
});

test('lineage failure: observation stays, attribution is blocked', async ({ page }) => {
  await page.goto('/');
  await createCase(page, uniqueCase('Lineage'));
  await importCsv(page, 'lineage.csv');
  const wb = await runDiagnostic(page);
  expect(wb).toMatch(/has not permitted/i);
  expect(wb).toMatch(/lineage|batch/i);
  // The serving positive is individually eligible, but it is not linked to
  // the selected shared-batch pathway and must not look like pathway evidence.
  expect(wb).not.toMatch(/supports a candidate transition interval/i);
  const sig = await signals(page);
  expect(sig[3]).toBe('Eligible positive — not linked to selected pathway');
  await page.locator('.stage-card').nth(3).click();
  await expect(page.locator('.stage-detail')).toContainText('Eligible · off selected pathway');
  await expect(page.locator('.stage-detail-status')).toContainText('does not contribute to a cross-stage pathway hypothesis');
});
