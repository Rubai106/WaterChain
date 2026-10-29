import { z } from 'zod';
import { stages, type EvidenceRecord, type EvidenceStage } from '@/lib/evidence';
import type { DiagnosticReport, RecordEligibility } from '@/lib/diagnostics';

export const linkBasisValues = ['directly_documented', 'associated_visit', 'self_reported', 'unconfirmed'] as const;
export const transferBasisValues = ['documented', 'observed', 'self_reported', 'inferred', 'unverified'] as const;
export const transferKinds = ['collection', 'container_transfer', 'refill', 'decanting', 'serving', 'other'] as const;
export const artifactKinds = ['laboratory_report', 'field_note', 'chain_of_custody', 'sample_photo', 'calibration_record', 'other'] as const;
export const sourceKinds = ['borehole', 'tap', 'spring', 'well', 'water_vendor', 'household', 'other'] as const;
export const journeyStatusValues = ['intake', 'sampling', 'evidence_review', 'assessment', 'follow_up', 'closed'] as const;

export const waterSourceSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(160), kind: z.enum(sourceKinds),
  sourceIdentifier: z.string().trim().nullable().default(null), locationLabel: z.string().max(240).nullable(), sourceReference: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(), createdAt: z.string().datetime(),
});
export type WaterSource = z.infer<typeof waterSourceSchema>;

export const waterJourneySchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(160), sourceId: z.string().uuid(),
  description: z.string().max(3000).nullable(), startedAt: z.string().datetime().nullable(),
  householdOrSiteRef: z.string().max(240).nullable(),
  status: z.enum(journeyStatusValues).default('intake'),
  closeoutNote: z.string().max(3000).nullable().default(null),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type WaterJourney = z.infer<typeof waterJourneySchema>;

export const samplingEventSchema = z.object({
  id: z.string().uuid(), journeyId: z.string().uuid(), evidenceRecordId: z.string().uuid(),
  stage: z.enum(stages), sampledAt: z.string().datetime().nullable(),
  waterEntityRef: z.string().trim().min(1).max(240).nullable().default(null),
  relationshipBasis: z.enum(linkBasisValues), relationshipReference: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(), createdAt: z.string().datetime(),
});
export type SamplingEvent = z.infer<typeof samplingEventSchema>;

export const transferEventSchema = z.object({
  id: z.string().uuid(), journeyId: z.string().uuid(), fromStage: z.enum(stages), toStage: z.enum(stages),
  fromEntityRef: z.string().trim().min(1).max(240).nullable().default(null),
  toEntityRef: z.string().trim().min(1).max(240).nullable().default(null),
  transferKind: z.enum(transferKinds), occurredAt: z.string().datetime().nullable(),
  evidenceBasis: z.enum(transferBasisValues), sourceReference: z.string().max(500).nullable(),
  notes: z.string().max(2000).nullable(), createdAt: z.string().datetime(),
}).superRefine((event, ctx) => {
  const from = stages.indexOf(event.fromStage), to = stages.indexOf(event.toStage);
  if (to !== from + 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toStage'], message: 'Transfers must connect adjacent conceptual stages. Refill/branching outside this linear path should be documented in notes and assessed separately.' });
});
export type TransferEvent = z.infer<typeof transferEventSchema>;

export const provenanceArtifactSchema = z.object({
  id: z.string().uuid(), journeyId: z.string().uuid().nullable(), evidenceRecordId: z.string().uuid().nullable(),
  fileName: z.string().trim().min(1).max(255), artifactKind: z.enum(artifactKinds), byteLength: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), sourceReference: z.string().max(500).nullable(),
  recordedAt: z.string().datetime(), verificationStatus: z.enum(['unreviewed', 'reviewed_against_original', 'independently_checked']),
  contentStorage: z.enum(['browser_local', 'external_reference_only']).default('external_reference_only'),
  note: z.string().max(2000).nullable(),
});
export type ProvenanceArtifact = z.infer<typeof provenanceArtifactSchema>;

