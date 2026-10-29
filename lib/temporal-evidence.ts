import { reviewEvidence, stageLabels, type EvidenceRecord, type EvidenceStage } from '@/lib/evidence';
import type { DiagnosticReport } from '@/lib/diagnostics';
import type { SelectedJourneyModel } from '@/lib/investigation-model';

export type TemporalEligibility = 'eligible_on_pathway' | 'eligible_observation' | 'excluded' | 'off_pathway' | 'unresolved';
export type TemporalPoint = {
  record: EvidenceRecord;
  timeMs: number | null;
  eligibility: TemporalEligibility;
  eligibilityReason: string;
  entityRef: string | null;
};
export type TemporalPattern = {
  id: string;
  stage: EvidenceStage;
  analyte: EvidenceRecord['analyte'];
  sourceId: string;
  entityRef: string | null;
  records: TemporalPoint[];
  summary: string;
  interpretationLimit: string;
  patternKind: 'category_change' | 'stable_category' | 'numeric_change' | 'repeat_records_same_sample';
};
export type TemporalSnapshot = {
  points: TemporalPoint[];
  datedPoints: TemporalPoint[];
  undatedRecords: EvidenceRecord[];
  patterns: TemporalPattern[];
  datedCount: number;
  undatedCount: number;
  staleReport: boolean;
  reportAvailable: boolean;
  limitations: string[];
};

function eligibilityFor(record: EvidenceRecord, report: DiagnosticReport | null, reportStale: boolean): { state: TemporalEligibility; reason: string } {
  if (!report || reportStale || !Array.isArray(report.record_eligibility)) {
    return { state: 'unresolved', reason: reportStale ? 'The diagnostic report is stale.' : 'Run a current diagnostic review to establish engine eligibility.' };
  }
  const entry = report.record_eligibility.find((candidate) => candidate.record_id === record.id);
  if (!entry) return { state: 'unresolved', reason: 'The current report does not contain an eligibility decision for this record.' };
  if (!entry.eligible) return { state: 'excluded', reason: entry.reason || 'Excluded by the diagnostic engine.' };
  if (entry.on_pathway === false) return { state: 'off_pathway', reason: 'The engine considers this an eligible observation, but it is not linked to the selected cross-stage pathway.' };
  if (entry.on_pathway === true) return { state: 'eligible_on_pathway', reason: 'The current engine report marks this record eligible and on the selected pathway.' };
  return { state: 'eligible_observation', reason: 'The current engine report marks this result eligible as an observation; pathway membership is not asserted by this report.' };
}

