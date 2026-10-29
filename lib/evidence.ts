import { z } from 'zod';

export const stages = ['source', 'collection', 'storage', 'serving'] as const;
export const analytes = ['e_coli_presence', 'e_coli_concentration', 'turbidity', 'free_chlorine', 'other'] as const;
export const resultStates = ['detected', 'not_detected', 'quantified', 'not_tested', 'invalid'] as const;
export const controlStates = ['pass', 'fail', 'not_recorded'] as const;

export const evidenceRecordSchema = z.object({
  id: z.string().min(1),
  recordCode: z.string().trim().min(1, 'Evidence record ID is required'),
  sampleCode: z.string().trim().min(1, 'Sample ID is required'),
  stage: z.enum(stages),
  collectedAt: z.string().nullable(),
  waterSourceId: z.string().trim().nullable(),
  batchId: z.string().trim().nullable(),
  analyte: z.enum(analytes),
  result: z.enum(resultStates),
  numericValue: z.number().finite().nullable(),
  unit: z.string().trim().nullable(),
  method: z.string().trim().nullable(),
  labName: z.string().trim().nullable(),
  positiveControl: z.enum(controlStates),
  negativeControl: z.enum(controlStates),
  blankControl: z.enum(controlStates),
  sourceReference: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  createdAt: z.string().min(1),
});

export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type EvidenceStage = (typeof stages)[number];
export type Analyte = (typeof analytes)[number];
export type ResultState = (typeof resultStates)[number];
export type ControlState = (typeof controlStates)[number];
export type IssueSeverity = 'blocker' | 'warning' | 'info';
export type EvidenceIssue = { severity: IssueSeverity; code: string; message: string };
export type EvidenceReview = {
  issues: EvidenceIssue[];
  status: 'blocked' | 'limited' | 'metadata_complete' | 'record_only';
  usableForFutureAnalysis: boolean;
};

/** Generate a human-readable evidence code that is unique within the supplied register.
 * The immutable UUID `id` remains the internal key; this code is the user-facing label.
 */