export const auditEventSchema = z.object({
  id: z.string().uuid(), occurredAt: z.string().datetime(), actorLabel: z.string().trim().min(1).max(120),
  eventType: z.string().trim().min(1).max(100), entityType: z.string().trim().min(1).max(80), entityId: z.string().max(160),
  summary: z.string().trim().min(1).max(1000), payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  previousEventHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(), eventHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const selectedJourneyModelSchema = z.object({
  journey: waterJourneySchema,
  source: waterSourceSchema,
  samplingEvents: z.array(samplingEventSchema).max(1000),
  transferEvents: z.array(transferEventSchema).max(1000),
}).superRefine((value, ctx) => {
  if (value.journey.sourceId !== value.source.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['journey', 'sourceId'], message: 'Journey source reference does not match the supplied source.' });
  if (value.samplingEvents.some((event) => event.journeyId !== value.journey.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['samplingEvents'], message: 'All sampling events must belong to the selected journey.' });
  if (value.transferEvents.some((event) => event.journeyId !== value.journey.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferEvents'], message: 'All transfer events must belong to the selected journey.' });
});
export type SelectedJourneyModel = z.infer<typeof selectedJourneyModelSchema>;

export type JourneyAssessment = {
  journeyId: string;
  journeyName: string;
  sourceName: string;
  status: 'not_ready' | 'evidence_incomplete' | 'lineage_limited' | 'linked_for_review';
  stages: Array<{ stage: EvidenceStage; sampleEvents: number; eligibleRecords: number; positiveResults: number; negativeResults: number; gaps: string[] }>;
  transferEdges: Array<{ fromStage: EvidenceStage; toStage: EvidenceStage; status: 'documented' | 'observed' | 'reported' | 'uncertain' | 'missing'; count: number }>;
  pathCount: number | null;
  selectedPathEntityRefs: Record<string, string> | null;
  blockers: string[];
  limitations: string[];
};

export function assessJourney(model: SelectedJourneyModel, records: EvidenceRecord[], report: DiagnosticReport | null, isStale: boolean): JourneyAssessment {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const eligibility = new Map<string, RecordEligibility>();
  if (!isStale) for (const entry of report?.record_eligibility ?? []) eligibility.set(entry.record_id, entry);
  const stageAssessments = stages.map((stage) => {
    const events = model.samplingEvents.filter((event) => event.stage === stage);
    const gaps: string[] = [];
    if (events.length === 0) gaps.push('No sampling event is linked to this stage.');
    let eligible = 0, positive = 0, negative = 0;
    for (const event of events) {
      const record = recordMap.get(event.evidenceRecordId);
      if (!record) { gaps.push(`Sampling event ${event.id.slice(0, 8)} points to a missing evidence record.`); continue; }
      if (record.stage !== event.stage) { gaps.push(`${record.recordCode} stage does not match its sampling event.`); continue; }
      if (event.relationshipBasis === 'unconfirmed' || event.relationshipBasis === 'self_reported') { gaps.push(`${record.recordCode} has a ${event.relationshipBasis.replaceAll('_', ' ')} relationship and is not counted as linked pathway evidence.`); continue; }
      if (!event.relationshipReference?.trim()) { gaps.push(`${record.recordCode} relationship link has no field/visit reference.`); continue; }
      if (!event.waterEntityRef?.trim()) { gaps.push(`${record.recordCode} has no mapped water/container entity ID.`); continue; }
      const entry = eligibility.get(record.id);
      if (!entry) { gaps.push('Run a current diagnostic review to establish engine eligibility.'); continue; }
      if (!entry.eligible) { gaps.push(`${record.recordCode} is excluded: ${entry.reason}.`); continue; }
      if (report?.lineage_review?.mode === 'explicit_journey' && entry.on_pathway !== true) { gaps.push(`${record.recordCode} is engine-eligible as an observation but is not on the selected entity-connected pathway.`); continue; }
      eligible += 1;
      if (entry.result_kind === 'positive') positive += 1;
      if (entry.result_kind === 'negative') negative += 1;
    }
    return { stage, sampleEvents: events.length, eligibleRecords: eligible, positiveResults: positive, negativeResults: negative, gaps };
  });
  const transferEdges = stages.slice(0, -1).map((fromStage, index) => {
    const toStage = stages[index + 1];
    const edges = model.transferEvents.filter((event) => event.fromStage === fromStage && event.toStage === toStage);
    let status: 'documented' | 'observed' | 'reported' | 'uncertain' | 'missing' = 'missing';
    const directlyDocumented = edges.filter((edge) => edge.evidenceBasis === 'documented' && Boolean(edge.sourceReference?.trim()) && Boolean(edge.fromEntityRef?.trim()) && Boolean(edge.toEntityRef?.trim()));
    const directlyObserved = edges.filter((edge) => edge.evidenceBasis === 'observed' && Boolean(edge.sourceReference?.trim() || edge.notes?.trim()) && Boolean(edge.fromEntityRef?.trim()) && Boolean(edge.toEntityRef?.trim()));
    if (directlyDocumented.length) status = 'documented';
    else if (directlyObserved.length) status = 'observed';
    else if (edges.some((edge) => edge.evidenceBasis === 'self_reported')) status = 'reported';
    else if (edges.length) status = 'uncertain';
    return { fromStage, toStage, status, count: edges.length };
  });
  const blockers: string[] = [];
  const pathCount = !isStale && report?.lineage_review?.mode === 'explicit_journey' ? (report.lineage_review.path_count ?? null) : null;
  const selectedPathEntityRefs = !isStale && report?.lineage_review?.mode === 'explicit_journey' ? (report.lineage_review.selected_path_entity_refs ?? null) : null;
  if (isStale || !report) blockers.push('A current diagnostic review is required before the engine eligibility state can be assessed.');
  if (pathCount === 0) blockers.push('The engine could not resolve one complete stage-by-stage path through the recorded water/container entity IDs.');
  if (pathCount !== null && pathCount > 1) blockers.push('More than one complete entity path exists. Select or split the investigation into an explicit path before interpreting a transition.');
  if (pathCount === null) blockers.push('A current explicit-journey path result is unavailable; run a current diagnostic review.');
  if (!model.source.sourceIdentifier?.trim()) blockers.push('The selected source has no recorded source ID mapping. Enter the same source ID used in the evidence records.');
  const expectedSourceId = model.source.sourceIdentifier?.trim().toLocaleLowerCase() || null;
  const journeySourceIds = new Set(model.samplingEvents.map((event) => recordMap.get(event.evidenceRecordId)?.waterSourceId?.trim().toLocaleLowerCase()).filter((value): value is string => Boolean(value)));
  if (expectedSourceId && [...journeySourceIds].some((value) => value !== expectedSourceId)) blockers.push('One or more linked evidence records have a water-source ID that does not match the selected source mapping.');
  if (stageAssessments.some((stage) => stage.eligibleRecords === 0)) blockers.push('At least one conceptual stage has no eligible, journey-linked reportable record.');
  if (transferEdges.some((edge) => !['documented', 'observed'].includes(edge.status))) blockers.push('At least one adjacent-stage transfer is missing or lacks direct documentary/observational support.');
  if (model.samplingEvents.some((event) => !event.waterEntityRef?.trim())) blockers.push('One or more sampling events lack a physical water/container entity reference.');
  if (model.samplingEvents.some((event) => event.relationshipBasis === 'unconfirmed')) blockers.push('One or more sampling-event relationships are unconfirmed.');
  const status: JourneyAssessment['status'] = !report || isStale ? 'not_ready'
    : pathCount !== 1 ? 'lineage_limited'
    : !expectedSourceId || (expectedSourceId && [...journeySourceIds].some((value) => value !== expectedSourceId)) ? 'lineage_limited'
    : stageAssessments.some((stage) => stage.eligibleRecords === 0) ? 'evidence_incomplete'
    : transferEdges.some((edge) => !['documented', 'observed'].includes(edge.status)) || model.samplingEvents.some((event) => event.relationshipBasis === 'unconfirmed' || event.relationshipBasis === 'self_reported') ? 'lineage_limited'
    : 'linked_for_review';
  return {
    journeyId: model.journey.id, journeyName: model.journey.name, sourceName: model.source.name, status,
    stages: stageAssessments, transferEdges, pathCount, selectedPathEntityRefs, blockers,
    limitations: [
      'This is a relationship-quality assessment, not proof of physical continuity or contamination causation.',
      'Document references and user-selected relationship bases are not independently authenticated.',
      'A selected journey can contain comparison samples from the same source; sample bottles are not assumed to be the same physical water.',
      'The existing diagnostic engine must still be run and may abstain even when this relationship map is complete.',
    ],
  };
}

export function planNextActions(assessment: JourneyAssessment): Array<{ id: string; priority: 'high' | 'medium'; actionType: 'linkage' | 'sample' | 'quality_control' | 'repeat'; title: string; why: string; whatPositiveWouldMean: string; whatNegativeWouldMean: string; prerequisites: string[] }> {
  const actions: ReturnType<typeof planNextActions> = [];
  if (assessment.status === 'not_ready') actions.push({ id: 'run-review', priority: 'high', actionType: 'linkage', title: 'Run a current diagnostic review', why: 'Eligibility must come from the engine report for the current evidence snapshot.', whatPositiveWouldMean: 'Not applicable; this is a review action, not a test result.', whatNegativeWouldMean: 'Not applicable; no new water-quality result is produced.', prerequisites: ['All records conform to the current schema.'] });
  for (const edge of assessment.transferEdges.filter((item) => !['documented', 'observed'].includes(item.status))) actions.push({
    id: `transfer-${edge.fromStage}-${edge.toStage}`, priority: 'high', actionType: 'linkage',
    title: `Resolve ${edge.fromStage} → ${edge.toStage} transfer evidence`,
    why: edge.status === 'missing' ? 'No transfer event documents this adjacent-stage relationship.' : edge.status === 'reported' ? 'This relationship is currently supported only by self-report.' : 'Current relationship evidence is inferred or unverified.',
    whatPositiveWouldMean: 'Not applicable; this action improves lineage evidence, not water testing.',
    whatNegativeWouldMean: 'Not applicable; unavailable documentation does not prove a transfer did not happen.',
    prerequisites: ['Find a field note, transfer record, or appropriately documented observation; do not invent a reference.'],
  });
  for (const stage of assessment.stages.filter((item) => item.eligibleRecords === 0)) actions.push({
    id: `sample-${stage.stage}`, priority: 'high', actionType: 'sample', title: `Collect or resolve a sample at ${stage.stage}`,
    why: stage.sampleEvents === 0 ? 'No sampling event is linked to this stage.' : 'Linked records are absent, ineligible, or not currently reviewed.',
    whatPositiveWouldMean: 'A positive observation would establish the test result at this sampling time, subject to method and QC; it would not prove where contamination began.',
    whatNegativeWouldMean: 'A negative observation would apply to that sample and test conditions only; it would not prove persistent absence.',
    prerequisites: ['Use the approved sampling protocol, document exact time/location, and preserve chain-of-custody details where applicable.'],
  });
  if (assessment.stages.some((stage) => stage.positiveResults > 0 && stage.negativeResults > 0)) actions.push({
    id: 'repeat-discordant', priority: 'medium', actionType: 'repeat', title: 'Review or repeat discordant stage results',
    why: 'Positive and negative results at the same stage may reflect timing, replicate differences, test limits, or record errors.',
    whatPositiveWouldMean: 'A repeat positive would document another positive observation under the repeat sampling conditions.',
    whatNegativeWouldMean: 'A repeat negative would not erase the earlier positive; reconcile both observations and review sampling conditions.',
    prerequisites: ['Check original reports, test methods, collection times, and laboratory QC before choosing a repeat protocol.'],
  });
  if (actions.length === 0) actions.push({
    id: 'paired-boundary', priority: 'medium', actionType: 'sample', title: 'Consider a paired follow-up at the least certain transition',
    why: 'The linked relationship model is complete enough for review, but additional observations may help test whether the pattern repeats.',
    whatPositiveWouldMean: 'A repeated positive pattern would add supporting observations but would not by itself prove causation.',
    whatNegativeWouldMean: 'A negative repeat may reflect timing or intermittency and should be interpreted with earlier results.',
    prerequisites: ['Have a qualified sampling plan and record the rationale before collecting new samples.'],
  });
  return actions;
}

export type JourneyWorkspaceData = { version: 1; sources: WaterSource[]; journeys: WaterJourney[]; samplingEvents: SamplingEvent[]; transferEvents: TransferEvent[]; artifacts: ProvenanceArtifact[]; auditEvents: AuditEvent[] };
export const emptyJourneyWorkspace = (): JourneyWorkspaceData => ({ version: 1, sources: [], journeys: [], samplingEvents: [], transferEvents: [], artifacts: [], auditEvents: [] });

export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function appendAuditEvent(data: JourneyWorkspaceData, input: Omit<AuditEvent, 'id' | 'occurredAt' | 'payloadSha256' | 'previousEventHash' | 'eventHash'>): Promise<AuditEvent> {
  const occurredAt = new Date().toISOString();
  const previousEventHash = data.auditEvents.at(-1)?.eventHash ?? null;
  const payload = { ...input, occurredAt, previousEventHash };
  const hash = async (text: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
  };
  const payloadSha256 = await hash(JSON.stringify(payload));
  const eventCore = { id: crypto.randomUUID(), ...payload, payloadSha256 };
  const eventHash = await hash(JSON.stringify(eventCore));
  return { ...eventCore, eventHash };
}

export async function verifyAuditChain(events: AuditEvent[]): Promise<{ valid: boolean; checked: number; error?: string }> {
  const hash = async (text: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
  };
  let prior: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.previousEventHash !== prior) return { valid: false, checked: index, error: `Broken previous-event link at entry ${index + 1}.` };
    const { eventHash, ...core } = event;
    if (await hash(JSON.stringify(core)) !== eventHash) return { valid: false, checked: index, error: `Hash mismatch at entry ${index + 1}.` };
    prior = eventHash;
  }
  return { valid: true, checked: events.length };
}
