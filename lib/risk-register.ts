import { z } from 'zod';

export const hazardTypes = ['microbiological', 'chemical', 'physical', 'sanitary_condition', 'operational', 'unknown'] as const;
export const hazardBases = ['observed_hazard', 'suspected_hazard', 'laboratory_finding', 'sanitary_inspection', 'process_deviation'] as const;
export const hazardSeverities = ['low', 'moderate', 'high', 'critical', 'unknown'] as const;
export const hazardLikelihoods = ['unlikely', 'possible', 'likely', 'unknown'] as const;
export const hazardStatuses = ['open', 'monitoring', 'review_closed'] as const;
export const controlKinds = ['preventive', 'monitoring', 'mitigation', 'corrective'] as const;
export const controlStatuses = ['proposed', 'documented', 'implemented_unverified', 'effectiveness_verified', 'ineffective', 'unknown'] as const;
export const riskEventTypes = ['risk_created', 'risk_updated', 'risk_status_changed', 'control_created', 'control_status_changed', 'action_linked'] as const;

export const riskRecordSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().min(1).max(180),
  title: z.string().min(1).max(240),
  hazardType: z.enum(hazardTypes),
  basis: z.enum(hazardBases),
  description: z.string().max(4000),
  location: z.string().max(500),
  observedAt: z.string().datetime().nullable(),
  severity: z.enum(hazardSeverities),
  likelihood: z.enum(hazardLikelihoods),
  status: z.enum(hazardStatuses),
  linkedEvidenceRecordIds: z.array(z.string().uuid()).max(500),
  evidenceReferences: z.array(z.string().min(1).max(500)).max(40),
  createdBy: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closureNote: z.string().max(4000).nullable(),
  closedBy: z.string().max(120).nullable(),
  closureEvidenceReferences: z.array(z.string().max(500)).max(40),
}).superRefine((risk, ctx) => {
  if (risk.status === 'review_closed' && (!risk.closureNote?.trim() || !risk.closedBy?.trim() || risk.closureEvidenceReferences.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'A closed review record requires a note, reviewer label, and closure reference.' });
  }
  if (risk.status !== 'review_closed' && (risk.closureNote !== null || risk.closedBy !== null || risk.closureEvidenceReferences.length > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'Closure fields must be cleared when the risk review is open or monitoring.' });
  }
});

export const riskControlSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().min(1).max(180),
  riskId: z.string().uuid(),
  kind: z.enum(controlKinds),
  title: z.string().min(1).max(240),
  description: z.string().max(4000),
  owner: z.string().min(1).max(120),
  status: z.enum(controlStatuses),
  evidenceReferences: z.array(z.string().min(1).max(500)).max(40),
  linkedEvidenceRecordIds: z.array(z.string().uuid()).max(500),
  implementationNote: z.string().max(4000).nullable(),
  implementedBy: z.string().max(120).nullable(),
  implementedAt: z.string().datetime().nullable(),
  verificationNote: z.string().max(4000).nullable(),
  verifiedBy: z.string().max(120).nullable(),
  verifiedAt: z.string().datetime().nullable(),
  verificationEvidenceReferences: z.array(z.string().max(500)).max(40),
  verificationEvidenceRecordIds: z.array(z.string().uuid()).max(500),
  verificationEvidenceSnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  ineffectiveNote: z.string().max(4000).nullable(),
  actionLoopItemId: z.string().uuid().nullable(),
  createdBy: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((control, ctx) => {
  if (control.status === 'implemented_unverified' && (!control.implementationNote?.trim() || !control.implementedBy?.trim() || !control.implementedAt || (control.evidenceReferences.length === 0 && control.linkedEvidenceRecordIds.length === 0))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'An implemented control requires an implementation note, actor, timestamp, and evidence reference.' });
  }
  if (control.status === 'effectiveness_verified') {
    if (!control.verificationNote?.trim() || !control.verifiedBy?.trim() || !control.verifiedAt || (control.verificationEvidenceReferences.length === 0 && control.verificationEvidenceRecordIds.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'An effectiveness-verified control requires a review note, reviewer, timestamp, and evidence reference.' });
    }
    if (control.verificationEvidenceRecordIds.length > 0 && !control.verificationEvidenceSnapshotSha256) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['verificationEvidenceSnapshotSha256'], message: 'Linked verification records require a saved evidence fingerprint.' });
    }
  }
  if (control.status === 'ineffective' && (!control.ineffectiveNote?.trim() || !control.implementedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'A control can be marked ineffective only after an implementation record and an explanatory note.' });
  }
});