function parseCollectedAt(value: string | null): number | null {
  if (!value?.trim()) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function observedResultLabel(record: EvidenceRecord): string {
  if (record.result === 'detected') return 'Detected';
  if (record.result === 'not_detected') return 'Not detected';
  if (record.result === 'quantified') return record.numericValue === null ? 'Quantitative result (value missing)' : `${record.numericValue} ${record.unit ?? ''}`.trim();
  if (record.result === 'invalid') return 'Invalid / rejected';
  return 'No result recorded';
}

function groupKey(point: TemporalPoint): string | null {
  const source = point.record.waterSourceId?.trim();
  if (!source) return null;
  return [source, point.record.stage, point.record.analyte, point.entityRef?.trim() || 'entity-unmapped'].join('::');
}

function makePatterns(points: TemporalPoint[]): TemporalPattern[] {
  const groups = new Map<string, TemporalPoint[]>();
  for (const point of points) {
    if (point.timeMs === null || point.eligibility === 'excluded' || point.eligibility === 'unresolved') continue;
    const key = groupKey(point);
    if (!key) continue;
    const current = groups.get(key) ?? [];
    current.push(point);
    groups.set(key, current);
  }
  const patterns: TemporalPattern[] = [];
  for (const [key, items] of groups) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    if (!first || !latest) continue;
    const distinctSamples = new Set(sorted.map((item) => item.record.sampleCode.trim().toLocaleLowerCase()));
    const sampleEntity = first.entityRef;
    let patternKind: TemporalPattern['patternKind'];
    let summary: string;
    let interpretationLimit: string;
    if (distinctSamples.size === 1) {
      patternKind = 'repeat_records_same_sample';
      summary = `${sorted.length} records use the same sample ID (${first.record.sampleCode}). Treat as possible duplicate or laboratory replicate records, not independent field repeats.`;
      interpretationLimit = 'These records do not establish repeated sampling over time. Review the original laboratory reports and record identity first.';
    } else {
      const categories = sorted.map((item) => item.record.result);
      const hasDetected = categories.includes('detected');
      const hasNotDetected = categories.includes('not_detected');
      const allQuantified = sorted.every((item) => item.record.result === 'quantified' && item.record.numericValue !== null);
      const unitSet = new Set(sorted.map((item) => item.record.unit?.trim() ?? ''));
      if (hasDetected && hasNotDetected) {
        patternKind = 'category_change';
        summary = `Observed result categories vary over time: ${sorted.map((item) => observedResultLabel(item.record)).join(' → ')}.`;
        interpretationLimit = 'This is a sequence of recorded observations, not proof of intermittent contamination or a causal transition. Check methods, sampling times, QC, and whether the sampling point stayed comparable.';
      } else if (allQuantified && first.record.analyte !== 'other' && unitSet.size === 1 && [...unitSet][0] !== '') {
        patternKind = 'numeric_change';
        const values = sorted.map((item) => item.record.numericValue as number);
        const start = values[0] as number;
        const end = values[values.length - 1] as number;
        const direction = end > start ? 'increased' : end < start ? 'decreased' : 'was unchanged';
        summary = `Recorded values ${direction} from ${start} to ${end} ${first.record.unit} across ${sorted.length} observations.`;
        interpretationLimit = 'Numeric direction is descriptive only. Check method comparability, units, detection limits, and sampling context; this sequence alone does not establish a cause or a safety trend.';
      } else if (new Set(categories).size === 1 && categories.every((category) => category === 'detected' || category === 'not_detected')) {
        patternKind = 'stable_category';
        summary = `${sorted.length} separate sample IDs record ${observedResultLabel(first.record).toLocaleLowerCase()} at this stage across the observed period.`;
        interpretationLimit = 'Repeated observations support only the recorded times and methods. They do not prove persistent presence or absence outside the sampling window.';
      } else {
        patternKind = 'category_change';
        summary = `${sorted.length} observations have different result types, missing outcomes, or values that are not directly comparable.`;
        interpretationLimit = 'Do not infer a time trend until analyte, result representation, units, methods, and sampling context are comparable.';
      }
    }
    const methods = new Set(sorted.map((point) => point.record.method?.trim() || 'method-unrecorded'));
    const laboratories = new Set(sorted.map((point) => point.record.labName?.trim() || 'laboratory-unrecorded'));
    if (methods.size > 1) interpretationLimit += ' Test methods differ or are missing across records; confirm comparability before interpreting this as a temporal change.';
    if (laboratories.size > 1) interpretationLimit += ' Laboratory/provider identifiers differ or are missing; review method and QC comparability.';
    if (!sampleEntity) interpretationLimit += ' The sampling-point/entity identity is not explicitly mapped in the selected journey, so this is only a provisional source-and-stage grouping.';
    if (sorted.some((point) => point.eligibility === 'off_pathway')) interpretationLimit += ' One or more observations are eligible individually but are not linked to the selected journey; this pattern is not evidence for a cross-stage pathway conclusion.';
    const hashSafeId = key.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 150);
    patterns.push({ id: hashSafeId, stage: first.record.stage, analyte: first.record.analyte, sourceId: first.record.waterSourceId?.trim() ?? '', entityRef: sampleEntity, records: sorted, summary, interpretationLimit, patternKind });
  }
  return patterns.sort((a, b) => {
    const severity = (kind: TemporalPattern['patternKind']) => kind === 'category_change' ? 0 : kind === 'numeric_change' ? 1 : kind === 'repeat_records_same_sample' ? 2 : 3;
    return severity(a.patternKind) - severity(b.patternKind) || b.records.length - a.records.length;
  });
}

