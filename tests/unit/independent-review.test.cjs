const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '../..');
const sourcePath = path.join(projectRoot, 'lib', 'independent-review.ts');
const sourceText = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(sourceText, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  fileName: sourcePath,
});
const compiled = new Module(sourcePath.replace(/\.ts$/, '.cjs'), module);
compiled.filename = sourcePath.replace(/\.ts$/, '.cjs');
compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
compiled._compile(output.outputText, compiled.filename);
const {
  buildBlindedCase,
  buildReviewerProtocolMarkdown,
  buildReviewerResponseTemplate,
  parseReviewerResponseCsv,
  compareReviewerResponses,
  compareReviewerSessions,
  csvCell,
  sha256Hex,
  matchesSha256Fingerprint,
  validateStoredReviewerResults,
} = compiled.exports;

const packetId = 'WC-PACKET-20261029123456-ABCDEF12';
const caseA = 'WC-BR-ABCDEF12-001';
const caseB = 'WC-BR-ABCDEF12-002';
const recordAliasesByCase = new Map([
  [caseA, new Set(['R001', 'R002', 'R003', 'R004'])],
  [caseB, new Set(['R001', 'R002'])],
]);
const knownCaseIds = new Set([caseA, caseB]);
const headers = ['reviewer_code','reviewer_role','review_date','packet_id','review_case_id','decision','candidate_stage','supporting_record_ids','limitations_or_conflicts','rationale','rule_issue','rule_issue_description'];
function row(values) { return values.map(csvCell).join(','); }
function csv(rows) { return [headers.join(','), ...rows.map(row)].join('\r\n'); }
function validResponses(code = 'REV-01', decisionA = 'candidate_transition') {
  return csv([
    [code, 'WASH reviewer', '2026-10-29', packetId, caseA, decisionA, decisionA === 'candidate_transition' ? 'serving' : '', decisionA === 'candidate_transition' ? 'R001;R002;R003;R004' : '', '', 'Linked observations support this candidate stage only', 'no', ''],
    [code, 'WASH reviewer', '2026-10-29', packetId, caseB, 'abstain', '', '', 'The path is not established', 'Relationship references remain unresolved', 'no', ''],
  ]);
}

test('response template binds every row to the packet and enumerates all cases', () => {
  const template = buildReviewerResponseTemplate(packetId, [caseA, caseB]);
  const lines = template.split(/\r?\n/);
  assert.match(lines[0], /packet_id/);
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes(packetId));
  assert.ok(lines[1].includes(caseA));
  assert.ok(lines[2].includes(caseB));
  const protocol = buildReviewerProtocolMarkdown(packetId, [caseA, caseB]);
  assert.ok(protocol.includes(packetId));
  assert.ok(protocol.includes('candidate_transition'));
  assert.ok(protocol.includes('cannot_assess'));
  assert.ok(protocol.includes(caseB));
  assert.ok(!protocol.includes('engineCandidateStage'));
});

test('valid reviewer responses require a pseudonymous code, role, ISO date, packet ID, valid aliases and rationale', () => {
  const parsed = parseReviewerResponseCsv(validResponses(), knownCaseIds, packetId, recordAliasesByCase);
  assert.equal(parsed.reviewerCode, 'REV-01');
  assert.equal(parsed.responses.length, 2);
  assert.equal(parsed.responses[0].packet_id, packetId);
  assert.deepEqual(parsed.responses[0].supporting_record_ids, ['R001','R002','R003','R004']);
});

test('rejects response copied from a different packet', () => {
  const foreign = validResponses().replaceAll(packetId, 'WC-PACKET-OLD-12345678');
  assert.throws(() => parseReviewerResponseCsv(foreign, knownCaseIds, packetId, recordAliasesByCase), /packet_id does not match/);
});

test('rejects unknown record aliases and requires a support citation for a candidate transition', () => {
  const invalidAlias = validResponses().replace('R001;R002;R003;R004', 'R999');
  assert.throws(() => parseReviewerResponseCsv(invalidAlias, knownCaseIds, packetId, recordAliasesByCase), /unknown record alias/);
  const noSupport = validResponses().replace('R001;R002;R003;R004', '');
  assert.throws(() => parseReviewerResponseCsv(noSupport, knownCaseIds, packetId, recordAliasesByCase), /requires at least one supporting record alias/);
});