export const riskRegisterEventSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().min(1).max(180),
  entityType: z.enum(['risk', 'control']),
  entityId: z.string().uuid(),
  type: z.enum(riskEventTypes),
  occurredAt: z.string().datetime(),
  actorLabel: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  evidenceReferences: z.array(z.string().max(500)).max(40),
});

export const riskRegisterStoreSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().min(1).max(180),
  risks: z.array(riskRecordSchema).max(300),
  controls: z.array(riskControlSchema).max(1000),
  events: z.array(riskRegisterEventSchema).max(5000),
}).superRefine((store, ctx) => {
  const ids = new Set<string>();
  for (const [index, risk] of store.risks.entries()) {
    if (risk.workspaceId !== store.workspaceId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['risks', index, 'workspaceId'], message: 'Risk belongs to a different investigation.' });
    if (ids.has(risk.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['risks', index, 'id'], message: 'Duplicate risk ID.' });
    ids.add(risk.id);
  }
  const controlIds = new Set<string>();
  const riskIds = new Set(store.risks.map((risk) => risk.id));
  for (const [index, control] of store.controls.entries()) {
    if (control.workspaceId !== store.workspaceId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['controls', index, 'workspaceId'], message: 'Control belongs to a different investigation.' });
    if (!riskIds.has(control.riskId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['controls', index, 'riskId'], message: 'Control must reference an existing risk in this investigation.' });
    if (controlIds.has(control.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['controls', index, 'id'], message: 'Duplicate control ID.' });
    controlIds.add(control.id);
  }
  const eventIds = new Set<string>();
  for (const [index, event] of store.events.entries()) {
    if (event.workspaceId !== store.workspaceId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['events', index, 'workspaceId'], message: 'Audit event belongs to a different investigation.' });
    if (eventIds.has(event.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['events', index, 'id'], message: 'Duplicate audit event ID.' });
    if (event.entityType === 'risk' && !riskIds.has(event.entityId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['events', index, 'entityId'], message: 'Risk audit event must reference an existing risk.' });
    if (event.entityType === 'control' && !controlIds.has(event.entityId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['events', index, 'entityId'], message: 'Control audit event must reference an existing control.' });
    eventIds.add(event.id);
  }
});

export type HazardType = (typeof hazardTypes)[number];
export type HazardBasis = (typeof hazardBases)[number];
export type HazardSeverity = (typeof hazardSeverities)[number];
export type HazardLikelihood = (typeof hazardLikelihoods)[number];
export type HazardStatus = (typeof hazardStatuses)[number];
export type ControlKind = (typeof controlKinds)[number];
export type ControlStatus = (typeof controlStatuses)[number];
export type RiskRecord = z.infer<typeof riskRecordSchema>;
export type RiskControl = z.infer<typeof riskControlSchema>;
export type RiskRegisterEvent = z.infer<typeof riskRegisterEventSchema>;
export type RiskRegisterStore = z.infer<typeof riskRegisterStoreSchema>;

export function screeningPriority(severity: HazardSeverity, likelihood: HazardLikelihood): 'not_assessed' | 'low' | 'moderate' | 'high' {
  if (severity === 'unknown' || likelihood === 'unknown') return 'not_assessed';
  const matrix: Record<Exclude<HazardSeverity, 'unknown'>, Record<Exclude<HazardLikelihood, 'unknown'>, 'low' | 'moderate' | 'high'>> = {
    low: { unlikely: 'low', possible: 'low', likely: 'moderate' },
    moderate: { unlikely: 'low', possible: 'moderate', likely: 'high' },
    high: { unlikely: 'moderate', possible: 'high', likely: 'high' },
    critical: { unlikely: 'high', possible: 'high', likely: 'high' },
  };
  return matrix[severity][likelihood];
}

