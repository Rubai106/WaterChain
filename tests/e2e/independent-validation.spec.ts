import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createCase, importCsv, runDiagnostic, uniqueCase } from './helpers';

test.describe('Step 17 — blind independent validation workflow', () => {
  test('exports anonymized packets without engine decisions and imports a reviewer response', async ({ page }) => {
    const cleanName = uniqueCase('BlindReviewClean');
    const blockedName = uniqueCase('BlindReviewBlocked');

    await page.goto('/');
    await createCase(page, cleanName);
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);

    await createCase(page, blockedName);
    await importCsv(page, 'blocked-positive.csv');
    await runDiagnostic(page);

    const panel = page.locator('#independent-review');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Blinded reviewer workbench');
    const cleanCase = panel.locator('.independent-review-workspace', { hasText: cleanName });
    await cleanCase.locator('input[type="checkbox"]').check();
    await panel.getByRole('button', { name: 'Prepare blinded packet' }).click();
    await expect(panel).toContainText(/Prepared 2 blinded case/);

    const packetDownloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download JSON' }).click();
    const packetDownload = await packetDownloadPromise;
    const packetPath = await packetDownload.path();
    expect(packetPath).not.toBeNull();
    const packetText = await fs.readFile(packetPath!, 'utf8');
    const packet = JSON.parse(packetText) as { schema: string; packetId: string; cases: Array<{ review_case_id: string; records: Array<Record<string, unknown>>; journey: unknown }> };
    expect(packet.schema).toBe('waterchain-blinded-independent-review-packet-v1');
    expect(packet.cases).toHaveLength(2);
    expect(packetText).not.toContain(cleanName);
    expect(packetText).not.toContain(blockedName);
    expect(packetText).not.toContain('confidence_label');
    expect(packetText).not.toContain('attribution_permitted');
    expect(packetText).not.toContain('engineCandidateStage');
    expect(packetText).not.toContain('City Lab');
    expect(packetText).not.toContain('QC-01');
    expect(packetText).not.toContain('SRC-1');
    expect(packetText).not.toContain('B-1');
    expect(packet.cases[0].records[0]).toHaveProperty('reviewRecordId');
    expect(packet.cases[0].records[0]).not.toHaveProperty('recordCode');
    expect(packet.cases[0].records[0]).not.toHaveProperty('sampleCode');
    const protocolDownloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download protocol' }).click();
    const protocolDownload = await protocolDownloadPromise;
    const protocolPath = await protocolDownload.path();
    const protocolText = await fs.readFile(protocolPath!, 'utf8');
    expect(protocolText).toContain(packet.packetId);
    expect(protocolText).toContain('candidate_transition');
    expect(protocolText).not.toContain('engineCandidateStage');

    const blockedPacketCase = packet.cases.find((item) => item.records.some((record) => record.blankControl === 'fail'));
    const cleanPacketCase = packet.cases.find((item) => item.records.length === 4 && item.records.every((record) => record.blankControl === 'pass'));
    expect(blockedPacketCase).toBeDefined();
    expect(cleanPacketCase).toBeDefined();
    const blockedCaseId = blockedPacketCase!.review_case_id;
    const cleanCaseId = cleanPacketCase!.review_case_id;
    const responseHeaders = 'reviewer_code,reviewer_role,review_date,packet_id,review_case_id,decision,candidate_stage,supporting_record_ids,limitations_or_conflicts,rationale,rule_issue,rule_issue_description';
    const firstReviewerRows = [
      `${'REV-01'},WASH engineer,2026-10-29,${packet.packetId},${blockedCaseId},abstain,,,Failed serving QC,The record has failed blank control and cannot support this inference,no,`,
      `${'REV-01'},WASH engineer,2026-10-29,${packet.packetId},${cleanCaseId},candidate_transition,serving,R001;R002;R003;R004,,Earlier eligible stages are negative and serving is positive; candidate only,no,`,
    ];
    const responseCsv = [responseHeaders, ...firstReviewerRows].join('\r\n');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'waterchain-blind-review-'));
    const responsePath = path.join(tempDir, 'reviewer-response.csv');
    await fs.writeFile(responsePath, responseCsv, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(responsePath);
    await expect(panel.locator('.independent-review-results')).toBeVisible();
    await expect(panel.locator('.independent-review-metrics')).toContainText('100.0%');
    await expect(panel).toContainText(/Agreement measures differences between reviewers and WaterChain/);
    await expect(panel).toContainText('REV-01');

    // A second pseudonymous reviewer returns the same decisions. The application
    // should preserve both separate sessions and calculate pairwise agreement.
    const secondReviewerRows = [
      `${'REV-02'},Public-health reviewer,2026-10-29,${packet.packetId},${blockedCaseId},abstain,,,Failed control,Failed blank control makes this record unusable,no,`,
      `${'REV-02'},Public-health reviewer,2026-10-29,${packet.packetId},${cleanCaseId},candidate_transition,serving,R001;R002;R003;R004,,The linked path brackets a candidate transition at serving only,no,`,
    ];
    const secondPath = path.join(tempDir, 'reviewer-response-2.csv');
    await fs.writeFile(secondPath, [responseHeaders, ...secondReviewerRows].join('\r\n'), 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(secondPath);
    await expect(panel).toContainText(/Imported 2 case response\(s\) from reviewer REV-02/);
    await expect(panel.locator('.independent-review-results')).toContainText('2 reviewer session(s) recorded');
    await expect(panel.locator('.independent-review-metrics')).toContainText('Inter-reviewer agreement');
    await expect(panel.locator('.independent-review-metrics')).toContainText('100.0%');

    // A local comparison result survives remount/reload; the packet contains no engine decision.
    await page.reload();
    const reloaded = page.locator('#independent-review');
    await reloaded.scrollIntoViewIfNeeded();
    await expect(reloaded.locator('.independent-review-results')).toBeVisible();
    await expect(reloaded.locator('.independent-review-metrics')).toContainText('100.0%');
  });

  test('rejects duplicate, cross-packet, and unknown-alias responses without overwriting prior results', async ({ page }) => {
    const caseName = uniqueCase('BlindReviewMalformed');
    await page.goto('/');
    await createCase(page, caseName);
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    const panel = page.locator('#independent-review');
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole('button', { name: 'Prepare blinded packet' }).click();
    await expect(panel).toContainText(/Prepared 1 blinded case/);
    const latestPacketPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download JSON' }).click();
    const packetDownload = await latestPacketPromise;
    const packetPath = await packetDownload.path();
    const packet = JSON.parse(await fs.readFile(packetPath!, 'utf8')) as { packetId: string; cases: Array<{ review_case_id: string }> };
    const id = packet.cases[0].review_case_id;
    const reviewerHeaders = 'reviewer_code,reviewer_role,review_date,packet_id,review_case_id,decision,candidate_stage,supporting_record_ids,limitations_or_conflicts,rationale,rule_issue,rule_issue_description';
    const valid = `${reviewerHeaders}\nREV-01,WASH engineer,2026-10-29,${packet.packetId},${id},candidate_transition,serving,R001,,Candidate transition is supported by linked records,no,`;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'waterchain-review-duplicate-'));
    const file = path.join(dir, 'reviewer.csv');
    await fs.writeFile(file, valid, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(file);
    await expect(panel.locator('.independent-review-results')).toBeVisible();
    await expect(panel).toContainText('REV-01');

    const invalid = `${valid}\nREV-01,WASH engineer,2026-10-29,${packet.packetId},${id},abstain,,,,Duplicate response row,no,`;
    await fs.writeFile(file, invalid, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(file);
    await expect(panel).toContainText(/Duplicate response for/);
    await expect(panel.locator('.independent-review-results')).toBeVisible();
    await expect(panel).toContainText('REV-01');

    const unknown = `${reviewerHeaders}\nREV-02,WASH engineer,2026-10-29,${packet.packetId},UNKNOWN,abstain,,,,Unknown case ID was supplied,no,`;
    await fs.writeFile(file, unknown, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(file);
    await expect(panel).toContainText(/unknown review_case_id/);
    await expect(panel.locator('.independent-review-results')).toBeVisible();

    const wrongPacket = `${reviewerHeaders}\nREV-02,WASH engineer,2026-10-29,OLD-PACKET,${id},abstain,,,,Wrong packet should be rejected,no,`;
    await fs.writeFile(file, wrongPacket, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(file);
    await expect(panel).toContainText(/packet_id does not match/);
    await expect(panel.locator('.independent-review-results')).toBeVisible();

    const invalidAlias = `${reviewerHeaders}\nREV-02,WASH engineer,2026-10-29,${packet.packetId},${id},candidate_transition,serving,R999,,Unknown record alias should be rejected,no,`;
    await fs.writeFile(file, invalidAlias, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(file);
    await expect(panel).toContainText(/cites unknown record alias/);
    await expect(panel.locator('.independent-review-results')).toBeVisible();
  });
  test('detects a tampered saved packet and blocks download and response import', async ({ page }) => {
    const caseName = uniqueCase('BlindReviewTamper');
    await page.goto('/');
    await createCase(page, caseName);
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    const panel = page.locator('#independent-review');
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole('button', { name: 'Prepare blinded packet' }).click();
    await expect(panel).toContainText(/Prepared 1 blinded case/);
    const packetId = await page.evaluate(() => localStorage.getItem('waterchain:independent-review-latest:v1'));
    expect(packetId).toBeTruthy();
    await page.evaluate((id) => {
      const key = `waterchain:independent-review-packet:v1:${id}`;
      const existing = localStorage.getItem(key);
      if (!existing) throw new Error('Expected a stored packet before tampering test.');
      localStorage.setItem(key, `${existing} `);
    }, packetId);
    await page.reload();
    const reloaded = page.locator('#independent-review');
    await reloaded.scrollIntoViewIfNeeded();
    await expect(reloaded).toContainText(/SHA-256 does not match the private review key/);
    await expect(reloaded.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
    await expect(reloaded.locator('input[aria-label="Choose completed reviewer response CSV"]')).toBeDisabled();
  });

  test('revalidates persisted reviewer sessions and recomputes rather than trusting stored summaries', async ({ page }) => {
    const caseName = uniqueCase('BlindReviewPersistedTamper');
    await page.goto('/');
    await createCase(page, caseName);
    await importCsv(page, 'clean.csv');
    await runDiagnostic(page);
    const panel = page.locator('#independent-review');
    await panel.scrollIntoViewIfNeeded();
    await panel.getByRole('button', { name: 'Prepare blinded packet' }).click();
    await expect(panel).toContainText(/Prepared 1 blinded case/);
    const packetDownloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download JSON' }).click();
    const packetDownload = await packetDownloadPromise;
    const packetPath = await packetDownload.path();
    const packet = JSON.parse(await fs.readFile(packetPath!, 'utf8')) as { packetId: string; cases: Array<{ review_case_id: string }> };
    const headers = 'reviewer_code,reviewer_role,review_date,packet_id,review_case_id,decision,candidate_stage,supporting_record_ids,limitations_or_conflicts,rationale,rule_issue,rule_issue_description';
    const response = `${headers}\nREV-STORED,WASH reviewer,2026-10-29,${packet.packetId},${packet.cases[0].review_case_id},abstain,,,,The available case evidence is not enough for an attribution,no,`;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'waterchain-review-persisted-'));
    const file = path.join(dir, 'reviewer.csv');
    await fs.writeFile(file, response, 'utf8');
    await panel.locator('input[aria-label="Choose completed reviewer response CSV"]').setInputFiles(file);
    await expect(panel.locator('.independent-review-results')).toBeVisible();

    const resultsKey = `waterchain:independent-review-results:v1:${packet.packetId}`;
    await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error('Expected saved reviewer results.');
      const payload = JSON.parse(raw);
      payload.sessions[0].summary = { reviewed: 999, decisionAgreement: 0, decisionDisagreements: [] };
      localStorage.setItem(key, JSON.stringify(payload));
    }, resultsKey);
    await page.reload();
    const restored = page.locator('#independent-review');
    await restored.scrollIntoViewIfNeeded();
    await expect(restored.locator('.independent-review-results')).toBeVisible();
    await expect(restored.locator('.independent-review-metrics div').first()).toContainText('1');

    await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error('Expected reviewer results to remain stored.');
      const payload = JSON.parse(raw);
      payload.sessions[0].responses[0].packet_id = 'WC-PACKET-FOREIGN';
      localStorage.setItem(key, JSON.stringify(payload));
    }, resultsKey);
    const tamperedRaw = await page.evaluate((key) => localStorage.getItem(key), resultsKey);
    await page.reload();
    const tamperedPanel = page.locator('#independent-review');
    await tamperedPanel.scrollIntoViewIfNeeded();
    await expect(tamperedPanel.locator('.independent-review-error')).toContainText(/Saved reviewer responses failed validation/);
    await expect(tamperedPanel.locator('.independent-review-results')).toHaveCount(0);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), resultsKey)).toBe(tamperedRaw);
  });

});
