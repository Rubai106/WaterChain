import type { DiagnosticReport } from '@/lib/diagnostics';
import type { EvidenceRecord, EvidenceStage } from '@/lib/evidence';
import type { SelectedJourneyModel } from '@/lib/investigation-model';


export async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable; the reviewer packet cannot be fingerprinted safely.');
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function matchesSha256Fingerprint(text: string, expectedFingerprint: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(expectedFingerprint)) return false;
  return (await sha256Hex(text)) === expectedFingerprint.toLowerCase();
}

export type ReviewDecision = 'candidate_transition' | 'abstain' | 'cannot_assess';
export type ReviewerResponse = {
  reviewer_code: string;
  reviewer_role: string;
  review_date: string;
  packet_id: string;
  review_case_id: string;
  decision: ReviewDecision;
  candidate_stage: EvidenceStage | '';
  supporting_record_ids: string[];
  limitations_or_conflicts: string;
  rationale: string;
  rule_issue: 'yes' | 'no' | '';
  rule_issue_description: string;
};
export type EngineReferenceDecision = { decision: ReviewDecision; candidateStage: EvidenceStage | null };
export type BlindReviewCasePrivate = {
  reviewCaseId: string;
  workspaceId: string;
  workspaceName: string;
  evidenceFingerprint: string;
  reportGeneratedAt: string;
  engineDecision: ReviewDecision;
  engineCandidateStage: EvidenceStage | null;
  recordMap: Record<string, { id: string; recordCode: string; sampleCode: string }>;
};
export type BlindReviewPrivateManifest = {
  schema: 'waterchain-blind-review-private-v1';
  packetId: string;
  createdAt: string;
  packetFingerprint: string;
  cases: BlindReviewCasePrivate[];
};
export type AgreementSummary = {
  reviewed: number;
  decisionAgreement: number | null;
  exactStageAgreement: number | null;
  reviewerCandidateEngineAbstain: number;
  reviewerAbstainEngineCandidate: number;
  cannotAssessDisagreements: number;
  decisionDisagreements: Array<{ reviewCaseId: string; reviewerCode: string; engine: ReviewDecision; reviewer: ReviewDecision; engineStage: string | null; reviewerStage: string | null; rationale: string }>;
  stageDisagreements: Array<{ reviewCaseId: string; reviewerCode: string; engineStage: string | null; reviewerStage: string | null; rationale: string }>;
};
export type ReviewerSession = { reviewerCode: string; reviewerRole: string; reviewDate: string; responses: ReviewerResponse[]; summary: AgreementSummary; importedAt: string };
export type SessionAgreementSummary = AgreementSummary & { interReviewerDecisionAgreement: number | null; interReviewerPairs: number; reviewerSessionCount: number };

