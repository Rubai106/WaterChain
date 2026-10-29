'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck,
  Clock3, Download, FileCheck2, Link2, ListChecks, Plus, RotateCcw, ShieldAlert,
  ShieldCheck, UserRound, XCircle,
} from 'lucide-react';
import type { EvidenceRecord } from '@/lib/evidence';
import type { DiagnosticReport } from '@/lib/diagnostics';
import type { SelectedJourneyModel } from '@/lib/investigation-model';
import {
  actionLoopStoreSchema, actionSourceStaleness, captureActionEvidenceLinks,
  createAction, isActionOverdue, parseEvidenceReferences, transitionAction,
  type ActionLoopItem, type ActionOrigin, type ActionPriority, type ActionStatus,
} from '@/lib/action-loop';

const storagePrefix = 'waterchain:action-loop:v1:';

type SourceOption = {
  kind: ActionOrigin['kind']; key: string; label: string; detail: string; evidenceRecordIds: string[];
  sourceReportFingerprint: string | null; priority: ActionPriority;
};
type CreateDraft = {
  origin: ActionOrigin; title: string; details: string; priority: ActionPriority;
  owner: string; dueDate: string; createdBy: string; evidenceIds: string[];
};
type TransitionMode = 'start' | 'submit_for_verification' | 'verify' | 'return_for_work' | 'cancel' | 'reopen' | 'reassign' | 'edit';
type TransitionDraft = { actionId: string; mode: TransitionMode; actor: string; note: string; refs: string; evidenceIds: string[]; newOwner: string; title: string; details: string; dueDate: string; priority: ActionPriority };

const statusLabels: Record<ActionStatus, string> = {
  open: 'Open', in_progress: 'In progress', awaiting_verification: 'Awaiting verification',
  verified: 'Verified & closed', cancelled: 'Cancelled', reopened: 'Reopened',
};
const priorityLabels: Record<ActionPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const statusOrder: Record<ActionStatus, number> = { open: 0, reopened: 1, in_progress: 2, awaiting_verification: 3, verified: 4, cancelled: 5 };

