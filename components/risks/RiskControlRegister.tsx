'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList,
  Download, FileCheck2, Link2, Plus, RotateCcw, ShieldAlert, ShieldCheck, TriangleAlert, X,
} from 'lucide-react';
import type { EvidenceRecord } from '@/lib/evidence';
import {
  actionLoopStoreSchema, captureActionEvidenceLinks, createAction,
  type ActionPriority,
} from '@/lib/action-loop';
import {
  createRisk, createRiskControl, createRiskEvent, riskRegisterStoreSchema, screeningPriority, transitionRiskControl,
  type ControlKind, type ControlStatus, type HazardBasis, type HazardLikelihood, type HazardSeverity, type HazardType,
  type RiskControl, type RiskRecord, type RiskRegisterStore, type ControlTransitionInput,
} from '@/lib/risk-register';

const RISK_STORAGE_PREFIX = 'waterchain:risk-register:v1:';
type VerificationFreshness = 'checking' | 'current' | 'stale';
const ACTION_STORAGE_PREFIX = 'waterchain:action-loop:v1:';

type RiskDraft = {
  title: string; hazardType: HazardType; basis: HazardBasis; description: string; location: string; observedAt: string;
  severity: HazardSeverity; likelihood: HazardLikelihood; evidenceIds: string[]; refs: string; actor: string;
};
type ControlDraft = { riskId: string; kind: ControlKind; title: string; description: string; owner: string; createdBy: string; evidenceIds: string[]; refs: string };
type ControlTransitionDraft = { controlId: string; mode: ControlTransitionInput['type']; actor: string; note: string; refs: string; evidenceIds: string[] };
type ActionDraft = { controlId: string; owner: string; createdBy: string; dueDate: string; priority: ActionPriority };
type CloseDraft = { riskId: string; actor: string; note: string; refs: string };
type RiskStatusDraft = { riskId: string; target: 'open' | 'monitoring'; actor: string; reason: string };

const hazardTypeLabels: Record<HazardType, string> = {
  microbiological: 'Microbiological', chemical: 'Chemical', physical: 'Physical', sanitary_condition: 'Sanitary condition', operational: 'Operational', unknown: 'Unknown / not classified',
};
const basisLabels: Record<HazardBasis, string> = {
  observed_hazard: 'Observed hazard', suspected_hazard: 'Suspected hazard', laboratory_finding: 'Laboratory finding', sanitary_inspection: 'Sanitary inspection', process_deviation: 'Process deviation',
};
const statusLabels: Record<ControlStatus, string> = {
  proposed: 'Proposed', documented: 'Documented', implemented_unverified: 'Implemented · not verified', effectiveness_verified: 'Effectiveness verified', ineffective: 'Ineffective', unknown: 'Status unknown',
};
const controlKindLabels: Record<ControlKind, string> = { preventive: 'Preventive', monitoring: 'Monitoring', mitigation: 'Mitigation', corrective: 'Corrective' };
const riskStatusLabels = { open: 'Open', monitoring: 'Monitoring', review_closed: 'Review record closed' } as const;

function safeLabel(value: string) { return value.trim().replace(/[\r\n]+/g, ' ').slice(0, 120); }
function parseRefs(raw: string): string[] { return [...new Set(raw.split(/[\n,;]/).map((value) => value.trim()).filter(Boolean))].slice(0, 40); }
function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function downloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function emptyStore(workspaceId: string): RiskRegisterStore { return { version: 1, workspaceId, risks: [], controls: [], events: [] }; }
function eventList(events: RiskRegisterStore['events'], event: RiskRegisterStore['events'][number]) { return [...events, event].slice(-5000); }
async function digestVerificationEvidence(ids: string[], recordById: Map<string, EvidenceRecord>): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot fingerprint verification evidence. Effectiveness verification with linked records is disabled.');
  const records = ids.slice().sort().map((id) => {
    const record = recordById.get(id);
    if (!record) throw new Error(`Linked evidence record ${id} is missing. Reconcile the evidence before verifying effectiveness.`);
    const canonical = Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
    return { id, record: canonical };
  });
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(records)));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function priorityClass(priority: ReturnType<typeof screeningPriority>) { return `risk-priority risk-priority-${priority}`; }
function controlClass(status: ControlStatus) { return `risk-control-status risk-control-status-${status}`; }