export type StoredReviewerResults = { schema: 'waterchain-independent-review-sessions-v1'; sessions: ReviewerSession[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Validate browser-persisted reviewer responses against the private packet manifest.
 * The stored summary is never trusted: it is recomputed from the validated response rows.
 * Throws on corrupted/tampered data so callers can preserve and surface the failure.
 */
export function validateStoredReviewerResults(input: unknown, manifest: BlindReviewPrivateManifest): StoredReviewerResults {
  if (!isPlainObject(input) || input.schema !== 'waterchain-independent-review-sessions-v1' || !Array.isArray(input.sessions)) {
    throw new Error('Saved reviewer results have an invalid schema. They were not overwritten.');
  }
  if (!manifest || manifest.schema !== 'waterchain-blind-review-private-v1' || !manifest.packetId || !Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error('The private reviewer manifest is incomplete; saved responses cannot be validated.');
  }
  if (input.sessions.length > 100) throw new Error('Saved reviewer results exceed the local session limit of 100.');
  const caseIds = manifest.cases.map((item) => item.reviewCaseId);
  const caseIdSet = new Set(caseIds);
  if (caseIdSet.size !== caseIds.length) throw new Error('The private reviewer manifest has duplicate case IDs.');
  const reviewers = new Set<string>();
  const validated: ReviewerSession[] = [];

  input.sessions.forEach((rawSession, sessionIndex) => {
    const label = `Saved reviewer session ${sessionIndex + 1}`;
    if (!isPlainObject(rawSession)) throw new Error(`${label} is malformed and was not overwritten.`);
    const reviewerCode = typeof rawSession.reviewerCode === 'string' ? rawSession.reviewerCode.trim() : '';
    const reviewerRole = typeof rawSession.reviewerRole === 'string' ? rawSession.reviewerRole.trim() : '';
    const reviewDate = typeof rawSession.reviewDate === 'string' ? rawSession.reviewDate.trim() : '';
    const importedAt = typeof rawSession.importedAt === 'string' ? rawSession.importedAt : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(reviewerCode)) throw new Error(`${label} has an invalid pseudonymous reviewer code.`);
    if (reviewerRole.length < 2 || reviewerRole.length > 80) throw new Error(`${label} has an invalid reviewer role.`);
    if (!validIsoDate(reviewDate)) throw new Error(`${label} has an invalid review date.`);
    if (!importedAt || !Number.isFinite(Date.parse(importedAt))) throw new Error(`${label} has an invalid import timestamp.`);
    const reviewerKey = reviewerCode.toLowerCase();
    if (reviewers.has(reviewerKey)) throw new Error(`Duplicate reviewer code ${reviewerCode} exists in saved results. Original data were preserved.`);
    reviewers.add(reviewerKey);
    if (!Array.isArray(rawSession.responses) || rawSession.responses.length !== caseIds.length) {
      throw new Error(`${label} must contain exactly one response for every case in this packet.`);
    }
    const seenCases = new Set<string>();
    const responses: ReviewerResponse[] = rawSession.responses.map((rawResponse, responseIndex) => {
      const rowLabel = `${label}, response ${responseIndex + 1}`;
      if (!isPlainObject(rawResponse)) throw new Error(`${rowLabel} is malformed.`);
      const response = rawResponse;
      if (response.reviewer_code !== reviewerCode || response.reviewer_role !== reviewerRole || response.review_date !== reviewDate || response.packet_id !== manifest.packetId) {
        throw new Error(`${rowLabel} has reviewer metadata or packet ID inconsistent with its session.`);
      }
      const caseId = typeof response.review_case_id === 'string' ? response.review_case_id : '';
      if (!caseIdSet.has(caseId)) throw new Error(`${rowLabel} refers to a case outside the current packet.`);
      if (seenCases.has(caseId)) throw new Error(`${rowLabel} duplicates a case response.`);
      seenCases.add(caseId);
      const decision = response.decision;
      if (decision !== 'candidate_transition' && decision !== 'abstain' && decision !== 'cannot_assess') throw new Error(`${rowLabel} has an unsupported decision.`);
      const stage = response.candidate_stage;
      const allowedStages = ['source', 'collection', 'storage', 'serving'];
      if (decision === 'candidate_transition' && !allowedStages.includes(String(stage))) throw new Error(`${rowLabel} must name a valid candidate stage.`);
      if (decision !== 'candidate_transition' && stage !== '') throw new Error(`${rowLabel} must not include a candidate stage for an abstention or cannot_assess decision.`);
      if (!Array.isArray(response.supporting_record_ids) || response.supporting_record_ids.some((alias) => typeof alias !== 'string')) throw new Error(`${rowLabel} has an invalid supporting-record list.`);
      const caseRecordMap = manifest.cases.find((item) => item.reviewCaseId === caseId)?.recordMap ?? {};
      const allowedAliases = new Set(Object.keys(caseRecordMap));
      const aliases = response.supporting_record_ids as string[];
      if (new Set(aliases).size !== aliases.length) throw new Error(`${rowLabel} repeats a supporting record alias.`);
      const unknownAlias = aliases.find((alias) => !allowedAliases.has(alias));
      if (unknownAlias) throw new Error(`${rowLabel} cites an unknown alias ${unknownAlias}.`);
      if (decision === 'candidate_transition' && aliases.length === 0) throw new Error(`${rowLabel} must cite at least one supporting record alias.`);
      if (typeof response.limitations_or_conflicts !== 'string' || typeof response.rationale !== 'string' || response.rationale.trim().length < 8) throw new Error(`${rowLabel} has a missing or too-short rationale.`);
      if (response.rule_issue !== '' && response.rule_issue !== 'yes' && response.rule_issue !== 'no') throw new Error(`${rowLabel} has an invalid rule_issue value.`);
      if (typeof response.rule_issue_description !== 'string' || (response.rule_issue === 'yes' && response.rule_issue_description.trim().length < 8)) throw new Error(`${rowLabel} needs a description for its reported rule issue.`);
      return {
        reviewer_code: reviewerCode,
        reviewer_role: reviewerRole,
        review_date: reviewDate,
        packet_id: manifest.packetId,
        review_case_id: caseId,
        decision,
        candidate_stage: decision === 'candidate_transition' ? stage as EvidenceStage : '',
        supporting_record_ids: [...aliases],
        limitations_or_conflicts: response.limitations_or_conflicts,
        rationale: response.rationale.trim(),
        rule_issue: response.rule_issue,
        rule_issue_description: response.rule_issue_description.trim(),
      };
    });
    if (seenCases.size !== caseIdSet.size) throw new Error(`${label} is missing one or more case responses.`);
    validated.push({
      reviewerCode,
      reviewerRole,
      reviewDate,
      responses,
      // Stored summaries can be edited independently in local storage, so recalculate.
      summary: compareReviewerResponses(manifest.cases, responses),
      importedAt,
    });
  });
  return { schema: 'waterchain-independent-review-sessions-v1', sessions: validated };
}

export function classifyEngineDecision(report: DiagnosticReport, recordCount: number): EngineReferenceDecision {
  const eligibleCount = report.evidence_summary.eligible_records;
  if (recordCount === 0 || eligibleCount === 0 || report.confidence_label === 'not assessed') {
    return { decision: 'cannot_assess', candidateStage: null };
  }
  if (report.attribution_permitted && report.confidence_label === 'candidate transition only') {
    const candidate = report.hypotheses.find((hypothesis) => hypothesis.status === 'observed_positive');
    return { decision: 'candidate_transition', candidateStage: (candidate?.stage as EvidenceStage | undefined) ?? null };
  }
  return { decision: 'abstain', candidateStage: null };
}

function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (quoted) throw new Error('CSV has an opening quote without a matching closing quote.');
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Reviewer files are imported as data only; formula-like fields are prefixed
  // on export so opening a CSV in a spreadsheet does not execute formulas.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildReviewerResponseTemplate(packetId: string, caseIds: string[]): string {
  const headers = ['reviewer_code', 'reviewer_role', 'review_date', 'packet_id', 'review_case_id', 'decision', 'candidate_stage', 'supporting_record_ids', 'limitations_or_conflicts', 'rationale', 'rule_issue', 'rule_issue_description'];
  return [headers.join(','), ...caseIds.map((id) => ['', '', '', packetId, id, '', '', '', '', '', '', ''].map(csvCell).join(','))].join('\r\n');
}