function safeName(value: string) { return value.trim().replace(/[\r\n]+/g, ' ').slice(0, 120); }
function eventLabel(type: string) {
  const labels: Record<string, string> = {
    created: 'Created', updated: 'Updated', work_started: 'Work started', submitted_for_verification: 'Submitted for verification',
    verified: 'Verified & closed', returned_for_work: 'Returned for more work', cancelled: 'Cancelled',
    reopened: 'Reopened', reassigned: 'Reassigned',
  };
  return labels[type] ?? type.replaceAll('_', ' ');
}
function sourceKindLabel(kind: ActionOrigin['kind']) {
  return ({ finding: 'Diagnostic finding', planner_recommendation: 'Planner recommendation', next_step: 'Diagnostic next step', manual: 'Manual follow-up' } as const)[kind];
}
function isPersistedStore(value: unknown, workspaceId: string): value is { version: 1; workspaceId: string; items: ActionLoopItem[] } {
  const parsed = actionLoopStoreSchema.safeParse(value);
  return Boolean(parsed.success && parsed.data.workspaceId === workspaceId && parsed.data.items.every((item) => item.workspaceId === workspaceId));
}
async function digestReportSnapshot(snapshot: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot hash the diagnostic report snapshot. Creating a review-linked action is disabled; manual actions remain available.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(snapshot)));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function downloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ActionLoop({
  workspaceId, workspaceName, records, report, reportStale, journeyModel = null, readOnly = false, onNotice,
}: {
  workspaceId: string; workspaceName: string; records: EvidenceRecord[]; report: DiagnosticReport | null;
  reportStale: boolean; journeyModel?: SelectedJourneyModel | null; readOnly?: boolean; onNotice?: (message: string) => void;
}) {
  const [items, setItems] = useState<ActionLoopItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [editor, setEditor] = useState<CreateDraft | null>(null);
  const [formError, setFormError] = useState('');
  const [transition, setTransition] = useState<TransitionDraft | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [filter, setFilter] = useState<'active' | 'all' | 'verification'>('active');
  const storageKey = `${storagePrefix}${workspaceId}`;
  const [reportFingerprint, setReportFingerprint] = useState<string | null>(null);
  const [fingerprintError, setFingerprintError] = useState('');
  const recordById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);

  useEffect(() => {
    let active = true;
    setReportFingerprint(null); setFingerprintError('');
    if (!report) return () => { active = false; };
    digestReportSnapshot({ report, records, journeyModel }).then((fingerprint) => {
      if (active) setReportFingerprint(fingerprint);
    }).catch((error: unknown) => {
      if (active) setFingerprintError(error instanceof Error ? error.message : 'Could not fingerprint the current diagnostic report.');
    });
    return () => { active = false; };
  }, [report, records, journeyModel]);

  useEffect(() => {
    setHydrated(false); setStorageBlocked(false); setStorageMessage(''); setItems([]); setEditor(null); setTransition(null);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) { setItems([]); setHydrated(true); return; }
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedStore(parsed, workspaceId)) {
        setStorageBlocked(true);
        setStorageMessage('Saved ActionLoop data is malformed, belongs to another investigation, or exceeds the supported schema. The original value was left untouched. Back up the original browser storage value before clearing site data or attempting repair.');
        setHydrated(true);
        return;
      }
      setItems(parsed.items);
      setHydrated(true);
    } catch {
      setStorageBlocked(true);
      setStorageMessage('ActionLoop data could not be read from browser storage. Automatic writes are paused to avoid overwriting the original value.');
      setHydrated(true);
    }
  }, [storageKey, workspaceId]);

  // Risk & Control Register may create a linked corrective action in the same
  // browser-local workspace. Refresh on the explicit same-tab event; native
  // storage events still cover other tabs. Malformed data is never overwritten.
  useEffect(() => {
    const syncFromStorage = (event?: Event) => {
      if (event instanceof CustomEvent) {
        const detail = (event as CustomEvent<{ workspaceId?: string }>).detail;
        if (detail?.workspaceId && detail.workspaceId !== workspaceId) return;
      } else if (event instanceof StorageEvent && event.key !== storageKey) return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) { setItems([]); setStorageBlocked(false); setStorageMessage(''); return; }
        const parsed: unknown = JSON.parse(raw);
        if (!isPersistedStore(parsed, workspaceId)) {
          setStorageBlocked(true);
          setStorageMessage('Saved ActionLoop data is malformed or belongs to another investigation. The original value was left untouched.');
          return;
        }
        setItems(parsed.items); setStorageBlocked(false); setStorageMessage('');
      } catch {
        setStorageBlocked(true); setStorageMessage('ActionLoop data could not be refreshed. The existing browser value was left untouched.');
      }
    };
    const customHandler = (event: Event) => syncFromStorage(event);
    const storageHandler = (event: StorageEvent) => syncFromStorage(event);
    window.addEventListener('waterchain:action-loop-updated', customHandler);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('waterchain:action-loop-updated', customHandler);
      window.removeEventListener('storage', storageHandler);
    };
  }, [storageKey, workspaceId]);

  function commit(next: ActionLoopItem[]): boolean {
    if (readOnly || storageBlocked || !hydrated) {
      setStorageMessage(readOnly ? 'The investigation is read-only because workspace storage is unavailable.' : 'Action storage is not writable. No changes were saved.');
      return false;
    }
    const store = { version: 1 as const, workspaceId, items: next };
    const parsed = actionLoopStoreSchema.safeParse(store);
    if (!parsed.success) { setStorageMessage('The action update failed schema validation. No changes were saved.'); return false; }
    if (new Set(next.map((item) => item.id)).size !== next.length) { setStorageMessage('Duplicate internal action IDs detected. No changes were saved.'); return false; }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(parsed.data));
      setItems(next); setStorageMessage('');
      return true;
    } catch {
      setStorageMessage('Browser storage is full or unavailable. The action change was not applied. Export existing data and free storage before continuing.');
      return false;
    }
  }

  // Temporal-evidence planner handoff. It opens the existing ActionLoop editor;
  // it does not create or persist an action until the user reviews and submits it.
  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const detail = (event as CustomEvent<{
        workspaceId?: string; title?: string; details?: string; priority?: ActionPriority;
        sourceKey?: string; sourceLabel?: string; evidenceRecordIds?: string[];
      }>).detail;
      if (!detail || detail.workspaceId !== workspaceId) return;
      if (readOnly || storageBlocked || !hydrated) {
        onNotice?.('ActionLoop is not writable right now. The temporal recommendation was not saved; resolve the storage issue and try again.');
        return;
      }
      const title = typeof detail.title === 'string' ? detail.title.trim().slice(0, 240) : '';
      const detailsText = typeof detail.details === 'string' ? detail.details.slice(0, 4000) : '';
      if (!title) { onNotice?.('The temporal recommendation has no usable title. No action was created.'); return; }
      const evidenceIds = [...new Set((Array.isArray(detail.evidenceRecordIds) ? detail.evidenceRecordIds : []).filter((id): id is string => typeof id === 'string' && recordById.has(id)))].slice(0, 500);
      const origin: ActionOrigin = {
        kind: 'planner_recommendation', key: (typeof detail.sourceKey === 'string' ? detail.sourceKey : `temporal-plan:${crypto.randomUUID()}`).slice(0, 240),
        label: (typeof detail.sourceLabel === 'string' ? detail.sourceLabel : 'Temporal evidence planner').slice(0, 240),
        detail: detailsText, sourceReportFingerprint: reportFingerprint && !reportStale ? reportFingerprint : null,
        evidenceRecordIds: evidenceIds,
      };
      setEditor({ origin, title, details: detailsText, priority: detail.priority === 'high' || detail.priority === 'low' ? detail.priority : 'medium', owner: '', dueDate: '', createdBy: '', evidenceIds });
      setFormError(''); setTransition(null); setTransitionError('');
    };
    window.addEventListener('waterchain:action-loop-prefill', handlePrefill);
    return () => window.removeEventListener('waterchain:action-loop-prefill', handlePrefill);
  }, [workspaceId, readOnly, storageBlocked, hydrated, recordById, reportFingerprint, reportStale, onNotice]);

  // Temporal planner handoff: open the existing ActionLoop draft editor without
  // silently creating an action. Users must still assign owner/date and submit.
  useEffect(() => {
    type TemporalPrefill = { workspaceId?: string; title?: string; details?: string; priority?: ActionPriority; sourceKey?: string; sourceLabel?: string; evidenceRecordIds?: string[] };
    const handlePrefill = (event: Event) => {
      const detail = (event as CustomEvent<TemporalPrefill>).detail;
      if (!detail || detail.workspaceId !== workspaceId) return;
      if (readOnly || storageBlocked || !hydrated) {
        onNotice?.('ActionLoop is not writable. The proposed temporal action was not saved; resolve the storage issue before trying again.');
        return;
      }
      const title = typeof detail.title === 'string' ? detail.title.trim().slice(0, 240) : '';
      const detailsText = typeof detail.details === 'string' ? detail.details.slice(0, 4000) : '';
      if (!title) { onNotice?.('The temporal planner did not provide a valid action title. No action was created.'); return; }
      const evidenceIds = [...new Set((Array.isArray(detail.evidenceRecordIds) ? detail.evidenceRecordIds : []).filter((id): id is string => typeof id === 'string' && recordById.has(id)))].slice(0, 500);
      const origin: ActionOrigin = {
        kind: 'planner_recommendation',
        key: (typeof detail.sourceKey === 'string' ? detail.sourceKey : `temporal-plan:${crypto.randomUUID()}`).slice(0, 240),
        label: (typeof detail.sourceLabel === 'string' ? detail.sourceLabel : 'Temporal evidence planner').slice(0, 240),
        detail: detailsText,
        sourceReportFingerprint: reportFingerprint && !reportStale ? reportFingerprint : null,
        evidenceRecordIds: evidenceIds,
      };
      setEditor({ origin, title, details: detailsText, priority: detail.priority === 'high' || detail.priority === 'low' ? detail.priority : 'medium', owner: '', dueDate: '', createdBy: '', evidenceIds });
      setFormError(''); setTransition(null); setTransitionError('');
    };
    window.addEventListener('waterchain:action-loop-prefill', handlePrefill);
    return () => window.removeEventListener('waterchain:action-loop-prefill', handlePrefill);
  }, [workspaceId, readOnly, storageBlocked, hydrated, recordById, reportFingerprint, reportStale, onNotice]);

  const sourceOptions = useMemo<SourceOption[]>(() => {
    if (!report || reportStale || !reportFingerprint) return [];
    const options: SourceOption[] = [];
    // Put the engine's explicit next-action planner first so it is not hidden
    // when an investigation has many findings.
    (report.next_actions ?? []).forEach((recommendation) => {
      options.push({
        kind: 'planner_recommendation', key: `planner:${recommendation.id}`, label: recommendation.title,
        detail: `${recommendation.why} Positive result: ${recommendation.what_positive_would_mean} Negative result: ${recommendation.what_negative_would_mean}${recommendation.prerequisites.length ? ` Prerequisites: ${recommendation.prerequisites.join('; ')}` : ''}`.slice(0, 4000),
        evidenceRecordIds: [], sourceReportFingerprint: reportFingerprint, priority: recommendation.priority,
      });
    });
    options.push({
      kind: 'next_step', key: 'diagnostic-next-step', label: report.next_step.action,
      detail: (report.next_step.reason + (report.next_step.target_stage ? ` Target stage: ${report.next_step.target_stage}.` : '')).slice(0, 4000),
      evidenceRecordIds: [], sourceReportFingerprint: reportFingerprint, priority: 'medium',
    });
    report.findings.forEach((finding, index) => {
      const linked = records.filter((record) => finding.record_ids.includes(record.id) || finding.record_ids.includes(record.recordCode));
      const label = `${finding.severity.toUpperCase()}: ${finding.code.replaceAll('_', ' ')}`;
      options.push({
        kind: 'finding', key: `finding:${index}:${finding.code}`,
        label, detail: finding.message,
        evidenceRecordIds: linked.map((record) => record.id), sourceReportFingerprint: reportFingerprint,
        priority: finding.severity === 'blocker' ? 'high' : finding.severity === 'warning' ? 'medium' : 'low',
      });
    });
    return options;
  }, [report, reportStale, reportFingerprint, records]);

  const activeItems = items.filter((item) => !['verified', 'cancelled'].includes(item.status));
  const awaitingCount = items.filter((item) => item.status === 'awaiting_verification').length;
  const overdueCount = items.filter((item) => isActionOverdue(item)).length;
  const visibleItems = items.filter((item) => filter === 'all' || (filter === 'active' ? !['verified', 'cancelled'].includes(item.status) : item.status === 'awaiting_verification'))
    .sort((a, b) => Number(isActionOverdue(b)) - Number(isActionOverdue(a)) || statusOrder[a.status] - statusOrder[b.status] || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) || (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || b.updatedAt.localeCompare(a.updatedAt));

  function beginCreate(option: SourceOption | null) {
    const origin: ActionOrigin = option ? {
      kind: option.kind, key: option.key, label: option.label, detail: option.detail,
      sourceReportFingerprint: option.sourceReportFingerprint, evidenceRecordIds: option.evidenceRecordIds,
    } : { kind: 'manual', key: `manual:${crypto.randomUUID()}`, label: 'Manual follow-up', detail: 'Created manually by an investigation operator.', sourceReportFingerprint: null, evidenceRecordIds: [] };
    const title = option ? (option.kind === 'finding' ? `Resolve: ${option.label.toLocaleLowerCase()}` : option.label) : '';
    setEditor({ origin, title: title.slice(0, 240), details: option?.detail ?? '', priority: option?.priority ?? 'medium', owner: '', dueDate: '', createdBy: '', evidenceIds: option?.evidenceRecordIds ?? [] });
    setFormError('');
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    try {
      const linkedEvidence = captureActionEvidenceLinks(editor.evidenceIds, records);
      const created = createAction({
        workspaceId, title: editor.title, details: editor.details, origin: editor.origin, owner: safeName(editor.owner),
        dueDate: editor.dueDate || null, priority: editor.priority, createdBy: safeName(editor.createdBy), linkedEvidence,
      });
      if (items.some((item) => item.id === created.id)) throw new Error('An action ID collision occurred. Please try again.');
      if (commit([created, ...items])) {
        setEditor(null); setFormError(''); onNotice?.(`Action created: “${created.title}”. It is open and requires follow-through; creation does not resolve its source finding.`);
      }
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not create the action.'); }
  }

  function beginTransition(item: ActionLoopItem, mode: TransitionMode) {
    setTransition({ actionId: item.id, mode, actor: '', note: '', refs: '', evidenceIds: [], newOwner: '', title: item.title, details: item.details, dueDate: item.dueDate ?? '', priority: item.priority });
    setTransitionError('');
  }

  function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transition) return;
    const item = items.find((candidate) => candidate.id === transition.actionId);
    if (!item) { setTransitionError('The action no longer exists in this investigation.'); return; }
    const references = parseEvidenceReferences(transition.refs);
    const evidenceLinks = captureActionEvidenceLinks(transition.evidenceIds, records);
    const result = transitionAction(item, (() => {
      switch (transition.mode) {
        case 'start': return { type: 'start', actor: safeName(transition.actor) } as const;
        case 'submit_for_verification': return { type: 'submit_for_verification', actor: safeName(transition.actor), note: transition.note, evidenceReferences: references, evidenceLinks } as const;
        case 'verify': return { type: 'verify', verifier: safeName(transition.actor), note: transition.note, evidenceReferences: references, evidenceLinks } as const;
        case 'return_for_work': return { type: 'return_for_work', actor: safeName(transition.actor), reason: transition.note } as const;
        case 'cancel': return { type: 'cancel', actor: safeName(transition.actor), reason: transition.note } as const;
        case 'reopen': return { type: 'reopen', actor: safeName(transition.actor), reason: transition.note } as const;
        case 'reassign': return { type: 'reassign', actor: safeName(transition.actor), newOwner: safeName(transition.newOwner), reason: transition.note } as const;
        case 'edit': return { type: 'edit', actor: safeName(transition.actor), title: transition.title, details: transition.details, dueDate: transition.dueDate || null, priority: transition.priority, reason: transition.note } as const;
      }
    })());
    if (!result.ok) { setTransitionError(result.error); return; }
    const next = items.map((candidate) => candidate.id === item.id ? result.item : candidate);
    if (commit(next)) {
      const label = statusLabels[result.item.status];
      setTransition(null); setTransitionError('');
      onNotice?.(`Action “${item.title}” updated to ${label}. The history entry is locally stored and names are self-entered, not authenticated.`);
    }
  }

  function exportRegister() {
    const payload = { schema: 'waterchain-actionloop-export-v1', exportedAt: new Date().toISOString(), workspaceId, workspaceName, storageScope: 'browser-local', actorIdentity: 'self-entered; not authenticated', actions: items };
    downloadJson(`waterchain-actions-${workspaceName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'investigation'}.json`, JSON.stringify(payload, null, 2));
  }

  const transitionNeedsRefs = transition?.mode === 'submit_for_verification' || transition?.mode === 'verify';
  const actionUnavailable = !hydrated || storageBlocked || readOnly;

  return (
    <section className="panel action-loop-panel" id="action-loop" aria-labelledby="action-loop-title">
      <div className="panel-header action-loop-header">
        <div>
          <div className="panel-kicker">05 / INVESTIGATION FOLLOW-THROUGH</div>
          <h2 id="action-loop-title">ActionLoop</h2>
          <p>Turn findings into assigned work, evidence-backed verification, and a reviewable closure trail.</p>
        </div>
        <div className="action-loop-header-actions">
          <button type="button" className="secondary-button" disabled={!hydrated || items.length === 0} onClick={exportRegister}><Download size={14}/> Export action log</button>
          <button type="button" className="primary-button" disabled={actionUnavailable} onClick={() => beginCreate(null)}><Plus size={15}/> Create action</button>
        </div>
      </div>

      <div className="action-loop-body">
        <div className="action-loop-scope-note"><ShieldCheck size={15}/><span><strong>Local single-browser workflow.</strong> Owner and reviewer names are self-entered, not authenticated identities. Verification records workflow completion; it does not verify water safety or prove a contamination source.</span></div>
        {storageMessage && <div className="action-loop-alert" role="alert"><AlertCircle size={15}/><span>{storageMessage}</span></div>}
        {fingerprintError && report && !reportStale && <div className="action-loop-alert" role="status"><AlertCircle size={15}/><span>{fingerprintError}</span></div>}
        <div className="action-loop-metrics" aria-label="Action summary">
          <div><span>Active actions</span><strong>{activeItems.length}</strong></div>
          <div><span>Awaiting verification</span><strong>{awaitingCount}</strong></div>
          <div><span>Overdue</span><strong>{overdueCount}</strong></div>
          <div><span>Verified & closed</span><strong>{items.filter((item) => item.status === 'verified').length}</strong></div>
        </div>

        <div className="action-loop-source-section">
          <div className="action-loop-section-head"><div><h3>Suggested actions from this review</h3><p>Each action captures a snapshot of the finding or recommendation that motivated it.</p></div>{reportStale && <span className="action-source-chip stale">Review stale</span>}</div>
          {!report ? <div className="action-loop-empty-source"><ClipboardCheck size={19}/><div><strong>No current diagnostic review</strong><p>Run a diagnostic review to create actions linked to its findings and recommendations. You can still create a manual follow-up action.</p></div></div>
            : reportStale ? <div className="action-loop-empty-source"><AlertCircle size={19}/><div><strong>Review is stale</strong><p>Run a fresh review before creating an action from a diagnostic finding. Existing actions keep their original source snapshots and are marked below when stale.</p></div></div>
              : fingerprintError ? <div className="action-loop-empty-source"><AlertCircle size={19}/><div><strong>Could not fingerprint the current review</strong><p>Diagnostic-linked action creation is paused because a stable report snapshot could not be created. Manual follow-up actions remain available.</p></div></div>
                : !reportFingerprint ? <div className="action-loop-empty-source"><Clock3 size={19}/><div><strong>Preparing review snapshot</strong><p>WaterChain is creating a SHA-256 snapshot before allowing an action to be linked to this report.</p></div></div>
                  : sourceOptions.length === 0 ? <div className="action-loop-empty-source"><CheckCircle2 size={19}/><div><strong>No engine findings or suggested next step</strong><p>You can still record a manual investigation action. Do not create one merely to make the case look complete.</p></div></div>
                    : <div className="action-source-grid">{sourceOptions.slice(0, 8).map((option) => {
                  const existing = items.some((item) => item.origin.key === option.key && item.origin.sourceReportFingerprint === option.sourceReportFingerprint && !['verified', 'cancelled'].includes(item.status));
                  return <article className="action-source-card" key={option.key}><div className="action-source-card-top"><span className={`action-priority priority-${option.priority}`}>{priorityLabels[option.priority]}</span><span className="action-source-kind">{sourceKindLabel(option.kind)}</span></div><strong>{option.label}</strong><p>{option.detail}</p><div className="action-source-card-footer">{option.evidenceRecordIds.length > 0 && <span><Link2 size={12}/>{option.evidenceRecordIds.map((id) => recordById.get(id)?.recordCode ?? id).join(', ')}</span>}<button className="text-button" type="button" disabled={actionUnavailable || existing} onClick={() => beginCreate(option)}>{existing ? 'Active action exists' : 'Create action'} <ArrowRight size={13}/></button></div></article>;
                })}</div>}
        </div>

        <div className="action-loop-list-header"><div><h3>Action register</h3><p>Actions stay open until required work and verification evidence are recorded.</p></div><label className="action-filter-label" htmlFor="action-filter">Show<select id="action-filter" className="form-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="active">Active actions</option><option value="verification">Awaiting verification</option><option value="all">All actions</option></select></label></div>

        {editor && <form className="action-editor" onSubmit={handleCreate} noValidate>
          <div className="action-editor-head"><div><span className="panel-kicker">NEW ACTION</span><h3>Create an accountable follow-up</h3></div><button className="small-icon-button" type="button" aria-label="Cancel create action" onClick={() => { setEditor(null); setFormError(''); }}><XCircle size={17}/></button></div>
          <div className="action-origin-preview"><span>{sourceKindLabel(editor.origin.kind)}</span><strong>{editor.origin.label}</strong><p>{editor.origin.detail || 'Manual action without a diagnostic source.'}</p>{editor.origin.kind !== 'manual' && <small>This action stores a snapshot of the source review. If the review changes, the relationship is flagged stale; the action itself is not silently rewritten.</small>}</div>
          <div className="action-form-grid">
            <div className="action-field action-field-wide"><label className="field-label" htmlFor="action-title">Action title <span className="required-mark">*</span></label><input id="action-title" className="text-input" maxLength={240} required value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="e.g. Verify the sampling-event reference"/></div>
            <div className="action-field"><label className="field-label" htmlFor="action-owner">Assigned owner <span className="required-mark">*</span></label><input id="action-owner" className="text-input" maxLength={120} required value={editor.owner} onChange={(event) => setEditor({ ...editor, owner: event.target.value })} placeholder="Person responsible"/></div>
            <div className="action-field"><label className="field-label" htmlFor="action-created-by">Created by <span className="required-mark">*</span></label><input id="action-created-by" className="text-input" maxLength={120} required value={editor.createdBy} onChange={(event) => setEditor({ ...editor, createdBy: event.target.value })} placeholder="Self-entered name"/><small>Not authenticated by this prototype.</small></div>
            <div className="action-field"><label className="field-label" htmlFor="action-due-date">Due date</label><input id="action-due-date" type="date" className="text-input" value={editor.dueDate} onChange={(event) => setEditor({ ...editor, dueDate: event.target.value })}/></div>
            <div className="action-field"><label className="field-label" htmlFor="action-priority">Priority</label><select id="action-priority" className="form-select" value={editor.priority} onChange={(event) => setEditor({ ...editor, priority: event.target.value as ActionPriority })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
            <div className="action-field action-field-wide"><label className="field-label" htmlFor="action-details">Action details and intended outcome</label><textarea id="action-details" className="text-input action-textarea" maxLength={4000} value={editor.details} onChange={(event) => setEditor({ ...editor, details: event.target.value })} placeholder="What needs to be done, and what should be documented?"/></div>
            {records.length > 0 && <div className="action-field action-field-wide"><label className="field-label" htmlFor="action-linked-evidence">Link relevant existing evidence records</label><select id="action-linked-evidence" className="form-select action-multiselect" multiple value={editor.evidenceIds} onChange={(event) => setEditor({ ...editor, evidenceIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>{records.map((record) => <option key={record.id} value={record.id}>{record.recordCode} · {record.sampleCode} · {record.stage} · {record.result}</option>)}</select><small>Use Ctrl/Cmd to select more than one. Links keep the internal record ID plus a display snapshot.</small></div>}
          </div>
          {formError && <p className="action-form-error" role="alert"><AlertCircle size={14}/>{formError}</p>}
          <div className="action-form-footer"><span>Creation records an action; it does not mark the finding resolved.</span><div><button type="button" className="secondary-button" onClick={() => { setEditor(null); setFormError(''); }}>Cancel</button><button type="submit" className="primary-button" disabled={actionUnavailable}>Create action <ArrowRight size={14}/></button></div></div>
        </form>}

        {!hydrated ? <div className="action-loop-empty">Loading actions for this investigation…</div>
          : visibleItems.length === 0 ? <div className="action-loop-empty"><div className="action-loop-empty-icon"><ListChecks size={21}/></div><strong>{items.length === 0 ? 'No follow-up actions recorded' : 'No actions match this filter'}</strong><p>{items.length === 0 ? 'Create an action from a current finding or add a manual follow-up. No actions are generated automatically.' : 'Change the filter to inspect other actions.'}</p><button className="secondary-button" type="button" disabled={actionUnavailable} onClick={() => beginCreate(null)}><Plus size={14}/> Create manual action</button></div>
            : <div className="action-register-list">{visibleItems.map((item) => {
              const sourceFreshness = actionSourceStaleness(item, reportFingerprint, reportStale);
              const overdue = isActionOverdue(item);
              const isTransitioning = transition?.actionId === item.id;
              return <article className={`action-item-card action-status-${item.status}`} key={item.id}>
                <div className="action-item-main">
                  <div className="action-item-top"><span className={`action-status-chip status-${item.status}`}>{statusLabels[item.status]}</span><span className={`action-priority priority-${item.priority}`}>{priorityLabels[item.priority]} priority</span>{overdue && <span className="action-overdue-chip"><CalendarClock size={12}/> Overdue</span>}<span className="action-updated">Updated {new Date(item.updatedAt).toLocaleString()}</span></div>
                  <h4>{item.title}</h4><p className="action-item-details">{item.details || 'No additional details recorded.'}</p>
                  <div className="action-item-metadata"><span><UserRound size={13}/> Owner: <strong>{item.owner}</strong></span><span><CalendarClock size={13}/> Due: <strong>{item.dueDate || 'Not set'}</strong></span><span><Link2 size={13}/> Source: <strong>{item.origin.label}</strong></span></div>
                  {item.origin.kind !== 'manual' && <div className={`action-source-chip ${sourceFreshness}`}>{sourceFreshness === 'current' ? 'Source review matches current report' : sourceFreshness === 'stale' ? 'Source review is stale — action context retained' : 'Source review is not loaded — action context retained'}</div>}
                  {item.linkedEvidence.length > 0 && <div className="action-linked-records"><strong>Linked evidence at creation</strong>{item.linkedEvidence.map((link) => <span key={`${link.recordId}-${link.linkedAt}`}><FileCheck2 size={12}/>{link.recordCode} · {link.stage} · internal ID retained</span>)}</div>}
                  {item.completionNote && <div className="action-evidence-summary"><strong>Completion note</strong><p>{item.completionNote}</p>{item.completionEvidenceReferences.length > 0 && <small>References: {item.completionEvidenceReferences.join(' · ')}</small>}{item.completionEvidenceLinks.length > 0 && <small>Linked records: {item.completionEvidenceLinks.map((link) => `${link.recordCode} (${link.stage})`).join(' · ')}</small>}</div>}
                  {item.verificationNote && <div className="action-evidence-summary verified-summary"><strong>Verification recorded by {item.verifiedBy}</strong><p>{item.verificationNote}</p>{item.verificationEvidenceReferences.length > 0 && <small>References: {item.verificationEvidenceReferences.join(' · ')}</small>}{item.verificationEvidenceLinks.length > 0 && <small>Linked records: {item.verificationEvidenceLinks.map((link) => `${link.recordCode} (${link.stage})`).join(' · ')}</small>}<small>Workflow verification only; identity and evidence authenticity are not independently authenticated.</small></div>}
                  {item.cancellationReason && item.status === 'cancelled' && <div className="action-evidence-summary"><strong>Cancellation reason</strong><p>{item.cancellationReason}</p></div>}
                </div>
                {isTransitioning && transition && <form className="action-transition-form" onSubmit={submitTransition} noValidate>
                  <div className="action-editor-head"><div><span className="panel-kicker">{transition.mode.replaceAll('_', ' ').toUpperCase()}</span><h4>{transition.mode === 'verify' ? 'Verify the completed action' : transition.mode === 'submit_for_verification' ? 'Submit work and evidence for verification' : transition.mode === 'reassign' ? 'Reassign accountable ownership' : transition.mode === 'cancel' ? 'Cancel with a recorded reason' : transition.mode === 'reopen' ? 'Reopen a closed action' : transition.mode === 'return_for_work' ? 'Return for more work' : transition.mode === 'edit' ? 'Update action details' : 'Start the assigned work'}</h4></div><button className="small-icon-button" type="button" aria-label="Cancel status change" onClick={() => { setTransition(null); setTransitionError(''); }}><XCircle size={17}/></button></div>
                  <div className="action-form-grid">
                    <div className="action-field"><label className="field-label" htmlFor={`transition-actor-${item.id}`}>{transition.mode === 'verify' ? 'Verifier name' : 'Action taken by'} <span className="required-mark">*</span></label><input id={`transition-actor-${item.id}`} className="text-input" maxLength={120} required value={transition.actor} onChange={(event) => setTransition({ ...transition, actor: event.target.value })} placeholder="Self-entered name"/></div>
                    {transition.mode === 'reassign' && <div className="action-field"><label className="field-label" htmlFor={`transition-new-owner-${item.id}`}>New owner <span className="required-mark">*</span></label><input id={`transition-new-owner-${item.id}`} className="text-input" maxLength={120} required value={transition.newOwner} onChange={(event) => setTransition({ ...transition, newOwner: event.target.value })} placeholder="New responsible person"/></div>}
                    {transition.mode === 'edit' && <>
                      <div className="action-field action-field-wide"><label className="field-label" htmlFor={`transition-title-${item.id}`}>Action title <span className="required-mark">*</span></label><input id={`transition-title-${item.id}`} className="text-input" maxLength={240} required value={transition.title} onChange={(event) => setTransition({ ...transition, title: event.target.value })}/></div>
                      <div className="action-field action-field-wide"><label className="field-label" htmlFor={`transition-details-${item.id}`}>Action details</label><textarea id={`transition-details-${item.id}`} className="text-input action-textarea" maxLength={4000} value={transition.details} onChange={(event) => setTransition({ ...transition, details: event.target.value })}/></div>
                      <div className="action-field"><label className="field-label" htmlFor={`transition-due-${item.id}`}>Due date</label><input id={`transition-due-${item.id}`} type="date" className="text-input" value={transition.dueDate} onChange={(event) => setTransition({ ...transition, dueDate: event.target.value })}/></div>
                      <div className="action-field"><label className="field-label" htmlFor={`transition-priority-${item.id}`}>Priority</label><select id={`transition-priority-${item.id}`} className="form-select" value={transition.priority} onChange={(event) => setTransition({ ...transition, priority: event.target.value as ActionPriority })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
                    </>}
                    {(['submit_for_verification', 'verify', 'return_for_work', 'cancel', 'reopen', 'reassign', 'edit'].includes(transition.mode)) && <div className="action-field action-field-wide"><label className="field-label" htmlFor={`transition-note-${item.id}`}>{transition.mode === 'submit_for_verification' ? 'Work completed / outcome' : transition.mode === 'verify' ? 'Verification note' : transition.mode === 'return_for_work' ? 'Reason for return' : transition.mode === 'cancel' ? 'Cancellation reason' : transition.mode === 'reopen' ? 'Reason for reopening' : transition.mode === 'reassign' ? 'Reason for reassignment' : 'Reason for changing action details'} <span className="required-mark">*</span></label><textarea id={`transition-note-${item.id}`} className="text-input action-textarea" maxLength={4000} required value={transition.note} onChange={(event) => setTransition({ ...transition, note: event.target.value })} placeholder="Record the facts and rationale; avoid claiming more than the evidence establishes."/></div>}
                    {transitionNeedsRefs && <>
                      <div className="action-field action-field-wide"><label className="field-label" htmlFor={`transition-evidence-${item.id}`}>Link supporting evidence records</label><select id={`transition-evidence-${item.id}`} className="form-select action-multiselect" multiple value={transition.evidenceIds} onChange={(event) => setTransition({ ...transition, evidenceIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>{records.map((record) => <option key={record.id} value={record.id}>{record.recordCode} · {record.sampleCode} · {record.stage}</option>)}</select><small>Choose one or more recorded evidence items, if applicable.</small></div>
                      <div className="action-field action-field-wide"><label className="field-label" htmlFor={`transition-refs-${item.id}`}>Or enter evidence/document references</label><textarea id={`transition-refs-${item.id}`} className="text-input action-textarea" value={transition.refs} onChange={(event) => setTransition({ ...transition, refs: event.target.value })} placeholder="One reference per line: report ID, sampling-event ID, verified file hash, or document location"/><small>WaterChain stores these as user-entered references; it does not authenticate them.</small></div>
                    </>}
                  </div>
                  {transition.mode === 'verify' && <p className="action-review-rule"><ShieldAlert size={14}/> Reviewer must differ from the assigned owner. This is a self-attested workflow rule, not authenticated separation of duties.</p>}
                  {transitionError && <p className="action-form-error" role="alert"><AlertCircle size={14}/>{transitionError}</p>}
                  <div className="action-form-footer"><span>Every transition appends a local history event.</span><div><button type="button" className="secondary-button" onClick={() => { setTransition(null); setTransitionError(''); }}>Cancel</button><button type="submit" className="primary-button">Record transition <ArrowRight size={14}/></button></div></div>
                </form>}
                <div className="action-item-controls">
                  {item.status === 'open' || item.status === 'reopened' ? <button type="button" className="secondary-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'start')}><ArrowRight size={13}/> Start work</button> : null}
                  {item.status === 'in_progress' ? <button type="button" className="primary-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'submit_for_verification')}><ClipboardCheck size={13}/> Submit for verification</button> : null}
                  {item.status === 'awaiting_verification' ? <><button type="button" className="primary-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'verify')}><ShieldCheck size={13}/> Verify & close</button><button type="button" className="secondary-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'return_for_work')}><RotateCcw size={13}/> Return for work</button></> : null}
                  {item.status === 'open' || item.status === 'in_progress' || item.status === 'reopened' ? <button type="button" className="quiet-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'edit')}>Edit details</button> : null}
                  {item.status !== 'verified' && item.status !== 'cancelled' ? <button type="button" className="quiet-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'reassign')}>Reassign</button> : null}
                  {item.status !== 'verified' && item.status !== 'cancelled' ? <button type="button" className="quiet-button action-cancel-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'cancel')}>Cancel action</button> : null}
                  {item.status === 'verified' || item.status === 'cancelled' ? <button type="button" className="secondary-button" disabled={actionUnavailable} onClick={() => beginTransition(item, 'reopen')}><RotateCcw size={13}/> Reopen with reason</button> : null}
                  <details className="action-history"><summary><Clock3 size={13}/> History ({item.history.length}) <ChevronDown size={13}/></summary><div className="action-history-list">{[...item.history].reverse().map((event) => <div className="action-history-event" key={event.id}><span className="action-history-time">{new Date(event.occurredAt).toLocaleString()}</span><strong>{eventLabel(event.type)}</strong><p>{event.message}</p><small>Recorded by {event.actorLabel} · self-entered, not authenticated</small>{event.evidenceReferences.length > 0 && <small>References: {event.evidenceReferences.join(' · ')}</small>}</div>)}</div></details>
                </div>
              </article>;
            })}</div>}
        <div className="action-loop-disclaimer"><ShieldAlert size={14}/><p>Action completion is not proof that a water-quality hazard was removed. “Verified & closed” means a named reviewer recorded an outcome and supporting reference. This prototype has no authenticated user accounts, shared database, or server-side audit authority.</p></div>
      </div>
    </section>
  );
}