export default function RiskControlRegister({ workspaceId, workspaceName, records, readOnly = false, onNotice }: {
  workspaceId: string; workspaceName: string; records: EvidenceRecord[]; readOnly?: boolean; onNotice?: (message: string) => void;
}) {
  const [store, setStore] = useState<RiskRegisterStore>(() => emptyStore(workspaceId));
  const [hydrated, setHydrated] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [riskError, setRiskError] = useState('');
  const [controlDraft, setControlDraft] = useState<ControlDraft | null>(null);
  const [controlError, setControlError] = useState('');
  const [transitionDraft, setTransitionDraft] = useState<ControlTransitionDraft | null>(null);
  const [transitionError, setTransitionError] = useState('');
  const [actionDraft, setActionDraft] = useState<ActionDraft | null>(null);
  const [actionError, setActionError] = useState('');
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);
  const [closeError, setCloseError] = useState('');
  const [statusDraft, setStatusDraft] = useState<RiskStatusDraft | null>(null);
  const [statusError, setStatusError] = useState('');
  const [verificationFreshness, setVerificationFreshness] = useState<Record<string, VerificationFreshness>>({});
  const [expandedRisks, setExpandedRisks] = useState<string[]>([]);
  const [filter, setFilter] = useState<'active' | 'all' | 'closed'>('active');
  const [draft, setDraft] = useState<RiskDraft>({
    title: '', hazardType: 'unknown', basis: 'observed_hazard', description: '', location: '', observedAt: '', severity: 'unknown',
    likelihood: 'unknown', evidenceIds: [], refs: '', actor: '',
  });
  const recordById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const storageKey = `${RISK_STORAGE_PREFIX}${workspaceId}`;
  const writable = hydrated && !readOnly && !storageBlocked;

  useEffect(() => {
    setHydrated(false); setStorageBlocked(false); setStorageMessage(''); setStore(emptyStore(workspaceId));
    setShowRiskForm(false); setControlDraft(null); setTransitionDraft(null); setActionDraft(null); setCloseDraft(null); setStatusDraft(null);
    setRiskError(''); setControlError(''); setTransitionError(''); setActionError(''); setCloseError(''); setStatusError(''); setExpandedRisks([]); setFilter('active'); setVerificationFreshness({});
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) { setHydrated(true); return; }
      const parsed = riskRegisterStoreSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || parsed.data.workspaceId !== workspaceId || parsed.data.risks.some((risk) => risk.workspaceId !== workspaceId) || parsed.data.controls.some((control) => control.workspaceId !== workspaceId)) {
        setStorageBlocked(true);
        setStorageMessage('Saved risk-register data is malformed or belongs to another investigation. The original browser value was left untouched and automatic writes are paused. Export or preserve the original browser data before attempting repair.');
      } else {
        setStore(parsed.data);
      }
    } catch {
      setStorageBlocked(true);
      setStorageMessage('Risk-register data could not be read. Automatic writes are paused to protect the original saved value.');
    } finally { setHydrated(true); }
  }, [storageKey, workspaceId]);

  useEffect(() => {
    let active = true;
    const candidates = store.controls.filter((control) => control.status === 'effectiveness_verified' && control.verificationEvidenceRecordIds.length > 0);
    setVerificationFreshness((current) => {
      const next = { ...current };
      for (const control of candidates) next[control.id] = 'checking';
      for (const key of Object.keys(next)) if (!candidates.some((control) => control.id === key)) delete next[key];
      return next;
    });
    Promise.all(candidates.map(async (control) => {
      try {
        const fingerprint = await digestVerificationEvidence(control.verificationEvidenceRecordIds, recordById);
        return [control.id, fingerprint === control.verificationEvidenceSnapshotSha256 && Boolean(control.verificationEvidenceSnapshotSha256) ? 'current' : 'stale'] as const;
      } catch { return [control.id, 'stale'] as const; }
    })).then((results) => {
      if (!active) return;
      setVerificationFreshness((current) => {
        const next = { ...current };
        results.forEach(([id, freshness]) => { next[id] = freshness; });
        return next;
      });
    });
    return () => { active = false; };
  }, [store.controls, recordById]);

  function commit(next: RiskRegisterStore): boolean {
    if (!writable) { setStorageMessage(readOnly ? 'The investigation is read-only.' : 'Risk-register storage is not writable. No changes were saved.'); return false; }
    const parsed = riskRegisterStoreSchema.safeParse(next);
    if (!parsed.success) { setStorageMessage(`The risk-register change failed schema validation: ${parsed.error.issues[0]?.message ?? 'invalid data'}. No changes were saved.`); return false; }
    try { window.localStorage.setItem(storageKey, JSON.stringify(parsed.data)); setStore(parsed.data); setStorageMessage(''); return true; }
    catch { setStorageBlocked(true); setStorageMessage('Browser storage is full or unavailable. Changes were not saved. Export available evidence and free storage before continuing.'); return false; }
  }

  function logEvent(next: RiskRegisterStore, entityType: 'risk' | 'control', entityId: string, type: RiskRegisterStore['events'][number]['type'], actor: string, message: string, refs: string[] = []) {
    return { ...next, events: eventList(next.events, createRiskEvent({ workspaceId, entityType, entityId, type, actorLabel: safeLabel(actor), message, evidenceReferences: refs })) };
  }

  function submitRisk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setRiskError('');
    try {
      const evidenceRefs = parseRefs(draft.refs);
      const observedAt = localDateTimeToIso(draft.observedAt);
      if (draft.observedAt && !observedAt) throw new Error('Observed-at timestamp is invalid. No risk record was saved.');
      const created = createRisk({
        workspaceId, title: draft.title, hazardType: draft.hazardType, basis: draft.basis, description: draft.description, location: draft.location,
        observedAt, severity: draft.severity, likelihood: draft.likelihood,
        linkedEvidenceRecordIds: draft.evidenceIds, evidenceReferences: evidenceRefs, createdBy: safeLabel(draft.actor),
      });
      const next = logEvent({ ...store, risks: [created, ...store.risks] }, 'risk', created.id, 'risk_created', draft.actor, `Risk / hazard recorded: ${created.title}. This is a risk record, not a contamination diagnosis.`, evidenceRefs);
      if (commit(next)) {
        setShowRiskForm(false); setDraft({ title: '', hazardType: 'unknown', basis: 'observed_hazard', description: '', location: '', observedAt: '', severity: 'unknown', likelihood: 'unknown', evidenceIds: [], refs: '', actor: '' });
        setExpandedRisks((current) => [created.id, ...current]); onNotice?.('Risk / hazard recorded. Screening priority is a qualitative aid, not a validated risk score or a finding that water is contaminated.');
      }
    } catch (error) { setRiskError(error instanceof Error ? error.message : 'Could not create risk record.'); }
  }

  function submitControl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!controlDraft) return; setControlError('');
    try {
      const refs = parseRefs(controlDraft.refs);
      const control = createRiskControl({ workspaceId, riskId: controlDraft.riskId, kind: controlDraft.kind, title: controlDraft.title,
        description: controlDraft.description, owner: safeLabel(controlDraft.owner), createdBy: safeLabel(controlDraft.createdBy),
        evidenceReferences: refs, linkedEvidenceRecordIds: controlDraft.evidenceIds });
      const next = logEvent({ ...store, controls: [control, ...store.controls] }, 'control', control.id, 'control_created', controlDraft.createdBy,
        `Control recorded as ${statusLabels[control.status].toLocaleLowerCase()}: ${control.title}.`, refs);
      if (commit(next)) { setControlDraft(null); setControlError(''); setExpandedRisks((current) => [control.riskId, ...current.filter((id) => id !== control.riskId)]); onNotice?.('Control recorded. A proposed or documented control is not evidence that the risk is controlled.'); }
    } catch (error) { setControlError(error instanceof Error ? error.message : 'Could not create control.'); }
  }

  async function submitControlTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!transitionDraft) return; setTransitionError('');
    const control = store.controls.find((item) => item.id === transitionDraft.controlId);
    if (!control) { setTransitionError('This control no longer exists in the current investigation.'); return; }
    const refs = parseRefs(transitionDraft.refs);
    let verificationFingerprint: string | null = null;
    if (transitionDraft.mode === 'verify_effectiveness' && transitionDraft.evidenceIds.length > 0) {
      try { verificationFingerprint = await digestVerificationEvidence(transitionDraft.evidenceIds, recordById); }
      catch (error) { setTransitionError(error instanceof Error ? error.message : 'Could not fingerprint linked verification evidence.'); return; }
    }
    const result = transitionRiskControl(control, (() => {
      switch (transitionDraft.mode) {
        case 'mark_implemented': return { type: 'mark_implemented', actor: safeLabel(transitionDraft.actor), note: transitionDraft.note, references: refs, evidenceRecordIds: transitionDraft.evidenceIds } as const;
        case 'verify_effectiveness': return { type: 'verify_effectiveness', verifier: safeLabel(transitionDraft.actor), note: transitionDraft.note, references: refs, evidenceRecordIds: transitionDraft.evidenceIds, evidenceSnapshotSha256: verificationFingerprint } as const;
        case 'mark_ineffective': return { type: 'mark_ineffective', actor: safeLabel(transitionDraft.actor), note: transitionDraft.note, references: refs, evidenceRecordIds: transitionDraft.evidenceIds } as const;
        case 'reopen_verification': return { type: 'reopen_verification', actor: safeLabel(transitionDraft.actor), reason: transitionDraft.note } as const;
      }
    })());
    if (!result.ok) { setTransitionError(result.error); return; }
    const messageByMode = {
      mark_implemented: 'Implementation recorded; effectiveness remains unverified.', verify_effectiveness: 'Effectiveness marked verified based on the recorded review; identities are self-entered.',
      mark_ineffective: 'Control marked ineffective based on the recorded evidence.', reopen_verification: 'Control returned to implemented but unverified for another review.',
    };
    const nextControls = store.controls.map((item) => item.id === control.id ? result.control : item);
    const next = logEvent({ ...store, controls: nextControls }, 'control', control.id, 'control_status_changed', transitionDraft.actor,
      `${messageByMode[transitionDraft.mode]} ${control.title}`, [...refs, ...transitionDraft.evidenceIds]);
    if (commit(next)) { setTransitionDraft(null); setTransitionError(''); onNotice?.(messageByMode[transitionDraft.mode]); }
  }

  function createCorrectiveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!actionDraft) return; setActionError('');
    const control = store.controls.find((item) => item.id === actionDraft.controlId);
    const risk = control ? store.risks.find((item) => item.id === control.riskId) : null;
    if (!control || !risk) { setActionError('Risk/control could not be found.'); return; }
    if (!writable) { setActionError('Risk-register storage is not writable.'); return; }
    let previousActionValue: string | null = null;
    try {
      const actionKey = `${ACTION_STORAGE_PREFIX}${workspaceId}`;
      previousActionValue = window.localStorage.getItem(actionKey);
      const existing = previousActionValue ? JSON.parse(previousActionValue) : { version: 1, workspaceId, items: [] };
      const parsedExisting = actionLoopStoreSchema.safeParse(existing);
      if (!parsedExisting.success || parsedExisting.data.workspaceId !== workspaceId) throw new Error('ActionLoop storage is malformed or belongs to another investigation. No corrective action was created. Preserve the original value before attempting repair.');
      if (control.actionLoopItemId && parsedExisting.data.items.some((item) => item.id === control.actionLoopItemId)) throw new Error('This control already links to an ActionLoop item. Open ActionLoop to view it.');
      const linkedEvidence = captureActionEvidenceLinks([...new Set([...risk.linkedEvidenceRecordIds, ...control.linkedEvidenceRecordIds])], records);
      const action = createAction({
        workspaceId, title: `Corrective action: ${control.title}`,
        details: `Risk / hazard: ${risk.title}. Control: ${control.description || control.title}. Control owner: ${control.owner}. This action supports follow-up; completing it does not prove the water is safe or establish that a hazard has been eliminated.`,
        origin: { kind: 'manual', key: `risk-control:${control.id}`, label: `Risk control: ${control.title}`, detail: `Linked risk: ${risk.title}. Current control status: ${statusLabels[control.status]}.`, sourceReportFingerprint: null, evidenceRecordIds: linkedEvidence.map((link) => link.recordId) },
        owner: safeLabel(actionDraft.owner), dueDate: actionDraft.dueDate || null, priority: actionDraft.priority, createdBy: safeLabel(actionDraft.createdBy), linkedEvidence,
      });
      if (parsedExisting.data.items.some((item) => item.id === action.id)) throw new Error('Action ID collision detected; retry the operation.');
      const nextActions = actionLoopStoreSchema.parse({ ...parsedExisting.data, items: [action, ...parsedExisting.data.items] });
      window.localStorage.setItem(actionKey, JSON.stringify(nextActions));
      const linkedControl = { ...control, actionLoopItemId: action.id, updatedAt: new Date().toISOString() };
      const next = logEvent({ ...store, controls: store.controls.map((item) => item.id === control.id ? linkedControl : item) }, 'control', control.id,
        'action_linked', actionDraft.createdBy, `Linked ActionLoop item ${action.id} to control: ${control.title}.`);
      if (!commit(next)) {
        if (previousActionValue === null) window.localStorage.removeItem(actionKey); else window.localStorage.setItem(actionKey, previousActionValue);
        throw new Error('Could not save the risk-control link. The new ActionLoop item was rolled back.');
      }
      window.dispatchEvent(new CustomEvent('waterchain:action-loop-updated', { detail: { workspaceId } }));
      setActionDraft(null); onNotice?.(`Corrective ActionLoop item created and linked to “${control.title}”. Its completion will not automatically mark this control effective.`);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not create corrective action.'); }
  }

  function startControlTransition(control: RiskControl, mode: ControlTransitionInput['type']) {
    setTransitionDraft({ controlId: control.id, mode, actor: '', note: '', refs: '', evidenceIds: [] }); setTransitionError('');
  }

  function closeRiskReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!closeDraft) return; setCloseError('');
    const risk = store.risks.find((item) => item.id === closeDraft.riskId);
    if (!risk) { setCloseError('Risk record could not be found.'); return; }
    const relatedControls = store.controls.filter((control) => control.riskId === risk.id);
    const hasCurrentVerifiedControl = relatedControls.some((control) => {
      if (control.status !== 'effectiveness_verified') return false;
      if (control.verificationEvidenceRecordIds.length === 0) return control.verificationEvidenceReferences.length > 0;
      return verificationFreshness[control.id] === 'current';
    });
    if (!hasCurrentVerifiedControl) {
      setCloseError('At least one linked control must have a current, evidence-backed effectiveness review before closing this administrative review. If linked evidence changed or is missing, reopen and review the control again. This still does not prove the water is safe.'); return;
    }
    const refs = parseRefs(closeDraft.refs);
    if (!closeDraft.note.trim() || refs.length === 0) { setCloseError('A closure note and at least one traceable closure reference are required.'); return; }
    if (!closeDraft.actor.trim()) { setCloseError('Reviewer name is required.'); return; }
    const updated: RiskRecord = { ...risk, status: 'review_closed', closureNote: closeDraft.note.trim(), closedBy: safeLabel(closeDraft.actor), closureEvidenceReferences: refs, updatedAt: new Date().toISOString() };
    const next = logEvent({ ...store, risks: store.risks.map((item) => item.id === risk.id ? updated : item) }, 'risk', risk.id, 'risk_status_changed', closeDraft.actor,
      `Risk review administratively closed. This does not mean the hazard is eliminated or the water is safe.`, refs);
    if (commit(next)) { setCloseDraft(null); onNotice?.('Risk review record closed with a documented basis. The underlying hazard is not automatically considered eliminated.'); }
  }

  function updateRiskStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!statusDraft) return; setStatusError('');
    if (!writable) { setStatusError('Risk-register storage is not writable.'); return; }
    const risk = store.risks.find((item) => item.id === statusDraft.riskId);
    if (!risk) { setStatusError('Risk record could not be found.'); return; }
    if (!statusDraft.actor.trim() || !statusDraft.reason.trim()) { setStatusError('Recorded-by name and a reason are required.'); return; }
    const updated = { ...risk, status: statusDraft.target, closureNote: null, closedBy: null, closureEvidenceReferences: [], updatedAt: new Date().toISOString() };
    const next = logEvent({ ...store, risks: store.risks.map((item) => item.id === risk.id ? updated : item) }, 'risk', risk.id, 'risk_status_changed', statusDraft.actor,
      `Risk review status changed from ${riskStatusLabels[risk.status]} to ${riskStatusLabels[statusDraft.target]}: ${statusDraft.reason.trim()}.`, risk.closureEvidenceReferences);
    if (commit(next)) { setStatusDraft(null); setStatusError(''); onNotice?.(`Risk review moved to ${riskStatusLabels[statusDraft.target].toLocaleLowerCase()}. This is an administrative status, not a water-safety verdict.`); }
  }

  function exportRegister() {
    const payload = { schema: 'waterchain-risk-register-export-v1', exportedAt: new Date().toISOString(), workspaceId, workspaceName,
      storageScope: 'browser-local', actorIdentity: 'self-entered; not authenticated', riskRegister: store,
      limitation: 'This export is not signed or authenticated. Screening priority is not a validated health-risk score. Control verification is self-entered and does not certify water safety.' };
    downloadJson(`waterchain-risk-register-${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'investigation'}.json`, JSON.stringify(payload, null, 2));
  }

  const controlsByRisk = useMemo(() => {
    const map = new Map<string, RiskControl[]>();
    store.controls.forEach((control) => map.set(control.riskId, [...(map.get(control.riskId) ?? []), control]));
    return map;
  }, [store.controls]);
  const activeRisks = store.risks.filter((risk) => risk.status !== 'review_closed');
  const highPriority = activeRisks.filter((risk) => ['high', 'moderate'].includes(screeningPriority(risk.severity, risk.likelihood)) && screeningPriority(risk.severity, risk.likelihood) !== 'low').length;
  const staleVerifiedCount = store.controls.filter((control) => control.status === 'effectiveness_verified' && control.verificationEvidenceRecordIds.length > 0 && verificationFreshness[control.id] !== 'current').length;
  const controlsToReview = store.controls.filter((control) => ['implemented_unverified', 'ineffective', 'unknown'].includes(control.status)).length + staleVerifiedCount;
  const currentVerifiedCount = store.controls.filter((control) => control.status === 'effectiveness_verified' && (control.verificationEvidenceRecordIds.length === 0 ? control.verificationEvidenceReferences.length > 0 : verificationFreshness[control.id] === 'current')).length;
  const visibleRisks = store.risks.filter((risk) => filter === 'all' || (filter === 'active' ? risk.status !== 'review_closed' : risk.status === 'review_closed'))
    .sort((a, b) => ({ high: 0, moderate: 1, low: 2, not_assessed: 3 }[screeningPriority(a.severity, a.likelihood)] - { high: 0, moderate: 1, low: 2, not_assessed: 3 }[screeningPriority(b.severity, b.likelihood)]) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <section className="panel risk-register-panel" id="risk-control-register" aria-labelledby="risk-register-title">
      <div className="panel-header risk-register-header">
        <div><div className="panel-kicker">06 / RISK &amp; CONTROL MANAGEMENT</div><h2 id="risk-register-title">Risk &amp; control register</h2><p>Connect observed hazards to documented controls, corrective actions, and review evidence.</p></div>
        <div className="risk-header-actions"><button className="secondary-button" onClick={exportRegister} disabled={!hydrated || storageBlocked}><Download size={14}/> Export register</button><button className="primary-button" onClick={() => { setShowRiskForm((value) => !value); setRiskError(''); }} disabled={!writable}><Plus size={15}/> Record risk / hazard</button></div>
      </div>
      <div className="risk-disclaimer"><ShieldAlert size={15}/><p><strong>Interpretation boundary:</strong> this register records hazards, controls and follow-up. It does not diagnose contamination, certify control effectiveness, or replace a formal water safety plan. Screening priority is a transparent qualitative aid, not a validated risk score. All names are self-entered in this browser.</p></div>
      {storageMessage && <div className="risk-storage-warning" role="alert"><AlertCircle size={15}/><span>{storageMessage}</span></div>}
      <div className="risk-metrics">
        <div><span>ACTIVE RISKS</span><strong>{activeRisks.length}</strong><small>Open or under monitoring</small></div>
        <div><span>SCREENING PRIORITY</span><strong>{highPriority}</strong><small>Moderate / high / critical grouping</small></div>
        <div><span>CONTROLS TO REVIEW</span><strong>{controlsToReview}</strong><small>Implemented, ineffective or unknown</small></div>
        <div><span>VERIFIED CONTROLS</span><strong>{currentVerifiedCount}</strong><small>Current evidence snapshot matches</small></div>
      </div>

      {showRiskForm && <form className="risk-editor" onSubmit={submitRisk} noValidate>
        <div className="risk-editor-heading"><div><span className="panel-kicker">NEW REGISTER ENTRY</span><h3>Record a hazard or risk observation</h3></div><button type="button" className="small-icon-button" aria-label="Close risk form" onClick={() => { setShowRiskForm(false); setRiskError(''); }}><X size={16}/></button></div>
        <div className="risk-form-grid">
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-title">Title <span className="required-mark">*</span></label><input id="risk-title" className="text-input" maxLength={240} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Source protection barrier damaged"/></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-type">Hazard category</label><select id="risk-type" className="form-select" value={draft.hazardType} onChange={(event) => setDraft({ ...draft, hazardType: event.target.value as HazardType })}>{Object.entries(hazardTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-basis">Observation basis</label><select id="risk-basis" className="form-select" value={draft.basis} onChange={(event) => setDraft({ ...draft, basis: event.target.value as HazardBasis })}>{Object.entries(basisLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-severity">Potential consequence severity</label><select id="risk-severity" className="form-select" value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as HazardSeverity })}><option value="unknown">Unknown / not assessed</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option><option value="critical">Critical</option></select></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-likelihood">Likelihood judgement</label><select id="risk-likelihood" className="form-select" value={draft.likelihood} onChange={(event) => setDraft({ ...draft, likelihood: event.target.value as HazardLikelihood })}><option value="unknown">Unknown / not assessed</option><option value="unlikely">Unlikely</option><option value="possible">Possible</option><option value="likely">Likely</option></select></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-location">Location / entity</label><input id="risk-location" className="text-input" maxLength={500} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Source, container, household, site"/></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-observed-at">Observed at</label><input id="risk-observed-at" type="datetime-local" className="text-input" value={draft.observedAt} onChange={(event) => setDraft({ ...draft, observedAt: event.target.value })}/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-description">Description / observation <span className="required-mark">*</span></label><textarea id="risk-description" className="text-input risk-textarea" maxLength={4000} required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Describe what was observed and what remains uncertain. Do not state a suspected hazard as a confirmed contamination result."/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-evidence">Link evidence records</label><select id="risk-evidence" className="form-select risk-multiselect" multiple value={draft.evidenceIds} onChange={(event) => setDraft({ ...draft, evidenceIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>{records.map((record) => <option key={record.id} value={record.id}>{record.recordCode} · {record.sampleCode} · {record.stage}</option>)}</select><small>Select related records if they support this observation.</small></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-refs">External references (one per line)</label><textarea id="risk-refs" className="text-input risk-textarea" value={draft.refs} onChange={(event) => setDraft({ ...draft, refs: event.target.value })} placeholder="Inspection ID, report reference, source document ID"/><small>References are user-entered; WaterChain does not authenticate their source.</small></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-created-by">Recorded by <span className="required-mark">*</span></label><input id="risk-created-by" className="text-input" maxLength={120} required value={draft.actor} onChange={(event) => setDraft({ ...draft, actor: event.target.value })} placeholder="Self-entered name"/></div>
        </div>
        {riskError && <p className="risk-form-error" role="alert"><AlertCircle size={14}/>{riskError}</p>}
        <div className="risk-form-footer"><span>New entries start open. No risk is auto-created from a diagnosis.</span><div><button type="button" className="secondary-button" onClick={() => { setShowRiskForm(false); setRiskError(''); }}>Cancel</button><button type="submit" className="primary-button" disabled={!writable}><Plus size={14}/> Save risk record</button></div></div>
      </form>}

      {controlDraft && <form className="risk-editor risk-control-editor" onSubmit={submitControl} noValidate>
        <div className="risk-editor-heading"><div><span className="panel-kicker">CONTROL PLAN</span><h3>Add a control to {store.risks.find((risk) => risk.id === controlDraft.riskId)?.title ?? 'risk'}</h3></div><button type="button" className="small-icon-button" aria-label="Close control form" onClick={() => { setControlDraft(null); setControlError(''); }}><X size={16}/></button></div>
        <div className="risk-form-grid">
          <div className="risk-field"><label className="field-label" htmlFor="control-kind">Control type</label><select id="control-kind" className="form-select" value={controlDraft.kind} onChange={(event) => setControlDraft({ ...controlDraft, kind: event.target.value as ControlKind })}>{Object.entries(controlKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="risk-field"><label className="field-label" htmlFor="control-owner">Accountable owner <span className="required-mark">*</span></label><input id="control-owner" className="text-input" maxLength={120} required value={controlDraft.owner} onChange={(event) => setControlDraft({ ...controlDraft, owner: event.target.value })} placeholder="Person responsible"/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="control-title">Control title <span className="required-mark">*</span></label><input id="control-title" className="text-input" maxLength={240} required value={controlDraft.title} onChange={(event) => setControlDraft({ ...controlDraft, title: event.target.value })} placeholder="e.g. Repair and inspect source cover"/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="control-description">What the control is intended to do</label><textarea id="control-description" className="text-input risk-textarea" maxLength={4000} value={controlDraft.description} onChange={(event) => setControlDraft({ ...controlDraft, description: event.target.value })}/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="control-refs">Existing control references (optional)</label><textarea id="control-refs" className="text-input risk-textarea" value={controlDraft.refs} onChange={(event) => setControlDraft({ ...controlDraft, refs: event.target.value })} placeholder="Procedure ID, maintenance log, inspection record"/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="control-evidence">Link evidence records (optional)</label><select id="control-evidence" className="form-select risk-multiselect" multiple value={controlDraft.evidenceIds} onChange={(event) => setControlDraft({ ...controlDraft, evidenceIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>{records.map((record) => <option key={record.id} value={record.id}>{record.recordCode} · {record.sampleCode} · {record.stage}</option>)}</select></div>
          <div className="risk-field"><label className="field-label" htmlFor="control-created-by">Recorded by <span className="required-mark">*</span></label><input id="control-created-by" className="text-input" maxLength={120} required value={controlDraft.createdBy} onChange={(event) => setControlDraft({ ...controlDraft, createdBy: event.target.value })} placeholder="Self-entered name"/></div>
        </div>
        {controlError && <p className="risk-form-error" role="alert"><AlertCircle size={14}/>{controlError}</p>}
        <div className="risk-form-footer"><span>Controls with no references start Proposed, not verified.</span><div><button type="button" className="secondary-button" onClick={() => { setControlDraft(null); setControlError(''); }}>Cancel</button><button type="submit" className="primary-button" disabled={!writable}><Plus size={14}/> Save control</button></div></div>
      </form>}

      {transitionDraft && <form className="risk-editor risk-control-editor" onSubmit={submitControlTransition} noValidate>
        <div className="risk-editor-heading"><div><span className="panel-kicker">CONTROL REVIEW</span><h3>{transitionDraft.mode === 'mark_implemented' ? 'Record implementation' : transitionDraft.mode === 'verify_effectiveness' ? 'Review effectiveness' : transitionDraft.mode === 'mark_ineffective' ? 'Record ineffective control' : 'Reopen control review'}</h3></div><button type="button" className="small-icon-button" aria-label="Close control review form" onClick={() => { setTransitionDraft(null); setTransitionError(''); }}><X size={16}/></button></div>
        <div className="risk-form-grid">
          <div className="risk-field"><label className="field-label" htmlFor="risk-control-actor">{transitionDraft.mode === 'verify_effectiveness' ? 'Reviewer' : 'Recorded by'} <span className="required-mark">*</span></label><input id="risk-control-actor" className="text-input" maxLength={120} required value={transitionDraft.actor} onChange={(event) => setTransitionDraft({ ...transitionDraft, actor: event.target.value })} placeholder="Self-entered name"/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-control-note">{transitionDraft.mode === 'reopen_verification' ? 'Reason' : 'Outcome / verification note'} <span className="required-mark">*</span></label><textarea id="risk-control-note" className="text-input risk-textarea" required maxLength={4000} value={transitionDraft.note} onChange={(event) => setTransitionDraft({ ...transitionDraft, note: event.target.value })} placeholder="State what was checked, what evidence supports it, and any limitations."/></div>
          {transitionDraft.mode !== 'reopen_verification' && <>
            <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-control-evidence">Link evidence records</label><select id="risk-control-evidence" className="form-select risk-multiselect" multiple value={transitionDraft.evidenceIds} onChange={(event) => setTransitionDraft({ ...transitionDraft, evidenceIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>{records.map((record) => <option key={record.id} value={record.id}>{record.recordCode} · {record.sampleCode} · {record.stage}</option>)}</select></div>
            <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-control-refs">Traceable references <span className="required-mark">*</span></label><textarea id="risk-control-refs" className="text-input risk-textarea" value={transitionDraft.refs} onChange={(event) => setTransitionDraft({ ...transitionDraft, refs: event.target.value })} placeholder="One inspection, maintenance, or verification reference per line"/></div>
          </>}
        </div>
        {transitionDraft.mode === 'verify_effectiveness' && <p className="risk-review-note"><ShieldAlert size={14}/> Verifier must differ from the control owner. Names are self-entered and are not authenticated; this does not certify water safety.</p>}
        {transitionError && <p className="risk-form-error" role="alert"><AlertCircle size={14}/>{transitionError}</p>}
        <div className="risk-form-footer"><span>Effectiveness can only be verified after an implementation record.</span><div><button type="button" className="secondary-button" onClick={() => { setTransitionDraft(null); setTransitionError(''); }}>Cancel</button><button type="submit" className="primary-button">Record review</button></div></div>
      </form>}

      {actionDraft && <form className="risk-editor risk-control-editor" onSubmit={createCorrectiveAction} noValidate>
        <div className="risk-editor-heading"><div><span className="panel-kicker">ACTIONLOOP INTEGRATION</span><h3>Create corrective follow-up</h3></div><button type="button" className="small-icon-button" aria-label="Close action form" onClick={() => { setActionDraft(null); setActionError(''); }}><X size={16}/></button></div>
        <div className="risk-form-grid">
          <div className="risk-field"><label className="field-label" htmlFor="risk-action-owner">Action owner <span className="required-mark">*</span></label><input id="risk-action-owner" className="text-input" maxLength={120} required value={actionDraft.owner} onChange={(event) => setActionDraft({ ...actionDraft, owner: event.target.value })}/></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-action-created-by">Created by <span className="required-mark">*</span></label><input id="risk-action-created-by" className="text-input" maxLength={120} required value={actionDraft.createdBy} onChange={(event) => setActionDraft({ ...actionDraft, createdBy: event.target.value })}/></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-action-due">Due date</label><input id="risk-action-due" className="text-input" type="date" value={actionDraft.dueDate} onChange={(event) => setActionDraft({ ...actionDraft, dueDate: event.target.value })}/></div>
          <div className="risk-field"><label className="field-label" htmlFor="risk-action-priority">Priority</label><select id="risk-action-priority" className="form-select" value={actionDraft.priority} onChange={(event) => setActionDraft({ ...actionDraft, priority: event.target.value as ActionPriority })}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
        </div>
        {actionError && <p className="risk-form-error" role="alert"><AlertCircle size={14}/>{actionError}</p>}
        <div className="risk-form-footer"><span>The corrective action will appear in ActionLoop and link back to this control.</span><div><button type="button" className="secondary-button" onClick={() => { setActionDraft(null); setActionError(''); }}>Cancel</button><button type="submit" className="primary-button"><ClipboardList size={14}/> Create linked action</button></div></div>
      </form>}

      {statusDraft && <form className="risk-editor risk-control-editor" onSubmit={updateRiskStatus} noValidate>
        <div className="risk-editor-heading"><div><span className="panel-kicker">RISK REVIEW STATUS</span><h3>Move review to {riskStatusLabels[statusDraft.target]}</h3></div><button type="button" className="small-icon-button" aria-label="Close status change form" onClick={() => { setStatusDraft(null); setStatusError(''); }}><X size={16}/></button></div>
        <div className="risk-form-grid">
          <div className="risk-field"><label className="field-label" htmlFor="risk-status-actor">Recorded by <span className="required-mark">*</span></label><input id="risk-status-actor" className="text-input" maxLength={120} required value={statusDraft.actor} onChange={(event) => setStatusDraft({ ...statusDraft, actor: event.target.value })} placeholder="Self-entered name"/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-status-reason">Reason for status change <span className="required-mark">*</span></label><textarea id="risk-status-reason" className="text-input risk-textarea" required maxLength={2000} value={statusDraft.reason} onChange={(event) => setStatusDraft({ ...statusDraft, reason: event.target.value })} placeholder="Explain why the review is moving to this status."/></div>
        </div>
        {statusError && <p className="risk-form-error" role="alert"><AlertCircle size={14}/>{statusError}</p>}
        <div className="risk-form-footer"><span>This is an administrative review status, not a statement that the water is safe.</span><div><button type="button" className="secondary-button" onClick={() => { setStatusDraft(null); setStatusError(''); }}>Cancel</button><button type="submit" className="primary-button">Record status change</button></div></div>
      </form>}

      {closeDraft && <form className="risk-editor risk-control-editor" onSubmit={closeRiskReview} noValidate>
        <div className="risk-editor-heading"><div><span className="panel-kicker">ADMINISTRATIVE CLOSURE</span><h3>Close this risk review record?</h3></div><button type="button" className="small-icon-button" aria-label="Close review form" onClick={() => { setCloseDraft(null); setCloseError(''); }}><X size={16}/></button></div>
        <p className="risk-review-note"><ShieldAlert size={14}/> This closes the review record only. It does not certify that the hazard has been eliminated or that water is safe.</p>
        <div className="risk-form-grid">
          <div className="risk-field"><label className="field-label" htmlFor="risk-closure-reviewer">Reviewer <span className="required-mark">*</span></label><input id="risk-closure-reviewer" className="text-input" maxLength={120} required value={closeDraft.actor} onChange={(event) => setCloseDraft({ ...closeDraft, actor: event.target.value })}/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-closure-note">Closure note <span className="required-mark">*</span></label><textarea id="risk-closure-note" className="text-input risk-textarea" required value={closeDraft.note} onChange={(event) => setCloseDraft({ ...closeDraft, note: event.target.value })}/></div>
          <div className="risk-field risk-field-wide"><label className="field-label" htmlFor="risk-closure-refs">Closure evidence reference <span className="required-mark">*</span></label><textarea id="risk-closure-refs" className="text-input risk-textarea" required value={closeDraft.refs} onChange={(event) => setCloseDraft({ ...closeDraft, refs: event.target.value })} placeholder="One reference per line"/></div>
        </div>
        {closeError && <p className="risk-form-error" role="alert"><AlertCircle size={14}/>{closeError}</p>}
        <div className="risk-form-footer"><span>A linked control must have an effectiveness review recorded first.</span><div><button type="button" className="secondary-button" onClick={() => { setCloseDraft(null); setCloseError(''); }}>Cancel</button><button type="submit" className="primary-button">Close review record</button></div></div>
      </form>}

      <div className="risk-list-header"><div><h3>Registered risks &amp; controls</h3><p>Use observations and local procedures. Do not treat this register as a certified water safety plan.</p></div><label className="risk-filter-label">Show <select className="form-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="active">Active</option><option value="all">All reviews</option><option value="closed">Review closed</option></select></label></div>
      {!hydrated ? <div className="risk-empty"><p>Loading risk register…</p></div> : visibleRisks.length === 0 ? <div className="risk-empty"><div className="risk-empty-icon"><ShieldCheck size={22}/></div><strong>No risk records in this investigation</strong><p>Record a hazard or risk observation when you have a real inspection, field observation, lab finding, or process deviation to document. Nothing is seeded automatically.</p><button type="button" className="secondary-button" disabled={!writable} onClick={() => setShowRiskForm(true)}><Plus size={14}/> Record first risk</button></div> : <div className="risk-card-list">
        {visibleRisks.map((risk) => {
          const controls = controlsByRisk.get(risk.id) ?? [];
          const linkedRecords = risk.linkedEvidenceRecordIds.map((id) => recordById.get(id)).filter((record): record is EvidenceRecord => Boolean(record));
          const missingRecordCount = risk.linkedEvidenceRecordIds.length - linkedRecords.length;
          const priority = screeningPriority(risk.severity, risk.likelihood);
          const expanded = expandedRisks.includes(risk.id);
          return <article className={`risk-item-card risk-status-${risk.status}`} key={risk.id}>
            <div className="risk-item-main">
              <div className="risk-item-top"><span className={`risk-state-chip risk-state-${risk.status}`}>{riskStatusLabels[risk.status]}</span><span className="risk-type-chip">{hazardTypeLabels[risk.hazardType]}</span><span className={priorityClass(priority)}>Screening priority: {priority.replace('_', ' ')}</span><span className="risk-updated">Updated {new Date(risk.updatedAt).toLocaleString()}</span></div>
              <h4>{risk.title}</h4>
              {risk.description && <p className="risk-item-description">{risk.description}</p>}
              <div className="risk-item-metadata"><span>Basis <strong>{basisLabels[risk.basis]}</strong></span><span>Severity <strong>{risk.severity}</strong></span><span>Likelihood <strong>{risk.likelihood}</strong></span>{risk.location && <span>Location <strong>{risk.location}</strong></span>}{risk.observedAt && <span>Observed <strong>{new Date(risk.observedAt).toLocaleString()}</strong></span>}</div>
              <div className="risk-item-counts"><span><ClipboardList size={13}/>{controls.length} control{controls.length === 1 ? '' : 's'}</span><span><Link2 size={13}/>{linkedRecords.length} linked record{linkedRecords.length === 1 ? '' : 's'}{missingRecordCount > 0 ? ` · ${missingRecordCount} missing from register` : ''}</span><span><FileCheck2 size={13}/>{risk.evidenceReferences.length} external reference{risk.evidenceReferences.length === 1 ? '' : 's'}</span></div>
              {risk.evidenceReferences.length > 0 && <div className="risk-evidence-refs"><strong>Observation references</strong><span>{risk.evidenceReferences.join(' · ')}</span></div>}
              {linkedRecords.length > 0 && <div className="risk-linked-records"><strong>Linked evidence</strong>{linkedRecords.map((record) => <span key={record.id}>{record.recordCode} · {record.sampleCode} · {record.stage}</span>)}</div>}
              {risk.linkedEvidenceRecordIds.length > 0 && missingRecordCount > 0 && <p className="risk-missing-links" role="status">Some linked evidence IDs are no longer present in the current register. The links are retained for audit; they were not silently deleted.</p>}
              <p className="risk-priority-note">Qualitative screening matrix only. Not a calculated exposure, probability, legal classification, or validated health-risk score.</p>
              {risk.status === 'review_closed' && <div className="risk-closure-note"><strong>Review closure note by {risk.closedBy}</strong><p>{risk.closureNote}</p><span>References: {risk.closureEvidenceReferences.join(' · ')}</span><p>This administrative closure does not mean the hazard has been eliminated or that the water is safe.</p></div>}
            </div>
            <div className="risk-item-controls">
              <button type="button" className="secondary-button" disabled={!writable || risk.status === 'review_closed'} onClick={() => { setControlDraft({ riskId: risk.id, kind: 'preventive', title: '', description: '', owner: '', createdBy: '', evidenceIds: [], refs: '' }); setControlError(''); }}><Plus size={13}/> Add control</button>
              {risk.status === 'open' && <button type="button" className="quiet-button" disabled={!writable} onClick={() => { setStatusDraft({ riskId: risk.id, target: 'monitoring', actor: '', reason: '' }); setStatusError(''); }}>Move to monitoring</button>}
              {risk.status === 'monitoring' && <button type="button" className="quiet-button" disabled={!writable} onClick={() => { setStatusDraft({ riskId: risk.id, target: 'open', actor: '', reason: '' }); setStatusError(''); }}>Reopen monitoring</button>}
              {risk.status !== 'review_closed' && <button type="button" className="quiet-button" disabled={!writable} onClick={() => { setCloseDraft({ riskId: risk.id, actor: '', note: '', refs: '' }); setCloseError(''); }}>Close review record…</button>}
              {risk.status === 'review_closed' && <button type="button" className="quiet-button" disabled={!writable} onClick={() => { setStatusDraft({ riskId: risk.id, target: 'open', actor: '', reason: '' }); setStatusError(''); }}>Reopen risk review</button>}
              <button type="button" className="quiet-button" aria-expanded={expanded} onClick={() => setExpandedRisks((current) => expanded ? current.filter((id) => id !== risk.id) : [...current, risk.id])}><ChevronDown size={14}/> {expanded ? 'Hide details' : 'Controls & history'}</button>
            </div>
            {expanded && <div className="risk-details">
              <div className="risk-controls-heading"><div><h5>Controls and follow-up</h5><p>Presence or implementation of a control does not show that it is effective.</p></div></div>
              {controls.length === 0 ? <div className="risk-empty compact"><strong>No controls recorded</strong><p>Add a preventive, monitoring, mitigation, or corrective control with an accountable owner.</p></div> : <div className="risk-control-list">{controls.map((control) => {
                const linkedControlRecords = control.linkedEvidenceRecordIds.map((id) => recordById.get(id)).filter((record): record is EvidenceRecord => Boolean(record));
                const linkedEvidenceIdsMissing = control.linkedEvidenceRecordIds.length - linkedControlRecords.length;
                const verificationState = control.status === 'effectiveness_verified' && control.verificationEvidenceRecordIds.length > 0 ? (verificationFreshness[control.id] ?? 'checking') : null;
                const displayControlStatus = verificationState === 'stale' ? 'Verification stale · linked evidence changed' : verificationState === 'checking' ? 'Checking verification evidence…' : control.status === 'effectiveness_verified' && control.verificationEvidenceRecordIds.length === 0 ? 'Effectiveness review recorded · external reference' : statusLabels[control.status];
                const displayControlClass = verificationState === 'stale' ? 'risk-control-status risk-control-status-ineffective' : verificationState === 'checking' ? 'risk-control-status risk-control-status-unknown' : controlClass(control.status);
                return <article className="risk-control-card" key={control.id}>
                  <div className="risk-control-top"><span className={displayControlClass}>{displayControlStatus}</span><span className="risk-type-chip">{controlKindLabels[control.kind]}</span><span className="risk-control-owner">Owner: <strong>{control.owner}</strong></span></div>
                  <h6>{control.title}</h6>{control.description && <p>{control.description}</p>}
                  <div className="risk-control-evidence"><strong>Evidence / reference basis</strong>{control.evidenceReferences.length || linkedControlRecords.length ? <span>{[...control.evidenceReferences, ...linkedControlRecords.map((record) => `${record.recordCode} (${record.sampleCode})`)].join(' · ')}</span> : <span className="muted">No reference attached yet. This control remains proposed.</span>}</div>
                  {linkedEvidenceIdsMissing > 0 && <p className="risk-missing-links">{linkedEvidenceIdsMissing} linked record ID(s) no longer exist in the register.</p>}
                  {control.implementationNote && <div className="risk-control-note"><strong>Implementation note · {control.implementedBy}</strong><p>{control.implementationNote}</p></div>}
                  {control.verificationNote && <div className={`risk-control-note ${verificationState === 'stale' ? 'risk-control-note-ineffective' : 'risk-control-note-verified'}`}><strong>Effectiveness review · {control.verifiedBy} · {control.verifiedAt ? new Date(control.verifiedAt).toLocaleString() : 'time not recorded'}</strong><p>{control.verificationNote}</p><span>Verification references: {[...control.verificationEvidenceReferences, ...control.verificationEvidenceRecordIds.map((id) => recordById.get(id)?.recordCode ?? `missing record ${id}`)].join(' · ')}</span>{verificationState === 'stale' && <p>One or more linked evidence records are missing or have changed since this review. Reopen and repeat the effectiveness review before using it to close a risk review.</p>}{verificationState === 'checking' && <p>Checking that linked evidence still matches the saved review snapshot.</p>}</div>}
                  {control.ineffectiveNote && <div className="risk-control-note risk-control-note-ineffective"><strong>Ineffective control note</strong><p>{control.ineffectiveNote}</p></div>}
                  {control.actionLoopItemId && <p className="risk-linked-action"><ClipboardCheck size={13}/> Linked ActionLoop item <code>{control.actionLoopItemId}</code>. See the ActionLoop section for its status and history.</p>}
                  <div className="risk-control-actions">
                    {(control.status === 'proposed' || control.status === 'documented' || control.status === 'ineffective' || control.status === 'unknown') && <button type="button" className="secondary-button" disabled={!writable} onClick={() => startControlTransition(control, 'mark_implemented')}>Record implementation</button>}
                    {control.status === 'implemented_unverified' && <button type="button" className="primary-button" disabled={!writable} onClick={() => startControlTransition(control, 'verify_effectiveness')}><ShieldCheck size={13}/> Verify effectiveness</button>}
                    {['implemented_unverified', 'effectiveness_verified'].includes(control.status) && <button type="button" className="quiet-button" disabled={!writable} onClick={() => startControlTransition(control, 'mark_ineffective')}>Mark ineffective</button>}
                    {(control.status === 'effectiveness_verified' || control.status === 'ineffective') && <button type="button" className="quiet-button" disabled={!writable} onClick={() => startControlTransition(control, 'reopen_verification')}><RotateCcw size={13}/> Reopen control review</button>}
                    {!control.actionLoopItemId && <button type="button" className="secondary-button" disabled={!writable} onClick={() => { setActionDraft({ controlId: control.id, owner: control.owner, createdBy: '', dueDate: '', priority: priority === 'high' ? 'high' : 'medium' }); setActionError(''); }}><ClipboardList size={13}/> Create corrective ActionLoop task</button>}
                    {control.actionLoopItemId && <span className="risk-action-linked-chip"><CheckCircle2 size={12}/> Action linked</span>}
                  </div>
                </article>;
              })}</div>}
              <details className="risk-event-history"><summary><CalendarClock size={13}/> Register history ({store.events.filter((event) => event.entityId === risk.id || controls.some((control) => control.id === event.entityId)).length}) <ChevronDown size={13}/></summary>
                <div className="risk-event-list">{store.events.filter((event) => event.entityId === risk.id || controls.some((control) => control.id === event.entityId)).slice().reverse().map((event) => <div className="risk-event-row" key={event.id}><time>{new Date(event.occurredAt).toLocaleString()}</time><div><strong>{event.type.replaceAll('_', ' ')}</strong><p>{event.message}</p><small>Recorded by {event.actorLabel} · self-entered</small>{event.evidenceReferences.length > 0 && <small>References: {event.evidenceReferences.join(' · ')}</small>}</div></div>)}</div>
              </details>
            </div>}
          </article>;
        })}</div>}
      <div className="risk-register-footer"><TriangleAlert size={14}/><p>WaterChain records observed hazards, reported controls and review notes. A control labelled “effectiveness verified” means a named user recorded a review with references; it is not an independent certification, proof of hazard removal, or a statement that water is safe.</p></div>
    </section>
  );
}