test('rejects malformed dates, missing rationale, duplicate rows, and unknown cases', () => {
  assert.throws(() => parseReviewerResponseCsv(validResponses().replaceAll('2026-10-29', '2026-02-30'), knownCaseIds, packetId, recordAliasesByCase), /valid ISO date/);
  assert.throws(() => parseReviewerResponseCsv(validResponses().replace('Linked observations support this candidate stage only', 'short'), knownCaseIds, packetId, recordAliasesByCase), /rationale must contain at least 8/);
  const valid = validResponses().split(/\r?\n/);
  assert.throws(() => parseReviewerResponseCsv([valid[0], valid[1], valid[1]].join('\n'), knownCaseIds, packetId, recordAliasesByCase), /Duplicate response/);
  const unknown = validResponses().replace(caseB, 'WC-BR-UNKNOWN-001');
  assert.throws(() => parseReviewerResponseCsv(unknown, knownCaseIds, packetId, recordAliasesByCase), /unknown review_case_id/);
  const invalidDate = validResponses().replaceAll('2026-10-29', '2026-99-99');
  assert.throws(() => parseReviewerResponseCsv(invalidDate, knownCaseIds, packetId, recordAliasesByCase), /valid ISO date/);
});

test('candidate transition and stage disagreement are described without treating engine as gold standard', () => {
  const cases = [
    { reviewCaseId: caseA, engineDecision: 'candidate_transition', engineCandidateStage: 'serving' },
    { reviewCaseId: caseB, engineDecision: 'abstain', engineCandidateStage: null },
  ];
  const parsed1 = parseReviewerResponseCsv(validResponses('REV-01'), knownCaseIds, packetId, recordAliasesByCase);
  const parsed2 = parseReviewerResponseCsv(validResponses('REV-02'), knownCaseIds, packetId, recordAliasesByCase);
  const session = (parsed) => ({ reviewerCode: parsed.reviewerCode, reviewerRole: parsed.reviewerRole, reviewDate: parsed.reviewDate, responses: parsed.responses, summary: compareReviewerResponses(cases, parsed.responses), importedAt: '2026-10-29T00:00:00.000Z' });
  const summary = compareReviewerSessions(cases, [session(parsed1), session(parsed2)]);
  assert.equal(summary.reviewerSessionCount, 2);
  assert.equal(summary.decisionAgreement, 1);
  assert.equal(summary.interReviewerDecisionAgreement, 1);
  assert.equal(summary.interReviewerPairs, 2);
});

test('blinded case keeps necessary evidence topology but omits raw names, IDs, and notes', () => {
  const record = {
    id: 'rec-internal-123', recordCode: 'SAMPLE-CODE-SECRET', sampleCode: 'BOTTLE-SECRET',
    stage: 'source', collectedAt: '2026-10-01T08:00:00Z', waterSourceId: 'SOURCE-SECRET', batchId: 'BATCH-SECRET',
    analyte: 'e_coli_presence', result: 'not_detected', numericValue: null, unit: null, method: 'Membrane filtration',
    labName: 'Secret Lab Name', positiveControl: 'pass', negativeControl: 'pass', blankControl: 'pass',
    sourceReference: 'PRIVATE-REPORT-REF', notes: 'Secret field location and household information',
  };
  const built = buildBlindedCase({ reviewCaseId: caseA, records: [record], journeyModel: null });
  const serialized = JSON.stringify(built.payload);
  assert.ok(serialized.includes('R001'));
  assert.ok(serialized.includes('not_detected'));
  for (const secret of ['rec-internal-123','SAMPLE-CODE-SECRET','BOTTLE-SECRET','SOURCE-SECRET','BATCH-SECRET','Secret Lab Name','PRIVATE-REPORT-REF','Secret field location']) {
    assert.ok(!serialized.includes(secret), `raw value leaked: ${secret}`);
  }
  assert.equal(built.recordMap.R001.id, 'rec-internal-123');
});

test('rejects duplicate immutable record IDs before creating an ambiguous alias map', () => {
  const duplicate = { id: 'same-id', recordCode: 'CODE-A', sampleCode: 'SAMPLE-A', stage: 'source', collectedAt: '2026-10-01T08:00:00Z', waterSourceId: 'SRC-A', batchId: 'BATCH-A', analyte: 'e_coli_presence', result: 'not_detected', numericValue: null, unit: null, method: 'Membrane filtration', labName: 'Lab A', positiveControl: 'pass', negativeControl: 'pass', blankControl: 'pass', sourceReference: '', notes: '' };
  assert.throws(() => buildBlindedCase({ reviewCaseId: caseA, records: [duplicate, { ...duplicate, recordCode: 'CODE-B', sampleCode: 'SAMPLE-B' }], journeyModel: null }), /duplicate immutable record IDs/);
});