export function buildReviewerProtocolMarkdown(packetId: string, caseIds: string[]): string {
  return `# WaterChain blinded independent-review protocol

Packet ID: \`${packetId}\`  
Case count: ${caseIds.length}

## Purpose

Review the supplied evidence and relationships independently. Do not assume WaterChain is correct. This packet does not include the engine's expected decisions. Reviewer-engine agreement is descriptive, not diagnostic accuracy. Do not claim a candidate transition proves causal origin.

## Decision options

- \`candidate_transition\`: evidence supports a *candidate* transition interval and the chosen stage; it does not prove where contamination originated. Cite at least one supporting record alias from that case.
- \`abstain\`: evidence exists but sample linkage, transfer support, chronology, QC, result consistency, or pathway coverage is insufficient for a candidate transition.
- \`cannot_assess\`: there is no usable evidence or the case cannot be assessed from the packet.

## Rules for the response CSV

- Complete exactly one row per case in the supplied response template. Do not add or remove case IDs.
- Put the exact packet ID \`${packetId}\` in every \`packet_id\` cell. Responses from another packet will be rejected.
- Use a pseudonymous \`reviewer_code\` (2–32 letters/numbers/hyphens/underscores), a role label, and a valid review date in \`YYYY-MM-DD\` format. Do not enter a personal name as the reviewer code.
- The candidate stage must be \`source\`, \`collection\`, \`storage\`, or \`serving\` only for \`candidate_transition\`; otherwise leave it blank.
- Cite supporting records with aliases printed in the case (for example \`R001;R002\`). Aliases are case-specific; unknown aliases are rejected.
- Provide a rationale of at least eight characters per case. If \`rule_issue\` is \`yes\`, explain the suspected issue in \`rule_issue_description\`.
- Record limitations, contradictory evidence, uncertain relationships, and missing information. Do not infer a transfer solely from a shared source or visit.

## Cases in this packet

${caseIds.map((id) => `- ${id}`).join('\n')}

## Privacy and interpretation

The packet uses aliases and relative timestamps, but scientific measurements and relationship topology may still be sensitive. Share only with an authorized reviewer and do not put the packet in a public repository. A SHA-256 fingerprint can detect a change relative to a known packet; it does not authenticate the sample, lab, document author, or reviewer.

The prototype's outputs are not a gold standard. Report your own rationale and uncertainty. Do not coordinate decisions with other reviewers until each individual response is frozen.
`;
}

