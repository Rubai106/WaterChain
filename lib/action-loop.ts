import { z } from 'zod';

export const actionStatuses = ['open', 'in_progress', 'awaiting_verification', 'verified', 'cancelled', 'reopened'] as const;

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999) return false;
  // setUTCFullYear avoids Date.UTC's special handling of years 0–99.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
export const actionPriorities = ['high', 'medium', 'low'] as const;
export const actionSourceKinds = ['finding', 'planner_recommendation', 'next_step', 'manual'] as const;

export const actionOriginSchema = z.object({
  kind: z.enum(actionSourceKinds),
  key: z.string().min(1).max(240),
  label: z.string().min(1).max(240),
  detail: z.string().max(4000),
  sourceReportFingerprint: z.string().max(128).nullable(),
  evidenceRecordIds: z.array(z.string().min(1)).max(500),
});

export const actionEvidenceLinkSchema = z.object({
  recordId: z.string().min(1),
  recordCode: z.string().min(1).max(120),
  sampleCode: z.string().min(1).max(120),
  stage: z.enum(['source', 'collection', 'storage', 'serving']),
  linkedAt: z.string().datetime(),
});

export const actionHistoryEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['created', 'updated', 'work_started', 'submitted_for_verification', 'verified', 'returned_for_work', 'cancelled', 'reopened', 'reassigned']),
  occurredAt: z.string().datetime(),
  actorLabel: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  statusFrom: z.enum(actionStatuses).nullable(),
  statusTo: z.enum(actionStatuses),
  evidenceReferences: z.array(z.string().max(500)).max(40),
});

export const actionLoopItemSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().min(1),
  title: z.string().min(1).max(240),
  details: z.string().max(4000),
  origin: actionOriginSchema,
  owner: z.string().min(1).max(120),
  dueDate: z.string().refine(isValidDateOnly, 'Due date must be a real calendar date.').nullable(),
  priority: z.enum(actionPriorities),
  status: z.enum(actionStatuses),
  createdBy: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  linkedEvidence: z.array(actionEvidenceLinkSchema).max(500),
  completionNote: z.string().max(4000).nullable(),
  completionEvidenceReferences: z.array(z.string().max(500)).max(40),
  completionEvidenceLinks: z.array(actionEvidenceLinkSchema).max(500),
  verificationNote: z.string().max(4000).nullable(),
  verificationEvidenceReferences: z.array(z.string().max(500)).max(40),
  verificationEvidenceLinks: z.array(actionEvidenceLinkSchema).max(500),
  verifiedBy: z.string().max(120).nullable(),
  cancellationReason: z.string().max(2000).nullable(),
  history: z.array(actionHistoryEventSchema).max(2000),
});

export const actionLoopStoreSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().min(1),
  items: z.array(actionLoopItemSchema).max(500),
});

export type ActionStatus = (typeof actionStatuses)[number];
export type ActionPriority = (typeof actionPriorities)[number];
export type ActionSourceKind = (typeof actionSourceKinds)[number];
export type ActionOrigin = z.infer<typeof actionOriginSchema>;
export type ActionEvidenceLink = z.infer<typeof actionEvidenceLinkSchema>;
export type ActionHistoryEvent = z.infer<typeof actionHistoryEventSchema>;
export type ActionLoopItem = z.infer<typeof actionLoopItemSchema>;

export type NewActionInput = {
  workspaceId: string;
  title: string;
  details: string;
  origin: ActionOrigin;
  owner: string;
  dueDate: string | null;
  priority: ActionPriority;
  createdBy: string;
  linkedEvidence: ActionEvidenceLink[];
};

export type ActionTransitionInput =
  | { type: 'start'; actor: string }
  | { type: 'submit_for_verification'; actor: string; note: string; evidenceReferences: string[]; evidenceLinks: ActionEvidenceLink[] }
  | { type: 'verify'; verifier: string; note: string; evidenceReferences: string[]; evidenceLinks: ActionEvidenceLink[] }
  | { type: 'return_for_work'; actor: string; reason: string }
  | { type: 'cancel'; actor: string; reason: string }
  | { type: 'reopen'; actor: string; reason: string }
  | { type: 'reassign'; actor: string; newOwner: string; reason: string }
  | { type: 'edit'; actor: string; title: string; details: string; dueDate: string | null; priority: ActionPriority; reason: string };