export function createRisk(input: {
  workspaceId: string; title: string; hazardType: HazardType; basis: HazardBasis; description: string; location: string;
  observedAt: string | null; severity: HazardSeverity; likelihood: HazardLikelihood; linkedEvidenceRecordIds: string[];
  evidenceReferences: string[]; createdBy: string;
}, now = new Date()): RiskRecord {
  if (!input.title.trim()) throw new Error('Risk / hazard title is required.');
  if (!input.createdBy.trim()) throw new Error('Recorded by is required.');
  if (input.basis === 'laboratory_finding' && input.linkedEvidenceRecordIds.length === 0 && input.evidenceReferences.length === 0) {
    throw new Error('A laboratory finding must reference an evidence record or an external report.');
  }
  if (input.basis === 'sanitary_inspection' && input.evidenceReferences.length === 0 && input.linkedEvidenceRecordIds.length === 0) {
    throw new Error('A sanitary inspection finding must include an inspection or evidence reference.');
  }
  const timestamp = now.toISOString();
  return riskRecordSchema.parse({
    id: crypto.randomUUID(), workspaceId: input.workspaceId, title: input.title.trim(), hazardType: input.hazardType,
    basis: input.basis, description: input.description.trim(), location: input.location.trim(), observedAt: input.observedAt,
    severity: input.severity, likelihood: input.likelihood, status: 'open', linkedEvidenceRecordIds: [...new Set(input.linkedEvidenceRecordIds)],
    evidenceReferences: [...new Set(input.evidenceReferences)], createdBy: input.createdBy.trim(), createdAt: timestamp, updatedAt: timestamp,
    closureNote: null, closedBy: null, closureEvidenceReferences: [],
  });
}

export function createRiskControl(input: {
  workspaceId: string; riskId: string; kind: ControlKind; title: string; description: string; owner: string; createdBy: string;
  evidenceReferences: string[]; linkedEvidenceRecordIds: string[];
}, now = new Date()): RiskControl {
  if (!input.title.trim()) throw new Error('Control title is required.');
  if (!input.owner.trim()) throw new Error('A control owner is required.');
  if (!input.createdBy.trim()) throw new Error('Recorded by is required.');
  const timestamp = now.toISOString();
  return riskControlSchema.parse({
    id: crypto.randomUUID(), workspaceId: input.workspaceId, riskId: input.riskId, kind: input.kind, title: input.title.trim(),
    description: input.description.trim(), owner: input.owner.trim(), status: input.evidenceReferences.length || input.linkedEvidenceRecordIds.length ? 'documented' : 'proposed',
    evidenceReferences: [...new Set(input.evidenceReferences)], linkedEvidenceRecordIds: [...new Set(input.linkedEvidenceRecordIds)],
    implementationNote: null, implementedBy: null, implementedAt: null, verificationNote: null, verifiedBy: null, verifiedAt: null,
    verificationEvidenceReferences: [], verificationEvidenceRecordIds: [], verificationEvidenceSnapshotSha256: null, ineffectiveNote: null, actionLoopItemId: null,
    createdBy: input.createdBy.trim(), createdAt: timestamp, updatedAt: timestamp,
  });
}

export type ControlTransitionInput =
  | { type: 'mark_implemented'; actor: string; note: string; references: string[]; evidenceRecordIds: string[] }
  | { type: 'verify_effectiveness'; verifier: string; note: string; references: string[]; evidenceRecordIds: string[]; evidenceSnapshotSha256: string | null }
  | { type: 'mark_ineffective'; actor: string; note: string; references: string[]; evidenceRecordIds: string[] }
  | { type: 'reopen_verification'; actor: string; reason: string };

export type ControlTransitionResult = { ok: true; control: RiskControl } | { ok: false; error: string };