export function buildTemporalSnapshot(
  records: EvidenceRecord[], report: DiagnosticReport | null, reportStale: boolean, journeyModel: SelectedJourneyModel | null,
): TemporalSnapshot {
  const entityByRecord = new Map<string, string>();
  if (journeyModel) for (const event of journeyModel.samplingEvents) if (event.waterEntityRef?.trim()) entityByRecord.set(event.evidenceRecordId, event.waterEntityRef.trim());
  const points: TemporalPoint[] = records.map((record) => {
    const eligibility = eligibilityFor(record, report, reportStale);
    return { record, timeMs: parseCollectedAt(record.collectedAt), eligibility: eligibility.state, eligibilityReason: eligibility.reason, entityRef: entityByRecord.get(record.id) ?? null };
  });
  const datedPoints = points.filter((point) => point.timeMs !== null).sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
  const undatedRecords = points.filter((point) => point.timeMs === null).map((point) => point.record);
  const selectedJourneyRecordIds = new Set(journeyModel?.samplingEvents.map((event) => event.evidenceRecordId) ?? []);
  const currentEligiblePoints = datedPoints.filter((point) => ['eligible_on_pathway', 'eligible_observation', 'off_pathway'].includes(point.eligibility) && (!journeyModel || selectedJourneyRecordIds.has(point.record.id)));
  const limitations = [
    'Timeline order reflects user-entered collection timestamps; WaterChain does not independently verify those times.',
    'A recorded positive/negative sequence does not by itself establish persistence, contamination origin, or causation.',
    'Records without a current engine eligibility result are shown as unresolved and are not used to describe eligible temporal patterns.',
  ];
  if (journeyModel && !reportStale && report?.lineage_review?.mode === 'explicit_journey') limitations.push('The selected journey model is used to label explicitly mapped sampling entities. A temporal grouping is not itself proof that water followed a transfer path.');
  return {
    points, datedPoints, undatedRecords,
    patterns: makePatterns(currentEligiblePoints),
    datedCount: datedPoints.length, undatedCount: undatedRecords.length,
    staleReport: reportStale, reportAvailable: Boolean(report && !reportStale), limitations,
  };
}

export type SamplingActionCandidate = {
  id: string;
  kind: 'verify_metadata' | 'verify_lineage' | 'repeat_sample' | 'reconcile_results' | 'verify_lab_report' | 'review_method';
  priority: 'high' | 'medium' | 'low';
  title: string;
  stage: EvidenceStage | null;
  rationale: string;
  whatPositiveWouldMean: string;
  whatNegativeWouldMean: string;
  remainingUnknown: string;
  prerequisites: string[];
  evidenceRecordIds: string[];
  rankingBasis: string;
}