export function generateUniqueRecordCode(
  existingRecordCodes: readonly string[],
  now: Date = new Date(),
  uuidFactory: () => string = () => crypto.randomUUID(),
): string {
  const existing = new Set(existingRecordCodes.map((code) => code.trim().toLocaleLowerCase()));
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const token = uuidFactory().replace(/-/g, '').slice(0, 8).toUpperCase();
    const candidate = `EV-${timestamp}-${token}`;
    if (!existing.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Could not generate a unique evidence record code. Try saving the record again.');
}

export const stageLabels: Record<EvidenceStage, string> = {
  source: 'Source',
  collection: 'Collection',
  storage: 'Storage',
  serving: 'Serving',
};

export const analyteLabels: Record<Analyte, string> = {
  e_coli_presence: 'E. coli presence / absence',
  e_coli_concentration: 'E. coli concentration',
  turbidity: 'Turbidity',
  free_chlorine: 'Free chlorine',
  other: 'Other test',
};

export const resultLabels: Record<ResultState, string> = {
  detected: 'Detected',
  not_detected: 'Not detected',
  quantified: 'Quantitative result',
  not_tested: 'Not tested / result pending',
  invalid: 'Invalid / rejected result',
};

export const controlLabels: Record<ControlState, string> = {
  pass: 'Passed',
  fail: 'Failed',
  not_recorded: 'Not recorded',
};

export function reviewEvidence(record: EvidenceRecord, allRecords: EvidenceRecord[] = []): EvidenceReview {
  const issues: EvidenceIssue[] = [];
  const isResultReported = ['detected', 'not_detected', 'quantified'].includes(record.result);

  if (!record.collectedAt?.trim()) {
    issues.push({ severity: 'blocker', code: 'missing_collection_time', message: 'Collection date/time is missing; temporal order cannot be checked.' });
  } else {
    const parsed = new Date(record.collectedAt);
    if (Number.isNaN(parsed.getTime())) {
      issues.push({ severity: 'blocker', code: 'invalid_collection_time', message: 'Collection date/time is not a valid date.' });
    } else if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
      issues.push({ severity: 'warning', code: 'future_collection_time', message: 'Collection time is in the future; confirm the date and timezone.' });
    }
  }

  if (!record.waterSourceId?.trim()) {
    issues.push({ severity: 'warning', code: 'missing_source_identity', message: 'Water-source identity is not recorded; source linkage is uncertain.' });
  }
  if (!record.batchId?.trim()) {
    issues.push({ severity: 'warning', code: 'missing_batch_identity', message: 'No batch or transfer identifier is recorded; cross-stage lineage cannot be established from this field.' });
  }
  if (!record.sourceReference?.trim()) {
    issues.push({ severity: 'warning', code: 'missing_provenance_reference', message: 'No lab report or source-document reference is attached to this record.' });
  }

  if (record.result === 'not_tested') {
    issues.push({ severity: 'info', code: 'no_test_result', message: 'This is a sample record without a reportable test result.' });
  }
  if (record.result === 'invalid') {
    issues.push({ severity: 'blocker', code: 'invalid_test_result', message: 'The result is marked invalid/rejected and must not be used as a valid test outcome.' });
  }
  if (isResultReported && !record.method?.trim()) {
    issues.push({ severity: 'blocker', code: 'missing_method', message: 'A reportable result has no test method recorded.' });
  }
  if (record.result === 'quantified') {
    if (record.numericValue === null || !Number.isFinite(record.numericValue)) {
      issues.push({ severity: 'blocker', code: 'missing_numeric_value', message: 'A quantitative result requires a numeric value.' });
    } else if (record.numericValue < 0) {
      issues.push({ severity: 'blocker', code: 'negative_numeric_value', message: 'A quantitative value cannot be negative.' });
    }
    if (!record.unit?.trim()) {
      issues.push({ severity: 'blocker', code: 'missing_unit', message: 'A quantitative result requires a unit.' });
    }
  }
  if (record.result !== 'quantified' && record.numericValue !== null) {
    issues.push({ severity: 'warning', code: 'numeric_value_without_quantified_result', message: 'A numeric value is present but the outcome is not marked quantitative; confirm that the result type matches the source report.' });
  }
  if (record.analyte === 'e_coli_presence' && record.result === 'quantified') {
    issues.push({ severity: 'blocker', code: 'analyte_result_mismatch', message: 'E. coli presence/absence is selected with a quantitative outcome. Confirm the analyte and use the concentration option when the report provides a numeric concentration.' });
  }

  const failedControls = (['positiveControl', 'negativeControl', 'blankControl'] as const)
    .filter((key) => record[key] === 'fail');
  if (failedControls.length) {
    issues.push({ severity: 'blocker', code: 'qc_failed', message: `Quality-control failure recorded (${failedControls.map((key) => key.replace('Control', ' control')).join(', ')}); exclude this result from future diagnostic inference pending review.` });
  }
  if (isResultReported && (record.positiveControl === 'not_recorded' || record.negativeControl === 'not_recorded' || record.blankControl === 'not_recorded')) {
    issues.push({ severity: 'warning', code: 'qc_not_documented', message: 'One or more quality-control fields are not recorded; test validity cannot be fully assessed.' });
  }
  if (isResultReported && !record.labName?.trim()) {
    issues.push({ severity: 'warning', code: 'missing_lab_identity', message: 'Laboratory or testing provider is not identified.' });
  }

  const isDuplicate = allRecords.some((other) => other.id !== record.id &&
    other.sampleCode.trim().toLowerCase() === record.sampleCode.trim().toLowerCase() &&
    other.stage === record.stage && other.analyte === record.analyte &&
    (other.collectedAt ?? '') === (record.collectedAt ?? ''));
  if (isDuplicate) {
    issues.push({ severity: 'warning', code: 'possible_duplicate', message: 'Another record has the same sample ID, stage, test type, and collection time; check whether this is a duplicate entry or a replicate.' });
  }
  const normalizedSampleCode = record.sampleCode.trim().toLowerCase();
  const sameSampleAcrossStages = allRecords.some((other) => other.id !== record.id &&
    other.sampleCode.trim().toLowerCase() === normalizedSampleCode && other.stage !== record.stage);
  if (sameSampleAcrossStages) {
    issues.push({ severity: 'warning', code: 'sample_id_cross_stage', message: 'The same sample ID appears at more than one pathway stage. Confirm that distinct physical samples have not been mistaken for the same sample.' });
  }

  const currentTime = record.collectedAt ? new Date(record.collectedAt).getTime() : Number.NaN;
  const stageOrder: Record<EvidenceStage, number> = { source: 0, collection: 1, storage: 2, serving: 3 };
  const relatedBatch = record.batchId?.trim() ? allRecords.filter((other) => other.id !== record.id && other.batchId?.trim() === record.batchId?.trim()) : [];
  const sourceIds = new Set([record, ...relatedBatch].map((item) => item.waterSourceId?.trim()).filter((value): value is string => Boolean(value)));
  if (sourceIds.size > 1) {
    issues.push({ severity: 'warning', code: 'batch_source_conflict', message: 'Records sharing this batch/transfer ID name different water sources. Confirm whether the batch ID is reused, the source changed, or a transfer/refill occurred.' });
  }
  if (Number.isFinite(currentTime)) {
    const hasTemporalConflict = relatedBatch.some((other) => {
      if (!other.collectedAt) return false;
      const otherTime = new Date(other.collectedAt).getTime();
      if (!Number.isFinite(otherTime) || other.stage === record.stage) return false;
      // This is a review warning, not proof of error: the four-stage model may be incomplete for a real journey.
      return (stageOrder[other.stage] < stageOrder[record.stage] && currentTime < otherTime) ||
        (stageOrder[other.stage] > stageOrder[record.stage] && otherTime < currentTime);
    });
    if (hasTemporalConflict) {
      issues.push({ severity: 'warning', code: 'batch_timeline_conflict', message: 'Times for records sharing this batch ID conflict with the conceptual stage order. Check timestamps, stage labels, batch identity, and whether the real journey includes a refill or branch.' });
    }
  }

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  let status: EvidenceReview['status'];
  if (record.result === 'not_tested') status = 'record_only';
  else if (blockers > 0) status = 'blocked';
  else if (warnings > 0) status = 'limited';
  else status = 'metadata_complete';

  return {
    issues,
    status,
    // This means metadata checks have no blockers, not that a diagnosis is valid or supported.
    usableForFutureAnalysis: isResultReported && blockers === 0,
  };
}

export function createEmptyEvidenceRecord(): EvidenceRecord {
  return {
    id: crypto.randomUUID(),
    recordCode: `EV-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    sampleCode: '',
    stage: 'source',
    collectedAt: null,
    waterSourceId: null,
    batchId: null,
    analyte: 'e_coli_presence',
    result: 'not_tested',
    numericValue: null,
    unit: null,
    method: null,
    labName: null,
    positiveControl: 'not_recorded',
    negativeControl: 'not_recorded',
    blankControl: 'not_recorded',
    sourceReference: null,
    notes: null,
    createdAt: new Date().toISOString(),
  };
}

export function issueSummary(record: EvidenceRecord, allRecords: EvidenceRecord[] = []) {
  const review = reviewEvidence(record, allRecords);
  return {
    blockers: review.issues.filter((issue) => issue.severity === 'blocker').length,
    warnings: review.issues.filter((issue) => issue.severity === 'warning').length,
    info: review.issues.filter((issue) => issue.severity === 'info').length,
  };
}