export function transitionRiskControl(control: RiskControl, input: ControlTransitionInput, now = new Date()): ControlTransitionResult {
  const person = input.type === 'verify_effectiveness' ? input.verifier.trim() : input.actor.trim();
  if (!person) return { ok: false, error: input.type === 'verify_effectiveness' ? 'Reviewer name is required.' : 'Actor name is required.' };
  const note = input.type === 'reopen_verification' ? input.reason.trim() : input.note.trim();
  if (!note) return { ok: false, error: input.type === 'reopen_verification' ? 'Reason for reopening is required.' : 'A note describing the evidence or outcome is required.' };
  if (input.type !== 'reopen_verification' && input.references.length === 0 && input.evidenceRecordIds.length === 0) {
    return { ok: false, error: 'Add at least one evidence record or traceable reference. A note alone is not verification evidence.' };
  }
  if (input.type === 'mark_implemented') {
    if (!['proposed', 'documented', 'ineffective', 'unknown'].includes(control.status)) return { ok: false, error: 'Only proposed, documented, ineffective, or unknown controls can be marked implemented.' };
    return { ok: true, control: riskControlSchema.parse({ ...control, status: 'implemented_unverified', implementationNote: note, implementedBy: person, implementedAt: now.toISOString(), verificationNote: null, verifiedBy: null, verifiedAt: null, verificationEvidenceReferences: [], verificationEvidenceRecordIds: [], verificationEvidenceSnapshotSha256: null, evidenceReferences: [...new Set([...control.evidenceReferences, ...input.references])], linkedEvidenceRecordIds: [...new Set([...control.linkedEvidenceRecordIds, ...input.evidenceRecordIds])], updatedAt: now.toISOString() }) };
  }
  if (input.type === 'verify_effectiveness') {
    if (control.status !== 'implemented_unverified') return { ok: false, error: 'Only an implemented but unverified control can be reviewed for effectiveness.' };
    if (person.toLocaleLowerCase() === control.owner.trim().toLocaleLowerCase()) return { ok: false, error: 'The reviewer must differ from the control owner. Names are self-entered and are not authenticated.' };
    if (input.evidenceRecordIds.length > 0 && !input.evidenceSnapshotSha256) return { ok: false, error: 'Linked verification records require a SHA-256 snapshot before effectiveness can be recorded.' };
    return { ok: true, control: riskControlSchema.parse({ ...control, status: 'effectiveness_verified', verificationNote: note, verifiedBy: person, verifiedAt: now.toISOString(), verificationEvidenceReferences: [...new Set(input.references)], verificationEvidenceRecordIds: [...new Set(input.evidenceRecordIds)], verificationEvidenceSnapshotSha256: input.evidenceSnapshotSha256, updatedAt: now.toISOString() }) };
  }
  if (input.type === 'mark_ineffective') {
    if (control.status !== 'implemented_unverified' && control.status !== 'effectiveness_verified') return { ok: false, error: 'A control must have an implementation record before its effectiveness can be marked ineffective.' };
    return { ok: true, control: riskControlSchema.parse({ ...control, status: 'ineffective', ineffectiveNote: note, verificationNote: null, verifiedBy: null, verifiedAt: null, verificationEvidenceReferences: [], verificationEvidenceRecordIds: [], verificationEvidenceSnapshotSha256: null, updatedAt: now.toISOString() }) };
  }
  if (control.status !== 'effectiveness_verified' && control.status !== 'ineffective') return { ok: false, error: 'Only verified or ineffective controls can be reopened for review.' };
  return { ok: true, control: riskControlSchema.parse({ ...control, status: 'implemented_unverified', verificationNote: null, verifiedBy: null, verifiedAt: null, verificationEvidenceReferences: [], verificationEvidenceRecordIds: [], verificationEvidenceSnapshotSha256: null, ineffectiveNote: null, updatedAt: now.toISOString() }) };
}

export function createRiskEvent(input: Omit<RiskRegisterEvent, 'id' | 'occurredAt'>, now = new Date()): RiskRegisterEvent {
  return riskRegisterEventSchema.parse({ ...input, id: crypto.randomUUID(), occurredAt: now.toISOString() });
}