const priorityWeight = { high: 0, medium: 1, low: 2 } as const;
function issueLabel(code: string): string {
  return code.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

export function planSamplingActions(
  records: EvidenceRecord[], report: DiagnosticReport | null, reportStale: boolean, journeyModel: SelectedJourneyModel | null,
): SamplingActionCandidate[] {
  if (records.length === 0) return [];
  const actions: SamplingActionCandidate[] = [];
  const add = (candidate: SamplingActionCandidate) => { if (!actions.some((action) => action.id === candidate.id)) actions.push(candidate); };
  const reviews = records.map((record) => ({ record, review: reviewEvidence(record, records) }));

  const dateProblems = records.filter((record) => !parseCollectedAt(record.collectedAt));
  if (dateProblems.length) add({
    id: 'verify-collection-times', kind: 'verify_metadata', priority: 'high', title: 'Verify missing or invalid collection timestamps', stage: null,
    rationale: `${dateProblems.length} record(s) have no parseable collection timestamp. Their relative time order cannot be assessed safely.`,
    whatPositiveWouldMean: 'Not applicable: verifying metadata does not create a new water-quality result.',
    whatNegativeWouldMean: 'Not applicable: a missing timestamp is not a negative result.',
    remainingUnknown: 'Until times are resolved, temporal ordering and time-based comparison remain limited.',
    prerequisites: ['Check original field sheets or laboratory records; record timezone where known.', 'Do not infer a timestamp from file creation time unless its meaning is documented.'],
    evidenceRecordIds: dateProblems.map((record) => record.id), rankingBasis: 'High because chronology is required to interpret time order.'
  });

  const issuePriority: Record<string, 'high' | 'medium'> = {
    qc_failed: 'high', missing_method: 'high', missing_numeric_value: 'high', negative_numeric_value: 'high',
    missing_unit: 'high', analyte_result_mismatch: 'high', invalid_test_result: 'high',
    qc_not_documented: 'medium', missing_source_identity: 'medium', missing_lab_identity: 'medium',
  };
  const issueBuckets = new Map<string, EvidenceRecord[]>();
  for (const { record, review } of reviews) for (const issue of review.issues) {
    if (!(issue.code in issuePriority)) continue;
    const bucket = issueBuckets.get(issue.code) ?? [];
    bucket.push(record); issueBuckets.set(issue.code, bucket);
  }
  for (const [code, rows] of issueBuckets) add({
    id: `resolve-issue-${code}`, kind: 'verify_metadata', priority: issuePriority[code] ?? 'medium', title: `Review ${issueLabel(code).toLocaleLowerCase()} before interpreting results`, stage: rows.length === 1 ? rows[0]?.stage ?? null : null,
    rationale: `${rows.length} record(s) have a ${issueLabel(code).toLocaleLowerCase()} issue flagged by register-level checks. These checks are not engine eligibility, but the issue needs review.`,
    whatPositiveWouldMean: 'Not applicable: resolving the metadata/control issue is not itself a new test result.',
    whatNegativeWouldMean: 'Not applicable: the presence or absence of a metadata issue is not a water-quality outcome.',
    remainingUnknown: 'Any record still excluded by the diagnostic engine must remain excluded, even after its register warnings are addressed.',
    prerequisites: ['Review the original report or method/QC documentation.', 'Do not change a failed QC value to pass without source evidence.'],
    evidenceRecordIds: rows.map((record) => record.id), rankingBasis: `${issuePriority[code] === 'high' ? 'High' : 'Medium'} because ${issuePriority[code] === 'high' ? 'an unresolved validity issue can make a result unusable' : 'the missing metadata limits traceability or interpretation'}.`
  });

  const selectedJourneyRecordIds = new Set(journeyModel?.samplingEvents.map((event) => event.evidenceRecordId) ?? []);
  const sourceGroups = new Map<string, EvidenceRecord[]>();
  for (const record of records) {
    const source = record.waterSourceId?.trim();
    if (!source) continue;
    const key = [source, record.stage, record.analyte].join('::');
    const bucket = sourceGroups.get(key) ?? []; bucket.push(record); sourceGroups.set(key, bucket);
  }
  for (const [key, group] of sourceGroups) {
    const scopeGroup = journeyModel ? group.filter((record) => selectedJourneyRecordIds.has(record.id)) : group;
    if (scopeGroup.length === 0) continue;
    const currentEligibleGroup = scopeGroup.filter((record) => {
      const eligibility = eligibilityFor(record, report, reportStale).state;
      return eligibility === 'eligible_on_pathway' || eligibility === 'eligible_observation' || eligibility === 'off_pathway';
    });
    const sampleCodes = new Set(currentEligibleGroup.map((record) => record.sampleCode.trim().toLocaleLowerCase()));
    const hasPositive = currentEligibleGroup.some((record) => record.result === 'detected' || (record.result === 'quantified' && record.numericValue !== null && record.numericValue > 0));
    const hasNegative = currentEligibleGroup.some((record) => record.result === 'not_detected');
    const stage = scopeGroup[0]?.stage;
    if (!stage) continue;
    if (hasPositive && hasNegative) add({
      id: `reconcile-time-series-${key}`, kind: 'reconcile_results', priority: 'high', title: `Reconcile changing results at ${stageLabels[stage]}`,
      stage, rationale: 'Records for the same source/stage/analyte include both positive and negative-style outcomes. Timing, specimen identity, method, QC, and whether the observations are true field repeats need review.',
      whatPositiveWouldMean: 'A repeat positive would document a positive observation at that time and under that method, subject to eligibility checks.',
      whatNegativeWouldMean: 'A repeat negative would not erase earlier positive observations or prove persistent absence.',
      remainingUnknown: 'Whether the pattern reflects intermittent conditions, method differences, sample mismatch, or data error remains unresolved until those factors are reconciled.',
      prerequisites: ['Compare original lab reports, collection times, units, methods, and control results.', 'Confirm the samples represent comparable sampling points before describing a temporal pattern.'],
      evidenceRecordIds: currentEligibleGroup.map((record) => record.id), rankingBasis: 'High because conflicting eligible observations change interpretation and should be reconciled before drawing conclusions.'
    });
    else if (hasPositive && sampleCodes.size === 1) add({
      id: `repeat-positive-${key}`, kind: 'repeat_sample', priority: 'medium', title: `Consider a documented repeat at ${stageLabels[stage]}`,
      stage, rationale: 'A positive-style result exists for only one distinct sample ID in this source/stage/analyte group. A properly planned repeat may help determine whether the observation is reproducible under stated sampling conditions.',
      whatPositiveWouldMean: 'Another positive would add a separate observation at the repeat time; it would not prove the stage caused contamination.',
      whatNegativeWouldMean: 'A negative repeat may reflect timing, sampling variation, or method limitations and would not erase the original observation.',
      remainingUnknown: 'Persistence, intermittency, and the reason for the observed result would remain uncertain.',
      prerequisites: ['Confirm the original result is eligible and compare the method/QC information.', 'Use a documented sampling point, time, and protocol for the repeat.'],
      evidenceRecordIds: currentEligibleGroup.map((record) => record.id), rankingBasis: 'Medium because a single eligible observation offers limited information about repeatability.'
    });
  }

  const missingSourceRefs = records.filter((record) => !record.sourceReference?.trim() && ['detected', 'not_detected', 'quantified'].includes(record.result));
  if (missingSourceRefs.length) add({
    id: 'verify-original-lab-reports', kind: 'verify_lab_report', priority: 'medium', title: 'Attach or reconcile original laboratory report references', stage: null,
    rationale: `${missingSourceRefs.length} reportable record(s) have no source-document reference in the register.`,
    whatPositiveWouldMean: 'Not applicable: obtaining the original report does not alter the water test result by itself.',
    whatNegativeWouldMean: 'Not applicable: a missing report reference is not evidence of a negative result.',
    remainingUnknown: 'Without the original report, method, units, and reported QC details may be difficult to independently check.',
    prerequisites: ['Obtain the original report or enter a durable reference.', 'Describe whether the original file is retained locally or only referenced externally.'],
    evidenceRecordIds: missingSourceRefs.map((record) => record.id), rankingBasis: 'Medium because provenance strengthens reviewability.'
  });

  if (journeyModel) {
    const eventsByStage = new Map<EvidenceStage, number>();
    for (const event of journeyModel.samplingEvents) eventsByStage.set(event.stage, (eventsByStage.get(event.stage) ?? 0) + 1);
    for (const stage of (['source', 'collection', 'storage', 'serving'] as EvidenceStage[])) if (!eventsByStage.get(stage)) add({
      id: `plan-sample-event-${stage}`, kind: 'repeat_sample', priority: 'high', title: `Plan a sampling event at ${stageLabels[stage]}`,
      stage, rationale: `The selected journey has no sampling event at ${stageLabels[stage]}. That is a coverage gap, not a negative result.`,
      whatPositiveWouldMean: 'A valid positive would establish an observation at that sampling event and time, subject to method and QC.',
      whatNegativeWouldMean: 'A valid negative would apply only to that specimen, method, and sampling time.',
      remainingUnknown: 'The event alone will not establish causal origin; source/entity/transfer relationships and test validity still need review.',
      prerequisites: ['Choose and record the physical sampling point and protocol.', 'Link the event to the correct source/entity and retain method/QC information.'],
      evidenceRecordIds: [], rankingBasis: 'High because the selected journey is missing this stage.'
    });
    for (const edge of ['source>collection', 'collection>storage', 'storage>serving'] as const) {
      const [fromStage, toStage] = edge.split('>') as [EvidenceStage, EvidenceStage];
      const fromEntityRefs = new Set(journeyModel.samplingEvents.filter((event) => event.stage === fromStage && event.waterEntityRef?.trim()).map((event) => event.waterEntityRef as string));
      const toEntityRefs = new Set(journeyModel.samplingEvents.filter((event) => event.stage === toStage && event.waterEntityRef?.trim()).map((event) => event.waterEntityRef as string));
      const present = journeyModel.transferEvents.some((item) => item.fromStage === fromStage && item.toStage === toStage && ['documented', 'observed'].includes(item.evidenceBasis) && Boolean(item.fromEntityRef?.trim()) && Boolean(item.toEntityRef?.trim()) && fromEntityRefs.has(item.fromEntityRef ?? '') && toEntityRefs.has(item.toEntityRef ?? '') && Boolean(item.sourceReference?.trim() || (item.evidenceBasis === 'observed' && item.notes?.trim())));
      if (!present) add({
        id: `verify-transfer-${fromStage}-${toStage}`, kind: 'verify_lineage', priority: 'high', title: `Verify the ${stageLabels[fromStage]} → ${stageLabels[toStage]} relationship`,
        stage: toStage, rationale: "The selected journey has no currently supported adjacent-stage transfer meeting the application’s reference requirements.",
        whatPositiveWouldMean: 'A properly documented relationship would strengthen the asserted journey link, not prove the water-quality cause.',
        whatNegativeWouldMean: 'Failure to locate documentation does not prove the transfer did not happen; keep the link unconfirmed.',
        remainingUnknown: 'The journey may remain ambiguous if other transfers, mixing, refills, or branches are undocumented.',
        prerequisites: ['Review field notes or chain-of-custody/transfer records; record a real reference.', 'Do not invent an identifier to make a path pass.'],
        evidenceRecordIds: journeyModel.samplingEvents.filter((event) => event.stage === fromStage || event.stage === toStage).map((event) => event.evidenceRecordId), rankingBasis: 'High because missing transfer support limits path reconstruction.'
      });
    }
  }

  if (!report || reportStale) add({
    id: 'run-current-diagnostic-review', kind: 'review_method', priority: 'medium', title: 'Run a current diagnostic review before interpreting eligibility', stage: null,
    rationale: reportStale ? 'The most recent diagnostic review is stale relative to the current evidence.' : 'No diagnostic report is available for the current evidence snapshot.',
    whatPositiveWouldMean: 'Not applicable: running a review evaluates the submitted evidence, not water itself.',
    whatNegativeWouldMean: 'Not applicable: a review result is not a water-quality test outcome.',
    remainingUnknown: 'Any unresolved data, pathway, temporal, or laboratory limitations will remain until the underlying evidence is addressed.',
    prerequisites: ['Confirm entered records and documented journey relationships.', 'Run the engine and review its exclusions and limitations.'],
    evidenceRecordIds: records.map((record) => record.id), rankingBasis: 'Medium because current engine eligibility is required to interpret records as eligible observations.'
  });

  return actions.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || (a.stage ? ['source', 'collection', 'storage', 'serving'].indexOf(a.stage) : -1) - (b.stage ? ['source', 'collection', 'storage', 'serving'].indexOf(b.stage) : -1) || a.title.localeCompare(b.title)).slice(0, 12);
}

export function describeResult(record: EvidenceRecord): string { return observedResultLabel(record); }