export type ActionTransitionResult = { ok: true; item: ActionLoopItem } | { ok: false; error: string };

export function parseEvidenceReferences(raw: string): string[] {
  return [...new Set(raw.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean))].slice(0, 40);
}

export function captureActionEvidenceLinks(ids: string[], records: Array<{ id: string; recordCode: string; sampleCode: string; stage: 'source' | 'collection' | 'storage' | 'serving' }>, now = new Date()): ActionEvidenceLink[] {
  const selected = new Set(ids);
  return records.filter((record) => selected.has(record.id)).map((record) => ({
    recordId: record.id, recordCode: record.recordCode, sampleCode: record.sampleCode, stage: record.stage, linkedAt: now.toISOString(),
  }));
}

function nonempty(value: string | undefined, label: string): string | null {
  const normalized = (value ?? '').trim();
  return normalized ? null : `${label} is required.`;
}

function appendEvent(item: ActionLoopItem, input: {
  type: ActionHistoryEvent['type']; actor: string; message: string; statusTo: ActionStatus;
  evidenceReferences?: string[]; now: Date; owner?: string; title?: string; details?: string; dueDate?: string | null; priority?: ActionPriority; completionNote?: string | null;
  completionEvidenceReferences?: string[]; completionEvidenceLinks?: ActionEvidenceLink[]; verificationNote?: string | null;
  verificationEvidenceReferences?: string[]; verificationEvidenceLinks?: ActionEvidenceLink[]; verifiedBy?: string | null; cancellationReason?: string | null;
}): ActionLoopItem {
  const actor = input.actor.trim();
  const next: ActionLoopItem = {
    ...item,
    ...(input.owner !== undefined ? { owner: input.owner } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.details !== undefined ? { details: input.details } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    status: input.statusTo,
    updatedAt: input.now.toISOString(),
    ...(input.completionNote !== undefined ? { completionNote: input.completionNote } : {}),
    ...(input.completionEvidenceReferences !== undefined ? { completionEvidenceReferences: input.completionEvidenceReferences } : {}),
    ...(input.completionEvidenceLinks !== undefined ? { completionEvidenceLinks: input.completionEvidenceLinks } : {}),
    ...(input.verificationNote !== undefined ? { verificationNote: input.verificationNote } : {}),
    ...(input.verificationEvidenceReferences !== undefined ? { verificationEvidenceReferences: input.verificationEvidenceReferences } : {}),
    ...(input.verificationEvidenceLinks !== undefined ? { verificationEvidenceLinks: input.verificationEvidenceLinks } : {}),
    ...(input.verifiedBy !== undefined ? { verifiedBy: input.verifiedBy } : {}),
    ...(input.cancellationReason !== undefined ? { cancellationReason: input.cancellationReason } : {}),
    history: [...item.history, {
      id: crypto.randomUUID(), type: input.type, occurredAt: input.now.toISOString(), actorLabel: actor,
      message: input.message, statusFrom: item.status, statusTo: input.statusTo,
      evidenceReferences: input.evidenceReferences ?? [],
    }],
  };
  return actionLoopItemSchema.parse(next);
}

export function createAction(input: NewActionInput, now = new Date()): ActionLoopItem {
  const title = input.title.trim();
  const owner = input.owner.trim();
  const createdBy = input.createdBy.trim();
  if (!title) throw new Error('Action title is required.');
  if (!owner) throw new Error('An owner is required so the action has an accountable assignee.');
  if (!createdBy) throw new Error('Created by is required for the local action history.');
  if (input.dueDate && !isValidDateOnly(input.dueDate)) throw new Error('Due date must be a real calendar date.');
  const timestamp = now.toISOString();
  const initial: ActionLoopItem = {
    id: crypto.randomUUID(), workspaceId: input.workspaceId, title, details: input.details.trim(), origin: input.origin,
    owner, dueDate: input.dueDate, priority: input.priority, status: 'open', createdBy,
    createdAt: timestamp, updatedAt: timestamp, linkedEvidence: input.linkedEvidence,
    completionNote: null, completionEvidenceReferences: [], completionEvidenceLinks: [], verificationNote: null,
    verificationEvidenceReferences: [], verificationEvidenceLinks: [], verifiedBy: null, cancellationReason: null, history: [],
  };
  const item = actionLoopItemSchema.parse(initial);
  return appendEvent(item, { type: 'created', actor: createdBy, message: `Action created from ${input.origin.label}.`, statusTo: 'open', evidenceReferences: input.linkedEvidence.map((link) => link.recordCode), now });
}

export function transitionAction(item: ActionLoopItem, input: ActionTransitionInput, now = new Date()): ActionTransitionResult {
  if (input.type === 'start') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status !== 'open' && item.status !== 'reopened') return { ok: false, error: 'Only open or reopened actions can be started.' };
    return { ok: true, item: appendEvent(item, { type: 'work_started', actor: input.actor, message: 'Work started.', statusTo: 'in_progress', now }) };
  }
  if (input.type === 'submit_for_verification') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status !== 'in_progress') return { ok: false, error: 'Only in-progress actions can be submitted for verification.' };
    const note = nonempty(input.note, 'Completion note'); if (note) return { ok: false, error: note };
    if (input.evidenceReferences.length === 0 && input.evidenceLinks.length === 0) return { ok: false, error: 'Add at least one evidence reference or link a recorded evidence item before requesting verification.' };
    const refs = [...input.evidenceReferences, ...input.evidenceLinks.map((link) => link.recordCode)];
    return { ok: true, item: appendEvent(item, { type: 'submitted_for_verification', actor: input.actor, message: 'Work submitted for independent verification.', statusTo: 'awaiting_verification', completionNote: input.note.trim(), completionEvidenceReferences: input.evidenceReferences, completionEvidenceLinks: input.evidenceLinks, evidenceReferences: refs, now }) };
  }
  if (input.type === 'verify') {
    const verifier = nonempty(input.verifier, 'Verifier name'); if (verifier) return { ok: false, error: verifier };
    if (item.status !== 'awaiting_verification') return { ok: false, error: 'Only actions awaiting verification can be verified.' };
    if (input.verifier.trim().toLocaleLowerCase() === item.owner.trim().toLocaleLowerCase()) return { ok: false, error: 'The verifier must be different from the assigned owner. Names are self-entered and are not authenticated.' };
    const note = nonempty(input.note, 'Verification note'); if (note) return { ok: false, error: note };
    if (input.evidenceReferences.length === 0 && input.evidenceLinks.length === 0) return { ok: false, error: 'Attach at least one verification evidence reference or recorded evidence item.' };
    const refs = [...input.evidenceReferences, ...input.evidenceLinks.map((link) => link.recordCode)];
    return { ok: true, item: appendEvent(item, { type: 'verified', actor: input.verifier, message: 'Action verified and closed with a recorded verification basis.', statusTo: 'verified', verificationNote: input.note.trim(), verificationEvidenceReferences: input.evidenceReferences, verificationEvidenceLinks: input.evidenceLinks, verifiedBy: input.verifier.trim(), evidenceReferences: refs, now }) };
  }
  if (input.type === 'return_for_work') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status !== 'awaiting_verification') return { ok: false, error: 'Only actions awaiting verification can be returned for more work.' };
    const reason = nonempty(input.reason, 'Return reason'); if (reason) return { ok: false, error: reason };
    return { ok: true, item: appendEvent(item, { type: 'returned_for_work', actor: input.actor, message: `Returned for more work: ${input.reason.trim()}`, statusTo: 'in_progress', completionNote: null, completionEvidenceReferences: [], completionEvidenceLinks: [], verificationNote: null, verificationEvidenceReferences: [], verificationEvidenceLinks: [], verifiedBy: null, now }) };
  }
  if (input.type === 'cancel') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status === 'verified' || item.status === 'cancelled') return { ok: false, error: 'A verified or already cancelled action cannot be cancelled again.' };
    const reason = nonempty(input.reason, 'Cancellation reason'); if (reason) return { ok: false, error: reason };
    return { ok: true, item: appendEvent(item, { type: 'cancelled', actor: input.actor, message: `Action cancelled: ${input.reason.trim()}`, statusTo: 'cancelled', cancellationReason: input.reason.trim(), now }) };
  }
  if (input.type === 'reopen') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status !== 'verified' && item.status !== 'cancelled') return { ok: false, error: 'Only verified or cancelled actions can be reopened.' };
    const reason = nonempty(input.reason, 'Reopen reason'); if (reason) return { ok: false, error: reason };
    return { ok: true, item: appendEvent(item, { type: 'reopened', actor: input.actor, message: `Action reopened: ${input.reason.trim()}`, statusTo: 'reopened', cancellationReason: null, completionNote: null, completionEvidenceReferences: [], completionEvidenceLinks: [], verificationNote: null, verificationEvidenceReferences: [], verificationEvidenceLinks: [], verifiedBy: null, now }) };
  }
  if (input.type === 'reassign') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status === 'verified' || item.status === 'cancelled') return { ok: false, error: 'Reopen the action before reassigning a verified or cancelled action.' };
    const newOwner = nonempty(input.newOwner, 'New owner'); if (newOwner) return { ok: false, error: newOwner };
    if (input.newOwner.trim().toLocaleLowerCase() === item.owner.trim().toLocaleLowerCase()) return { ok: false, error: 'The new owner must differ from the current owner.' };
    const reason = nonempty(input.reason, 'Reassignment reason'); if (reason) return { ok: false, error: reason };
    return { ok: true, item: appendEvent(item, { type: 'reassigned', actor: input.actor, message: `Reassigned from ${item.owner} to ${input.newOwner.trim()}: ${input.reason.trim()}`, statusTo: item.status, owner: input.newOwner.trim(), now }) };
  }
  if (input.type === 'edit') {
    const actor = nonempty(input.actor, 'Actor name'); if (actor) return { ok: false, error: actor };
    if (item.status !== 'open' && item.status !== 'in_progress' && item.status !== 'reopened') return { ok: false, error: 'Only open, in-progress, or reopened actions can be edited. Return a verification-pending action for work or reopen a closed action first.' };
    const title = nonempty(input.title, 'Action title'); if (title) return { ok: false, error: title };
    const reason = nonempty(input.reason, 'Edit reason'); if (reason) return { ok: false, error: reason };
    if (input.dueDate && !isValidDateOnly(input.dueDate)) return { ok: false, error: 'Due date must be a real calendar date.' };
    return { ok: true, item: appendEvent(item, { type: 'updated', actor: input.actor, message: `Action details updated: ${input.reason.trim()}`, statusTo: item.status, title: input.title.trim(), details: input.details.trim(), dueDate: input.dueDate, priority: input.priority, now }) };
  }
  return { ok: false, error: 'Unsupported action transition.' };
}

export function actionSourceStaleness(item: ActionLoopItem, currentReportFingerprint: string | null, reportStale: boolean): 'current' | 'stale' | 'unavailable' {
  if (item.origin.kind === 'manual') return 'current';
  if (reportStale) return 'stale';
  if (!currentReportFingerprint) return 'unavailable';
  return item.origin.sourceReportFingerprint === currentReportFingerprint ? 'current' : 'stale';
}

export function isActionOverdue(item: ActionLoopItem, now = new Date()): boolean {
  if (!item.dueDate || item.status === 'verified' || item.status === 'cancelled') return false;
  const due = new Date(`${item.dueDate}T23:59:59.999`);
  return Number.isFinite(due.getTime()) && due < now;
}