test('CSV export formula guards remain active for reviewer-controlled fields', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('normal value'), 'normal value');
});


test('packet SHA-256 fingerprint detects packet edits without implying source authenticity', async () => {
  const original = JSON.stringify({ packetId, cases: [{ review_case_id: caseA, decisionOptions: ['candidate_transition', 'abstain', 'cannot_assess'] }] });
  const fingerprint = await sha256Hex(original);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(await matchesSha256Fingerprint(original, fingerprint), true);
  assert.equal(await matchesSha256Fingerprint(`${original} `, fingerprint), false);
  assert.equal(await matchesSha256Fingerprint(original, 'not-a-hash'), false);
});


test('stored reviewer results are schema-checked against the private manifest and summaries are recomputed', () => {
  const manifestCases = [
    { reviewCaseId: caseA, engineDecision: 'candidate_transition', engineCandidateStage: 'serving', recordMap: { R001: {}, R002: {}, R003: {}, R004: {} } },
    { reviewCaseId: caseB, engineDecision: 'abstain', engineCandidateStage: null, recordMap: { R001: {}, R002: {} } },
  ];
  const manifest = { schema: 'waterchain-blind-review-private-v1', packetId, createdAt: '2026-10-29T00:00:00Z', packetFingerprint: 'a'.repeat(64), cases: manifestCases };
  const parsed = parseReviewerResponseCsv(validResponses(), knownCaseIds, packetId, recordAliasesByCase);
  const raw = { schema: 'waterchain-independent-review-sessions-v1', sessions: [{
    reviewerCode: parsed.reviewerCode, reviewerRole: parsed.reviewerRole, reviewDate: parsed.reviewDate,
    responses: parsed.responses, summary: { reviewed: 999, decisionAgreement: 0 }, importedAt: '2026-10-29T00:00:00.000Z',
  }] };
  const validated = validateStoredReviewerResults(raw, manifest);
  assert.equal(validated.sessions.length, 1);
  assert.equal(validated.sessions[0].summary.reviewed, 2);
  assert.equal(validated.sessions[0].summary.decisionAgreement, 1);
});

test('stored reviewer results reject cross-packet responses, aliases from another case, and duplicate reviewers', () => {
  const manifestCases = [
    { reviewCaseId: caseA, engineDecision: 'candidate_transition', engineCandidateStage: 'serving', recordMap: { R001: {}, R002: {}, R003: {}, R004: {} } },
    { reviewCaseId: caseB, engineDecision: 'abstain', engineCandidateStage: null, recordMap: { R001: {}, R002: {} } },
  ];
  const manifest = { schema: 'waterchain-blind-review-private-v1', packetId, createdAt: '2026-10-29T00:00:00Z', packetFingerprint: 'a'.repeat(64), cases: manifestCases };
  const parsed = parseReviewerResponseCsv(validResponses(), knownCaseIds, packetId, recordAliasesByCase);
  const session = { reviewerCode: parsed.reviewerCode, reviewerRole: parsed.reviewerRole, reviewDate: parsed.reviewDate, responses: parsed.responses, summary: {}, importedAt: '2026-10-29T00:00:00.000Z' };
  const validStored = { schema: 'waterchain-independent-review-sessions-v1', sessions: [session] };
  const foreignPacket = structuredClone(validStored);
  foreignPacket.sessions[0].responses[0].packet_id = 'WC-PACKET-OTHER-00000000';
  assert.throws(() => validateStoredReviewerResults(foreignPacket, manifest), /metadata or packet ID inconsistent/);
  const foreignAlias = structuredClone(validStored);
  foreignAlias.sessions[0].responses[1].supporting_record_ids = ['R004'];
  assert.throws(() => validateStoredReviewerResults(foreignAlias, manifest), /unknown alias/);
  const duplicateReviewer = structuredClone(validStored);
  duplicateReviewer.sessions.push(structuredClone(duplicateReviewer.sessions[0]));
  assert.throws(() => validateStoredReviewerResults(duplicateReviewer, manifest), /Duplicate reviewer code/);
});