export function parseReviewerResponseCsv(input: string, knownCaseIds: Set<string>, expectedPacketId: string, recordAliasesByCase: Map<string, Set<string>>): { reviewerCode: string; reviewerRole: string; reviewDate: string; responses: ReviewerResponse[] } {
  const rows = parseCsvRows(input);
  if (rows.length < 2) throw new Error('Reviewer CSV needs a header and at least one response row.');
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const required = ['reviewer_code', 'reviewer_role', 'review_date', 'packet_id', 'review_case_id', 'decision', 'candidate_stage', 'supporting_record_ids', 'limitations_or_conflicts', 'rationale', 'rule_issue', 'rule_issue_description'];
  if (new Set(headers).size !== headers.length) throw new Error('Reviewer CSV has duplicate headers.');
  if (required.some((header) => !headers.includes(header))) throw new Error(`Reviewer CSV must include these columns: ${required.join(', ')}.`);
  const parsedRows = rows.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2} has ${cells.length} cells; expected ${headers.length}.`);
    const row: Record<string, string> = {};
    headers.forEach((header, col) => { row[header] = cells[col] ?? ''; });
    return { row, rowNumber: index + 2 };
  });
  const reviewerCode = parsedRows[0].row.reviewer_code.trim();
  const reviewerRole = parsedRows[0].row.reviewer_role.trim();
  const reviewDate = parsedRows[0].row.review_date.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(reviewerCode)) throw new Error('reviewer_code is required and must be 2–32 letters, numbers, hyphens, or underscores. Use a pseudonymous code, not a personal name.');
  if (reviewerRole.length < 2 || reviewerRole.length > 80) throw new Error('reviewer_role must be 2–80 characters and should describe a role, not a personal name.');
  const dateFormatValid = /^\d{4}-\d{2}-\d{2}$/.test(reviewDate);
  const parsedReviewDate = dateFormatValid ? new Date(`${reviewDate}T00:00:00.000Z`) : null;
  if (!parsedReviewDate || !Number.isFinite(parsedReviewDate.getTime()) || parsedReviewDate.toISOString().slice(0, 10) !== reviewDate) throw new Error('review_date must be a valid ISO date in YYYY-MM-DD format.');
  if (parsedRows.some(({ row }) => row.packet_id.trim() !== expectedPacketId)) throw new Error('Response packet_id does not match the currently loaded blinded packet.');
  if (parsedRows.some(({ row }) => row.reviewer_code.trim() !== reviewerCode)) throw new Error('All rows in one response file must use the same reviewer_code.');
  if (parsedRows.some(({ row }) => row.reviewer_role.trim() !== reviewerRole || row.review_date.trim() !== reviewDate)) throw new Error('Reviewer role and review_date must be consistent across all rows in one response file.');
  const result: ReviewerResponse[] = [];
  const seen = new Set<string>();
  parsedRows.forEach(({ row, rowNumber }) => {
    const id = row.review_case_id.trim();
    if (!knownCaseIds.has(id)) throw new Error(`Row ${rowNumber} refers to unknown review_case_id "${id}".`);
    if (seen.has(id)) throw new Error(`Duplicate response for ${id}. Each case must have at most one response per imported file.`);
    seen.add(id);
    const decision = row.decision.trim().toLowerCase();
    if (!['candidate_transition', 'abstain', 'cannot_assess'].includes(decision)) throw new Error(`Row ${rowNumber} has invalid decision. Use candidate_transition, abstain, or cannot_assess.`);
    const stage = row.candidate_stage.trim().toLowerCase();
    if (stage && !['source', 'collection', 'storage', 'serving'].includes(stage)) throw new Error(`Row ${rowNumber} has invalid candidate_stage.`);
    if (decision === 'candidate_transition' && !stage) throw new Error(`Row ${rowNumber}: candidate_transition requires candidate_stage.`);
    if (decision !== 'candidate_transition' && stage) throw new Error(`Row ${rowNumber}: candidate_stage must be blank unless decision is candidate_transition.`);
    const ruleIssue = row.rule_issue.trim().toLowerCase();
    if (ruleIssue && !['yes', 'no'].includes(ruleIssue)) throw new Error(`Row ${rowNumber} has invalid rule_issue. Use yes, no, or blank.`);
    const supportingRecordIds = row.supporting_record_ids.split(/[;|]/).map((v) => v.trim()).filter(Boolean);
    const allowedAliases = recordAliasesByCase.get(id);
    if (!allowedAliases) throw new Error(`No private record-alias map is available for ${id}. The response cannot be verified.`);
    const unknownAlias = supportingRecordIds.find((alias) => !allowedAliases.has(alias));
    if (unknownAlias) throw new Error(`Row ${rowNumber} cites unknown record alias "${unknownAlias}" for ${id}. Use aliases from that case only.`);
    if (decision === 'candidate_transition' && supportingRecordIds.length === 0) throw new Error(`Row ${rowNumber}: candidate_transition requires at least one supporting record alias.`);
    if (row.rationale.trim().length < 8) throw new Error(`Row ${rowNumber}: rationale must contain at least 8 characters.`);
    if (ruleIssue === 'yes' && row.rule_issue_description.trim().length < 8) throw new Error(`Row ${rowNumber}: describe the suspected rule issue in at least 8 characters.`);
    result.push({
      reviewer_code: reviewerCode, reviewer_role: reviewerRole, review_date: reviewDate, packet_id: expectedPacketId,
      review_case_id: id, decision: decision as ReviewDecision, candidate_stage: stage as EvidenceStage | '',
      supporting_record_ids: supportingRecordIds,
      limitations_or_conflicts: row.limitations_or_conflicts.trim(), rationale: row.rationale.trim(),
      rule_issue: ruleIssue as 'yes' | 'no' | '', rule_issue_description: row.rule_issue_description.trim(),
    });
  });
  if (seen.size !== knownCaseIds.size || [...knownCaseIds].some((id) => !seen.has(id))) {
    throw new Error(`Response is incomplete: expected exactly ${knownCaseIds.size} unique case response(s). Use cannot_assess when a case cannot be reviewed.`);
  }
  return { reviewerCode, reviewerRole, reviewDate, responses: result };
}

export function compareReviewerResponses(privateCases: BlindReviewCasePrivate[], responses: ReviewerResponse[]): AgreementSummary {
  const casesById = new Map(privateCases.map((item) => [item.reviewCaseId, item]));
  let agreement = 0;
  let sameStage = 0;
  let candidateStageN = 0;
  let reviewerCandidateEngineAbstain = 0;
  let reviewerAbstainEngineCandidate = 0;
  let cannotAssessDisagreements = 0;
  const decisionDisagreements: AgreementSummary['decisionDisagreements'] = [];
  const stageDisagreements: AgreementSummary['stageDisagreements'] = [];
  for (const response of responses) {
    const engine = casesById.get(response.review_case_id);
    if (!engine) continue;
    if (engine.engineDecision === response.decision) agreement += 1;
    if (response.decision === 'candidate_transition' && engine.engineDecision !== 'candidate_transition') reviewerCandidateEngineAbstain += 1;
    if (response.decision !== 'candidate_transition' && engine.engineDecision === 'candidate_transition') reviewerAbstainEngineCandidate += 1;
    if ((response.decision === 'cannot_assess') !== (engine.engineDecision === 'cannot_assess') &&
        (response.decision === 'cannot_assess' || engine.engineDecision === 'cannot_assess')) cannotAssessDisagreements += 1;
    if (engine.engineDecision === 'candidate_transition' && response.decision === 'candidate_transition') {
      candidateStageN += 1;
      if (engine.engineCandidateStage === response.candidate_stage) sameStage += 1;
      else stageDisagreements.push({ reviewCaseId: response.review_case_id, reviewerCode: response.reviewer_code, engineStage: engine.engineCandidateStage, reviewerStage: response.candidate_stage || null, rationale: response.rationale });
    }
    if (engine.engineDecision !== response.decision) {
      decisionDisagreements.push({ reviewCaseId: response.review_case_id, reviewerCode: response.reviewer_code, engine: engine.engineDecision, reviewer: response.decision, engineStage: engine.engineCandidateStage, reviewerStage: response.candidate_stage || null, rationale: response.rationale });
    }
  }
  return {
    reviewed: responses.length,
    decisionAgreement: responses.length ? agreement / responses.length : null,
    exactStageAgreement: candidateStageN ? sameStage / candidateStageN : null,
    reviewerCandidateEngineAbstain,
    reviewerAbstainEngineCandidate,
    cannotAssessDisagreements,
    decisionDisagreements,
    stageDisagreements,
  };
}

export type BlindedEvidenceRecord = {
  reviewRecordId: string;
  stage: EvidenceStage;
  hoursFromFirstKnownTimestamp: number | null;
  sourceAlias: string | null;
  batchAlias: string | null;
  analyte: string;
  result: string;
  numericValue: number | null;
  unit: string | null;
  method: string | null;
  laboratoryAlias: string | null;
  positiveControl: string;
  negativeControl: string;
  blankControl: string;
  sourceReferencePresent: boolean;
  notesPresent: boolean;
};
export type BlindedCasePayload = {
  review_case_id: string;
  case_label: string;
  records: BlindedEvidenceRecord[];
  journey: null | {
    sourceKind: string;
    sourceIdentifierPresent: boolean;
    samplingEvents: Array<{ reviewRecordId: string; stage: EvidenceStage; hoursFromFirstKnownTimestamp: number | null; entityAlias: string | null; relationshipBasis: string; referencePresent: boolean; notesPresent: boolean }>;
    transferEvents: Array<{ fromStage: string; toStage: string; fromEntityAlias: string | null; toEntityAlias: string | null; transferKind: string; hoursFromFirstKnownTimestamp: number | null; evidenceBasis: string; referencePresent: boolean; notesPresent: boolean }>;
  };
};
export type BlindPacketBuildInput = { reviewCaseId: string; records: EvidenceRecord[]; journeyModel: SelectedJourneyModel | null };
export type BlindPacketBuildResult = { payload: BlindedCasePayload; recordMap: BlindReviewCasePrivate['recordMap'] };

export function buildBlindedCase(input: BlindPacketBuildInput): BlindPacketBuildResult {
  const internalIds = input.records.map((record) => record.id);
  if (new Set(internalIds).size !== internalIds.length) throw new Error('Cannot create a blinded reviewer packet because duplicate immutable record IDs make the record-alias mapping ambiguous. Resolve the duplicate IDs before review.');
  const stages: EvidenceStage[] = ['source', 'collection', 'storage', 'serving'];
  const sortedRecords = [...input.records].sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage)
    || ((a.collectedAt ? Date.parse(a.collectedAt) : Number.POSITIVE_INFINITY) - (b.collectedAt ? Date.parse(b.collectedAt) : Number.POSITIVE_INFINITY))
    || a.id.localeCompare(b.id));
  const recordMap: BlindReviewCasePrivate['recordMap'] = {};
  const recordAliases = new Map<string, string>();
  sortedRecords.forEach((record, index) => {
    const reviewRecordId = `R${String(index + 1).padStart(3, '0')}`;
    recordAliases.set(record.id, reviewRecordId);
    recordMap[reviewRecordId] = { id: record.id, recordCode: record.recordCode, sampleCode: record.sampleCode };
  });
  const sourceAliases = new Map<string, string>();
  const batchAliases = new Map<string, string>();
  const labAliases = new Map<string, string>();
  const entityAliases = new Map<string, string>();
  const alias = (map: Map<string, string>, raw: string | null | undefined, prefix: string) => {
    if (!raw?.trim()) return null;
    const key = raw.trim();
    if (!map.has(key)) map.set(key, `${prefix}${String(map.size + 1).padStart(2, '0')}`);
    return map.get(key)!;
  };
  const timestamps: number[] = [];
  for (const record of sortedRecords) if (record.collectedAt) { const time = Date.parse(record.collectedAt); if (Number.isFinite(time)) timestamps.push(time); }
  if (input.journeyModel) {
    for (const event of input.journeyModel.samplingEvents) if (event.sampledAt) { const time = Date.parse(event.sampledAt); if (Number.isFinite(time)) timestamps.push(time); }
    for (const event of input.journeyModel.transferEvents) if (event.occurredAt) { const time = Date.parse(event.occurredAt); if (Number.isFinite(time)) timestamps.push(time); }
  }
  const firstTimestamp = timestamps.length ? Math.min(...timestamps) : null;
  const relativeTime = (raw: string | null | undefined) => {
    if (firstTimestamp === null || !raw) return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? Math.round(((parsed - firstTimestamp) / 3_600_000) * 10) / 10 : null;
  };
  const records: BlindedEvidenceRecord[] = sortedRecords.map((record) => ({
    reviewRecordId: recordAliases.get(record.id)!, stage: record.stage,
    hoursFromFirstKnownTimestamp: relativeTime(record.collectedAt),
    sourceAlias: alias(sourceAliases, record.waterSourceId, 'S'),
    batchAlias: alias(batchAliases, record.batchId, 'B'),
    analyte: record.analyte, result: record.result, numericValue: record.numericValue, unit: record.unit,
    method: record.method, laboratoryAlias: alias(labAliases, record.labName, 'LAB'),
    positiveControl: record.positiveControl, negativeControl: record.negativeControl, blankControl: record.blankControl,
    sourceReferencePresent: Boolean(record.sourceReference?.trim()), notesPresent: Boolean(record.notes?.trim()),
  }));
  const journey = input.journeyModel ? {
    sourceKind: input.journeyModel.source.kind,
    sourceIdentifierPresent: Boolean(input.journeyModel.source.sourceIdentifier?.trim()),
    samplingEvents: input.journeyModel.samplingEvents.map((event) => ({
      reviewRecordId: recordAliases.get(event.evidenceRecordId) ?? 'UNMAPPED_RECORD', stage: event.stage,
      hoursFromFirstKnownTimestamp: relativeTime(event.sampledAt), entityAlias: alias(entityAliases, event.waterEntityRef, 'E'),
      relationshipBasis: event.relationshipBasis, referencePresent: Boolean(event.relationshipReference?.trim()), notesPresent: Boolean(event.notes?.trim()),
    })),
    transferEvents: input.journeyModel.transferEvents.map((event) => ({
      fromStage: event.fromStage, toStage: event.toStage,
      fromEntityAlias: alias(entityAliases, event.fromEntityRef, 'E'), toEntityAlias: alias(entityAliases, event.toEntityRef, 'E'),
      transferKind: event.transferKind, hoursFromFirstKnownTimestamp: relativeTime(event.occurredAt), evidenceBasis: event.evidenceBasis,
      referencePresent: Boolean(event.sourceReference?.trim()), notesPresent: Boolean(event.notes?.trim()),
    })),
  } : null;
  return { payload: { review_case_id: input.reviewCaseId, case_label: `Blinded case ${input.reviewCaseId}`, records, journey }, recordMap };
}

export function decisionLabel(decision: ReviewDecision): string {
  return decision === 'candidate_transition' ? 'Candidate transition' : decision === 'cannot_assess' ? 'Cannot assess' : 'Abstain';
}


export function compareReviewerSessions(privateCases: BlindReviewCasePrivate[], sessions: ReviewerSession[]): SessionAgreementSummary {
  const allResponses = sessions.flatMap((session) => session.responses);
  const aggregate = compareReviewerResponses(privateCases, allResponses);
  const responsesByCase = new Map<string, ReviewerResponse[]>();
  for (const response of allResponses) {
    const current = responsesByCase.get(response.review_case_id) ?? [];
    current.push(response);
    responsesByCase.set(response.review_case_id, current);
  }
  let pairAgreement = 0;
  let pairCount = 0;
  for (const responses of responsesByCase.values()) {
    for (let i = 0; i < responses.length; i += 1) {
      for (let j = i + 1; j < responses.length; j += 1) {
        pairCount += 1;
        if (responses[i].decision === responses[j].decision) pairAgreement += 1;
      }
    }
  }
  return { ...aggregate, interReviewerDecisionAgreement: pairCount ? pairAgreement / pairCount : null, interReviewerPairs: pairCount, reviewerSessionCount: sessions.length };
}
