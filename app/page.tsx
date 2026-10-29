'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ArrowRight, Beaker, CalendarClock, CheckCircle2, ClipboardCheck,
  ChevronDown, CircleHelp, ClipboardList, Database, FileCheck2, FlaskConical,
  GitBranch, Info, Layers3, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  SlidersHorizontal, Upload, Waves, Workflow, X, ShieldAlert,
} from 'lucide-react';
import EvidenceRegister from '@/components/evidence/EvidenceRegister';
import DiagnosticWorkbench from '@/components/diagnostics/DiagnosticWorkbench';
import ActionLoop from '@/components/actions/ActionLoop';
import RiskControlRegister from '@/components/risks/RiskControlRegister';
import BrandMark from '@/components/BrandMark';
import WaterJourneyWorkbench from '@/components/journey/WaterJourneyWorkbench';
import TemporalEvidenceWorkbench from '@/components/temporal/TemporalEvidenceWorkbench';
import IndependentReviewWorkbench from '@/components/validation/IndependentReviewWorkbench';
import { type SelectedJourneyModel } from '@/lib/investigation-model';
import { evidenceRecordSchema, resultLabels, reviewEvidence, type EvidenceRecord } from '@/lib/evidence';
import { type DiagnosticReport } from '@/lib/diagnostics';

type Stage = { id: string; title: string; subtitle: string; icon: typeof Waves };
const stages: Stage[] = [
  { id: '01', title: 'Source', subtitle: 'Water origin', icon: Waves },
  { id: '02', title: 'Collection', subtitle: 'Container & transfer', icon: Beaker },
  { id: '03', title: 'Storage', subtitle: 'Household holding', icon: Database },
  { id: '04', title: 'Serving', subtitle: 'Point of consumption', icon: FlaskConical },
];

type InvestigationWorkspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  records: EvidenceRecord[];
};

type WorkspaceStore = { version: 1; activeWorkspaceId: string | null; workspaces: InvestigationWorkspace[] };
type RestoreCandidate = { name: string; exportedAt: string; records: EvidenceRecord[] };
const WORKSPACE_STORAGE_KEY = 'waterchain:workspaces:v1';
const LEGACY_EVIDENCE_STORAGE_KEY = 'waterchain:evidence:v1';

function isWorkspace(value: unknown): value is InvestigationWorkspace {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<InvestigationWorkspace>;
  return typeof candidate.id === 'string' && candidate.id.length > 0
    && typeof candidate.name === 'string' && candidate.name.trim().length > 0
    && typeof candidate.createdAt === 'string' && typeof candidate.updatedAt === 'string'
    && Array.isArray(candidate.records);
}

export default function Home() {
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [caseName, setCaseName] = useState('');
  const [caseNameError, setCaseNameError] = useState('');
  const [restoreCandidate, setRestoreCandidate] = useState<RestoreCandidate | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [workspaces, setWorkspaces] = useState<InvestigationWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [storageWritable, setStorageWritable] = useState(true);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [engineReport, setEngineReport] = useState<DiagnosticReport | null>(null);
  const [engineReportStale, setEngineReportStale] = useState(false);
  const [selectedJourneyModel, setSelectedJourneyModel] = useState<SelectedJourneyModel | null>(null);
  const handleJourneyModelChange = useCallback((model: SelectedJourneyModel | null) => { setSelectedJourneyModel((current) => JSON.stringify(current) === JSON.stringify(model) ? current : model); }, []);
  useEffect(() => { setSelectedJourneyModel(null); }, [activeWorkspaceId]);
  const handleEngineReport = useCallback((report: DiagnosticReport | null, stale: boolean) => { setEngineReport(report); setEngineReportStale(stale); }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && 'version' in parsed && 'workspaces' in parsed && Array.isArray((parsed as WorkspaceStore).workspaces)) {
          const data = parsed as WorkspaceStore;
          const validWorkspaces = data.workspaces.filter(isWorkspace).map((workspace) => ({
            ...workspace, records: workspace.records.filter((record): record is EvidenceRecord => evidenceRecordSchema.safeParse(record).success),
          }));
          const malformedStoredRecords = data.workspaces.some((workspace) => isWorkspace(workspace)
            && workspace.records.some((record) => !evidenceRecordSchema.safeParse(record).success));
          if (validWorkspaces.length !== data.workspaces.length || malformedStoredRecords || data.version !== 1) {
            setStorageWritable(false);
            setNotice('Some saved workspace data is not compatible with this version. Automatic saving is paused to protect the original browser data. Export available evidence before making changes.');
          }
          setWorkspaces(validWorkspaces);
          const active = validWorkspaces.some((workspace) => workspace.id === data.activeWorkspaceId)
            ? data.activeWorkspaceId : (validWorkspaces[0]?.id ?? null);
          setActiveWorkspaceId(active);
        } else {
          setStorageWritable(false);
          setNotice('The saved workspace store has an unexpected format. Automatic saving is paused to protect the original browser data.');
        }
      } else {
        // Migrate the older single-register format without adding any records.
        const legacy = window.localStorage.getItem(LEGACY_EVIDENCE_STORAGE_KEY);
        if (legacy) {
          const parsed: unknown = JSON.parse(legacy);
          if (Array.isArray(parsed)) {
            const validRecords = parsed.filter((item): item is EvidenceRecord => evidenceRecordSchema.safeParse(item).success);
            if (validRecords.length > 0) {
              const now = new Date().toISOString();
              const migrated: InvestigationWorkspace = {
                id: crypto.randomUUID(), name: 'Recovered previous investigation', createdAt: now, updatedAt: now, records: validRecords,
              };
              setWorkspaces([migrated]);
              setActiveWorkspaceId(migrated.id);
            }
            if (validRecords.length !== parsed.length) {
              setStorageWritable(false);
              setNotice('Some old evidence records could not be migrated. Automatic saving is paused to protect the original local data.');
            } else if (validRecords.length > 0) {
              setNotice('Your previous single-register evidence was migrated into “Recovered previous investigation” and saved in the new workspace store.');
            }
          } else {
            setStorageWritable(false);
            setNotice('The previous evidence store has an unexpected format. Automatic saving is paused to protect it.');
          }
        }
      }
    } catch {
      setStorageWritable(false);
      setNotice('Could not read local workspace data. Automatic saving is paused to avoid overwriting existing browser data.');
    } finally { setStorageHydrated(true); }
  }, []);

  useEffect(() => {
    if (!storageHydrated || !storageWritable) return;
    const store: WorkspaceStore = { version: 1, activeWorkspaceId, workspaces };
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(store));
      // Remove the legacy single-register copy only after the new store has been saved successfully.
      try { window.localStorage.removeItem(LEGACY_EVIDENCE_STORAGE_KEY); } catch { /* old key may remain; the new store is already saved */ }
    } catch {
      setStorageWritable(false);
      setNotice('Browser storage is unavailable or full. The current view is now read-only; export evidence from the active investigation before leaving this page.');
    }
  }, [workspaces, activeWorkspaceId, storageHydrated, storageWritable]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const evidenceRecords = activeWorkspace?.records ?? [];
  const evidenceReviews = useMemo(() => evidenceRecords.map((record) => reviewEvidence(record, evidenceRecords)), [evidenceRecords]);
  const guidedAction = !activeWorkspace ? null : evidenceRecords.length === 0
    ? { eyebrow: 'START HERE', title: 'Add your first evidence records', description: 'Import or enter actual sample records. WaterChain does not generate sample data automatically.', target: 'evidence-register', button: 'Open evidence register', icon: Upload }
    : engineReportStale
      ? { eyebrow: 'REVIEW NEEDED', title: 'Refresh the diagnostic review', description: 'The evidence changed after the previous report. Its conclusions must not be treated as current until the review is rerun.', target: 'diagnostic-workbench', button: 'Refresh diagnostic review', icon: RefreshCw }
      : !engineReport
        ? { eyebrow: 'NEXT STEP', title: 'Run a diagnostic review', description: 'The engine will check record eligibility, source/batch lineage, chronology, and whether a candidate transition can be discussed.', target: 'diagnostic-workbench', button: 'Run diagnostic review', icon: Activity }
        : engineReport.attribution_permitted
          ? { eyebrow: 'CHALLENGE THE RESULT', title: 'Test which evidence the conclusion depends on', description: 'Run a bounded single-record omission analysis. This tests evidence availability, not a physical-world counterfactual or proof of causation.', target: 'decision-robustness', button: 'Open decision sensitivity', icon: SlidersHorizontal }
          : { eyebrow: 'RESOLVE UNCERTAINTY', title: 'Review the next evidence step', description: engineReport.next_step.action, target: 'temporal-evidence', button: 'Review follow-up options', icon: ClipboardList };
  const GuidedActionIcon = guidedAction?.icon;
  const stageCount = (stageId: string) => evidenceRecords.filter((record) => record.stage === ({ '01': 'source', '02': 'collection', '03': 'storage', '04': 'serving' } as Record<string, string>)[stageId]).length;

  // Step 10: pathway states come ONLY from the current engine report.
  // Register reviews are a local screen and are never used to label a
  // result eligible. A stale or missing report means "unresolved", never
  // the old report's states. A saved report that predates per-record
  // eligibility is likewise unresolved until a new review runs.
  function stageSignalFor(stageKey: string) {
    const records = evidenceRecords.filter((record) => record.stage === stageKey);
    const pairs = evidenceRecords.map((record, i) => ({ record, review: evidenceReviews[i] })).filter((pair) => pair.record.stage === stageKey);
    const currentReport = engineReportStale ? null : engineReport;
    const hasEligibility = Boolean(currentReport && Array.isArray(currentReport.record_eligibility));
    const entries = hasEligibility ? (currentReport?.record_eligibility || []).filter((entry) => entry.stage === stageKey) : [];
    const explicitJourney = currentReport?.evidence_summary.lineage_mode === 'explicit_journey';
    const pathwayDescription = explicitJourney ? 'selected water journey' : 'selected shared-batch pathway';
    const codes = new Set(records.map((record) => record.recordCode));
    const discordant = Boolean(currentReport && currentReport.findings.some((finding) => finding.code === 'discordant_stage_results' && finding.record_ids.some((id) => codes.has(id))));
    // Record eligibility is an engine result; pathway membership is separate.
    // In explicit-journey mode the engine excludes self-reported/unconfirmed
    // links from the pathway, while retaining the reason in pathway_link_basis.
    const onPathwayEntries = entries.filter((entry) => entry.eligible && entry.on_pathway);
    const eligiblePos = onPathwayEntries.filter((entry) => entry.result_kind === 'positive');
    const eligibleNeg = onPathwayEntries.filter((entry) => entry.result_kind === 'negative');
    const offPathwayEntries = entries.filter((entry) => entry.eligible && !entry.on_pathway && entry.result_kind !== 'neither');
    const offPathwayPos = offPathwayEntries.filter((entry) => entry.result_kind === 'positive');
    const offPathwayNeg = offPathwayEntries.filter((entry) => entry.result_kind === 'negative');
    const selfReportedPos = offPathwayPos.filter((entry) => entry.pathway_link_basis === 'self_reported');
    const selfReportedNeg = offPathwayNeg.filter((entry) => entry.pathway_link_basis === 'self_reported');
    const unresolvedLinkPos = offPathwayPos.filter((entry) => entry.pathway_link_basis === 'unconfirmed');
    const unresolvedLinkNeg = offPathwayNeg.filter((entry) => entry.pathway_link_basis === 'unconfirmed');
    const excluded = entries.filter((entry) => !entry.eligible);
    const eligibleCount = currentReport ? (currentReport.evidence_summary.pathway_eligible_by_stage[stageKey] ?? 0) : null;
    const stageFindings = currentReport ? currentReport.findings.filter((finding) => finding.record_ids.some((id) => codes.has(id))) : [];
    if (records.length === 0) return { label: 'Unassessed', cls: 'signal-unassessed', detail: 'No records at this stage.', records, pairs, entries, eligibleCount, stageFindings };
    if (!currentReport) return { label: 'Eligibility unresolved', cls: 'signal-unresolved', detail: engineReportStale ? 'The last report is stale — run the review again.' : 'Run the diagnostic review — the engine has not assessed these records yet.', records, pairs, entries, eligibleCount, stageFindings };
    if (!hasEligibility) return { label: 'Eligibility unresolved', cls: 'signal-unresolved', detail: 'This saved report predates per-record eligibility — run a new review.', records, pairs, entries, eligibleCount, stageFindings };
    if (discordant) return { label: 'Evidence limited', cls: 'signal-limited', detail: 'Conflicting results at this stage — see findings below.', records, pairs, entries, eligibleCount, stageFindings };
    if (eligiblePos.length > 0) return { label: 'Eligible positive observed', cls: 'signal-positive', detail: `This positive result passed the engine eligibility gate and is linked to the ${pathwayDescription}. It is an observation, not proof of origin.${offPathwayEntries.length ? ` ${offPathwayEntries.length} additional eligible record(s) are not included in this pathway.` : ''}`, records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (eligibleNeg.length > 0) return { label: 'Eligible negative observed', cls: 'signal-negative', detail: `This negative result passed the engine eligibility gate and is linked to the ${pathwayDescription}. A negative does not prove absence at other times.${offPathwayEntries.length ? ` ${offPathwayEntries.length} additional eligible record(s) are not included in this pathway.` : ''}`, records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (explicitJourney && selfReportedPos.length > 0) return { label: 'Eligible positive — self-reported link', cls: 'signal-off-pathway', detail: 'The record itself passed the engine eligibility gate, but its relationship to the selected water journey is self-reported and is not used in pathway hypotheses. Add a directly documented/associated-visit reference if the source records support it.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (explicitJourney && selfReportedNeg.length > 0) return { label: 'Eligible negative — self-reported link', cls: 'signal-off-pathway', detail: 'The record itself passed the engine eligibility gate, but its relationship to the selected water journey is self-reported and is not used in pathway hypotheses.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (explicitJourney && unresolvedLinkPos.length > 0) return { label: 'Eligible positive — link unresolved', cls: 'signal-off-pathway', detail: 'A positive result passed record-level eligibility, but its journey relationship is unconfirmed or lacks the required field/visit reference. It is excluded from pathway hypotheses.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (explicitJourney && unresolvedLinkNeg.length > 0) return { label: 'Eligible negative — link unresolved', cls: 'signal-off-pathway', detail: 'A negative result passed record-level eligibility, but its journey relationship is unconfirmed or lacks the required field/visit reference. It is excluded from pathway hypotheses.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (offPathwayPos.length > 0) return { label: 'Eligible positive — not linked to selected pathway', cls: 'signal-off-pathway', detail: explicitJourney ? 'A positive result passed record-level eligibility, but no accepted sampling-event relationship links it to the selected water journey. It does not contribute to pathway hypotheses.' : currentReport.evidence_summary.pathway_batch_id ? 'A positive result passed record-level eligibility, but the engine did not link it to the selected shared-batch pathway. It does not contribute to pathway hypotheses.' : 'A positive result passed record-level eligibility, but no unique shared-batch pathway was established. It does not contribute to a cross-stage pathway hypothesis.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (offPathwayNeg.length > 0) return { label: 'Eligible negative — off selected pathway', cls: 'signal-off-pathway', detail: explicitJourney ? 'A negative result passed record-level eligibility, but no accepted sampling-event relationship links it to the selected water journey. It does not contribute to pathway hypotheses.' : currentReport.evidence_summary.pathway_batch_id ? 'A negative result passed record-level eligibility, but the engine did not link it to the selected shared-batch pathway. It does not contribute to pathway hypotheses.' : 'A negative result passed record-level eligibility, but no unique shared-batch pathway was established. It does not contribute to a cross-stage pathway hypothesis.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (excluded.length > 0) return { label: 'Result excluded', cls: 'signal-excluded', detail: excluded[0].reason, records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    if (entries.some((entry) => entry.eligible && !entry.on_pathway)) return { label: 'Eligible record — off selected pathway', cls: 'signal-off-pathway', detail: explicitJourney ? 'The record passed the engine eligibility gate but has no accepted relationship to the selected water journey.' : 'The record passed its own eligibility gate but has no reportable positive or negative result and is not linked to the selected pathway.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
    return { label: 'Evidence limited', cls: 'signal-limited', detail: 'No reportable result at this stage.', records, pairs, entries, eligibleCount, stageFindings, offPathwayEntries };
  }

  function updateEvidenceRecords(next: EvidenceRecord[]) {
    if (!activeWorkspaceId) {
      setNotice('Create or select an investigation before adding evidence.');
      return;
    }
    const now = new Date().toISOString();
    setWorkspaces((current) => current.map((workspace) => workspace.id === activeWorkspaceId
      ? { ...workspace, records: next, updatedAt: now } : workspace));
  }

  function jumpToEvidence(importMode = false) {
    if (!storageHydrated) { setNotice('Loading local investigations. Try again in a moment.'); return; }
    if (!activeWorkspace) {
      setNotice('Create or select an investigation before entering evidence.');
      setShowCreateCase(true);
      return;
    }
    document.getElementById('evidence-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (importMode) window.setTimeout(() => document.getElementById('evidence-csv-open')?.click(), 350);
  }

  function createCase() {
    if (!storageHydrated || !storageWritable) return;
    const trimmed = caseName.trim();
    if (!trimmed) return;
    if (trimmed.length > 80) { setCaseNameError('Investigation names must be 80 characters or fewer.'); return; }
    if (workspaces.some((workspace) => workspace.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setCaseNameError('An investigation with that name already exists. Choose a distinct name so evidence exports remain easy to identify.');
      return;
    }
    const now = new Date().toISOString();
    const created: InvestigationWorkspace = { id: crypto.randomUUID(), name: trimmed, createdAt: now, updatedAt: now, records: [] };
    setWorkspaces((current) => [created, ...current]);
    setActiveWorkspaceId(created.id);
    setCaseNameError('');
    setShowCreateCase(false);
    setNotice(`Investigation “${trimmed}” created locally with an empty evidence register. No samples or test results were generated.`);
    setCaseName('');
  }

  // Recompute the server's evidence fingerprint over schema-parsed records,
  // sorted the same way as app/api/diagnose/route.ts, so a review bundle
  // whose records were edited after export is rejected at restore time.
  // A SHA-256 hash detects a changed snapshot; it does not authenticate
  // the records (anyone who can edit the records can also recompute it).
  async function stableEvidenceHash(records: EvidenceRecord[]): Promise<string> {
    const canonical = [...records].sort((a, b) =>
      a.recordCode.localeCompare(b.recordCode) || a.id.localeCompare(b.id) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function readWorkspaceBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!storageHydrated || !storageWritable) { setNotice('Workspace storage is not writable. Resolve the storage warning before restoring a backup.'); return; }
    if (file.size > 5_000_000) { setNotice('Backup exceeds the 5 MB prototype limit.'); return; }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object') throw new Error('The selected file is not a WaterChain JSON backup.');
      const data = parsed as {
        backupSchema?: unknown; bundleSchema?: unknown; workspace?: { name?: unknown }; investigation?: { name?: unknown };
        evidenceRecords?: unknown; recordCount?: unknown; exportedAt?: unknown;
        review?: { recordCount?: unknown; evidenceSha256?: unknown };
      };
      const isWorkspaceBackup = data.backupSchema === 'waterchain-investigation-backup-v1';
      const isReviewBundle = data.bundleSchema === 'waterchain-review-bundle-v1';
      if (!isWorkspaceBackup && !isReviewBundle) throw new Error('Unsupported JSON format. Choose a WaterChain investigation backup or review bundle.');
      const rawName = isWorkspaceBackup ? data.workspace?.name : data.investigation?.name;
      if (typeof rawName !== 'string' || !rawName.trim()) throw new Error('The backup has no valid investigation name.');
      if (!Array.isArray(data.evidenceRecords) || data.evidenceRecords.length === 0 || data.evidenceRecords.length > 500) {
        throw new Error('Backup must contain between 1 and 500 evidence records.');
      }
      const records: EvidenceRecord[] = [];
      for (let index = 0; index < data.evidenceRecords.length; index += 1) {
        const record = evidenceRecordSchema.safeParse(data.evidenceRecords[index]);
        if (!record.success) throw new Error(`Backup record ${index + 1} does not match the current evidence schema. No records were restored.`);
        records.push(record.data);
      }
      const statedCount = isWorkspaceBackup ? data.recordCount : data.review?.recordCount;
      if (statedCount !== records.length) throw new Error('The declared record count does not match the records in the backup. No records were restored.');
      if (isReviewBundle && typeof data.review?.evidenceSha256 === 'string' && /^[a-f0-9]{64}$/.test(data.review.evidenceSha256)) {
        if (!crypto.subtle) throw new Error('This browser cannot verify the review bundle fingerprint. Restore was not performed.');
        const recomputed = await stableEvidenceHash(records);
        if (recomputed !== data.review.evidenceSha256) throw new Error('The review bundle evidence fingerprint does not match its records. The bundle may have been edited after export. No records were restored.');
      }
      setRestoreCandidate({ name: rawName.trim().slice(0, 80), exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : 'Unknown export time', records });
    } catch (error) {
      setRestoreCandidate(null);
      if (error instanceof SyntaxError) setNotice('The selected file is not valid JSON. Choose a WaterChain investigation backup or review bundle.');
      else setNotice(error instanceof Error ? error.message : 'Could not read the selected backup.');
    }
  }

  function restoreAsNewWorkspace() {
    if (!restoreCandidate || !storageHydrated || !storageWritable) return;
    const baseName = `Restored — ${restoreCandidate.name}`.slice(0, 80);
    let uniqueName = baseName;
    let suffix = 2;
    while (workspaces.some((workspace) => workspace.name.toLocaleLowerCase() === uniqueName.toLocaleLowerCase())) {
      const tail = ` (${suffix})`;
      uniqueName = `${baseName.slice(0, 80 - tail.length)}${tail}`;
      suffix += 1;
    }
    const now = new Date().toISOString();
    const restored: InvestigationWorkspace = {
      id: crypto.randomUUID(), name: uniqueName, createdAt: now, updatedAt: now, records: restoreCandidate.records,
    };
    setWorkspaces((current) => [restored, ...current]);
    setActiveWorkspaceId(restored.id);
    setNotice(`Restored ${restored.records.length} evidence record(s) into “${uniqueName}”. Existing investigations were not changed.`);
    setRestoreCandidate(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><BrandMark /></div>
          <div><div className="brand-name">WaterChain</div><div className="brand-caption">EVIDENCE WORKBENCH</div></div>
        </div>
        <div className="workspace-select"><div className="workspace-avatar">{activeWorkspace ? activeWorkspace.name.slice(0, 1).toUpperCase() : '—'}</div><div className="workspace-copy"><span className="eyebrow">CURRENT INVESTIGATION</span><select aria-label="Select investigation" disabled={!storageHydrated} value={activeWorkspaceId ?? ''} onChange={(event) => { setActiveWorkspaceId(event.target.value || null); setNotice(event.target.value ? 'Switched investigation. Evidence and diagnostic results are isolated to the selected local workspace.' : 'No investigation selected. Create or select one before entering evidence.'); }}><option value="">No active case</option>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></div><ChevronDown size={15} /></div>
        <div className="sidebar-section-label">INVESTIGATION</div>
        <nav className="nav-list" aria-label="Investigation navigation">
          <button className="nav-item active" onClick={() => setNotice('The pathway is a four-stage conceptual model. The current view uses only the active investigation and its recorded evidence.')}><Workflow size={17}/><span>Pathway workspace</span><span className="nav-shortcut">01</span></button>
          <button className="nav-item" onClick={() => jumpToEvidence()}><FileCheck2 size={17}/><span>Evidence register</span><span className="nav-count">{evidenceRecords.length}</span></button>
          <button className="nav-item" onClick={() => document.getElementById('diagnostic-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><GitBranch size={17}/><span>Diagnostic plan</span></button>
          <button className="nav-item" onClick={() => document.getElementById('temporal-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><CalendarClock size={17}/><span>Temporal evidence</span><span className="nav-shortcut">07</span></button>
          <button className="nav-item" onClick={() => document.getElementById('risk-control-register')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ShieldAlert size={17}/><span>Risk &amp; controls</span><span className="nav-shortcut">05</span></button>
          <button className="nav-item" onClick={() => document.getElementById('action-loop')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><ClipboardList size={17}/><span>ActionLoop</span><span className="nav-shortcut">06</span></button>
        </nav>
        <div className="sidebar-section-label tools-label">TOOLS</div>
        <nav className="nav-list" aria-label="Tools">
          <button className="nav-item" onClick={() => jumpToEvidence(true)}><Upload size={17}/><span>Import evidence</span><span className="nav-plus"><Plus size={13}/></span></button>
          <button className="nav-item" onClick={() => activeWorkspace ? document.getElementById('independent-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : setNotice('Create or select an investigation before preparing an independent review packet.')}><ClipboardCheck size={17}/><span>Blind validation</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="integrity-card"><div className="integrity-icon"><ShieldCheck size={16}/></div><div><strong>Evidence-first by design</strong><p>Conclusions require traceable support. Unknown stays unknown.</p></div></div>
          <button className="nav-item settings-item" onClick={() => setNotice('Privacy: investigations, evidence, diagnostic reports, risk and control records, and ActionLoop tasks are stored in this browser only. There is no sign-in, encryption guarantee, server-side persistence, or multi-device sync. Export a protected backup before clearing browser data.')}><Settings2 size={17}/><span>Storage & privacy</span></button>
          <div className="user-row"><div className="user-avatar">WC</div><div className="user-copy"><strong>Local prototype</strong><span>Data stays in this browser</span></div><button aria-label="About this prototype" onClick={() => setNotice('Prototype boundaries: evidence, risk records, ActionLoop tasks and the latest diagnostic report are stored per investigation in this browser. During review, records are sent to the local Next.js API and Python engine in memory. No server-side case database or lab authentication exists, and the engine does not prove causation.')}><CircleHelp size={16}/></button></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspaces</span><ArrowRight size={13}/><strong>{activeWorkspace?.name ?? 'No active investigation'}</strong></div>
          <div className="topbar-actions"><div className="environment-pill"><span className="status-dot"/> Prototype environment</div><button className="icon-button" aria-label="Search evidence" onClick={() => { jumpToEvidence(); window.setTimeout(() => document.getElementById('evidence-record-search')?.focus(), 400); }}><Search size={17}/></button><button className="help-button" onClick={() => setNotice('WaterChain helps test whether available evidence can support a contamination-pathway hypothesis. It must not replace laboratory testing or public-health advice.')}><CircleHelp size={16}/><span>Guide</span></button></div>
        </header>

        <div className="content-wrap">
          <section className="hero-tidal" aria-label="WaterChain introduction">
            <div className="hero-tidal-inner">
              <div className="hero-tidal-mark"><BrandMark size={52} /><span>WaterChain · Evidence Investigation Workbench</span></div>
              <p className="hero-tidal-kicker">Drinking-water evidence, followed honestly</p>
              <h1 className="hero-tidal-title">Water, traced like a river.</h1>
              <p className="hero-tidal-sub">Follow a household&apos;s water from source to serving, record by record — and let the evidence say when it cannot say enough. No invented results. No forced conclusions.</p>
              <div className="hero-tidal-ctas"><button className="primary-button" disabled={!storageWritable || !storageHydrated} onClick={() => { setCaseNameError(''); setShowCreateCase(true); }}><Plus size={16}/> Start an investigation</button><button className="secondary-button" onClick={() => document.getElementById('water-pathway')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>See how the pathway works</button></div>
              <div className="hero-tidal-chips"><span>Evidence before conclusions</span><span>Abstention is a valid outcome</span><span>Everything stays in this browser</span></div>
            </div>
            <div className="hero-waves" aria-hidden="true">
              <svg className="wave wave-3" viewBox="0 0 2880 110" preserveAspectRatio="none"><path d="M0,60 C240,20 480,100 720,60 C960,20 1200,100 1440,60 C1680,20 1920,100 2160,60 C2400,20 2640,100 2880,60 L2880,110 L0,110 Z" fill="#CDE6F0"/></svg>
              <svg className="wave wave-2" viewBox="0 0 2880 110" preserveAspectRatio="none"><path d="M0,70 C240,110 480,30 720,70 C960,110 1200,30 1440,70 C1680,110 1920,30 2160,70 C2400,110 2640,30 2880,70 L2880,110 L0,110 Z" fill="#D9ECF3"/></svg>
              <svg className="wave wave-1" viewBox="0 0 2880 110" preserveAspectRatio="none"><path d="M0,80 C240,40 480,110 720,80 C960,40 1200,110 1440,80 C1680,40 1920,110 2160,80 C2400,40 2640,110 2880,80 L2880,110 L0,110 Z" fill="#F4F8FB"/></svg>
            </div>
          </section>
          
          <div className="page-heading"><div><div className="overline"><span className="overline-line"/> INVESTIGATION / OVERVIEW</div><h1>Pathway workspace<span className="heading-period">.</span></h1><p className="heading-subtitle">Trace the evidence before you trace the contamination.</p></div><div className="page-heading-actions"><button className="secondary-button" disabled={!storageWritable || !storageHydrated} onClick={() => backupInputRef.current?.click()}><Upload size={15}/> Restore backup</button><button className="primary-button" disabled={!storageWritable || !storageHydrated} onClick={() => { setCaseNameError(''); setShowCreateCase(true); }}><Plus size={17}/> New investigation</button><input ref={backupInputRef} type="file" accept=".json,application/json" aria-label="Select a WaterChain backup JSON file" hidden onChange={readWorkspaceBackup}/></div></div>
          {notice && <div className="notice-banner"><Info size={16}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={15}/></button></div>}

          <div className="status-strip"><div className="status-item"><span className="status-label">CASE STATUS</span><span className="status-value"><span className="status-dot muted"/>{activeWorkspace ? 'Local investigation active' : 'Awaiting case setup'}</span></div><div className="status-divider"/><div className="status-item"><span className="status-label">EVIDENCE RECORDS</span><span className="status-value number">{evidenceRecords.length} <span className="subdued">/ evidence records</span></span></div><div className="status-divider"/><div className="status-item"><span className="status-label">DIAGNOSTIC STATUS</span><span className="status-value"><span className="status-dot amber"/> {evidenceRecords.length === 0 ? 'Not evaluated' : `${evidenceReviews.filter((review) => review.status === 'blocked').length} blocked · review below`}</span></div><div className="status-right"><ShieldCheck size={15}/><span>{activeWorkspace ? `Updated ${new Date(activeWorkspace.updatedAt).toLocaleString()}` : 'No case-specific data created'}</span></div></div>
          {guidedAction && GuidedActionIcon && <section className="guided-next-action" id="guided-next-action" aria-labelledby="guided-next-action-title"><div className="guided-next-action-icon"><GuidedActionIcon size={18}/></div><div className="guided-next-action-copy"><span className="panel-kicker">{guidedAction.eyebrow} / GUIDED WORKFLOW</span><h2 id="guided-next-action-title">{guidedAction.title}</h2><p>{guidedAction.description}</p><small>This is a workflow suggestion, not a water-safety rating or diagnostic result.</small></div><button className="primary-button" type="button" onClick={() => { const target = document.getElementById(guidedAction.target); if (target) { target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); const focusTarget = target.querySelector('button, input, select, [tabindex="0"]') as HTMLElement | null; focusTarget?.focus({ preventScroll: true }); } }}><GuidedActionIcon size={14}/>{guidedAction.button}</button></section>}

          <div className="workbench-grid">
            <section className="panel pathway-panel" id="water-pathway">
              <div className="panel-header"><div><div className="panel-kicker">01 / SYSTEM MODEL</div><h2>Water pathway</h2><p>Define the journey your evidence can actually support.</p></div><button className="quiet-button" onClick={() => setNotice('The pathway shown is the conceptual model for this project, not an observed household journey.')}><Info size={15}/><span>Model notes</span></button></div>
              <div className="pathway-engine-status" role="status">{!engineReport ? 'Engine review: not run yet — stage states show eligibility as unresolved until a review runs.' : engineReportStale ? 'Engine review: stale — the evidence changed since the last review. Stage states below do not use the old report.' : 'Engine review: current — stage states come from the latest engine report.'}</div>
              <div className="pathway-canvas"><div className="canvas-grid"/><div className="canvas-tag"><span className="legend-dot"/> CONCEPTUAL PATHWAY <span className="tag-separator">/</span> NOT CASE DATA</div><svg className="pathway-ribbon" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="ribbonGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#D9ECF3"/><stop offset="0.5" stopColor="#BFE0EC"/><stop offset="1" stopColor="#D9ECF3"/></linearGradient></defs><path className="ribbon-band" d="M0,52 C200,28 400,76 600,52 C800,28 1000,76 1200,52 L1200,92 C1000,116 800,68 600,92 C400,116 200,68 0,92 Z" fill="url(#ribbonGrad)"/><path className="ribbon-highlight" d="M0,52 C200,28 400,76 600,52 C800,28 1000,76 1200,52" fill="none" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9"/><path className="ribbon-flow" d="M0,72 C200,48 400,96 600,72 C800,48 1000,96 1200,72" fill="none" stroke="#147FA3" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10 14"/></svg><div className="pathway-track">
                {stages.map((stage, index) => { const Icon = stage.icon; const stageKey = ({ '01': 'source', '02': 'collection', '03': 'storage', '04': 'serving' } as Record<string, string>)[stage.id]; const signal = stageSignalFor(stageKey); return <div className="stage-group" key={stage.id}><button className={`stage-card${selectedStage === stage.id ? ' stage-selected' : ''}`} aria-pressed={selectedStage === stage.id} aria-label={`${stage.title} stage: ${signal.label}`} onClick={() => { setSelectedStage(stage.id); setNotice(stageCount(stage.id) === 0 ? `${stage.title} is a conceptual stage with no linked evidence records.` : `${stage.title} has ${stageCount(stage.id)} recorded evidence item(s). Their presence does not establish contamination or source attribution.`); }}><div className="stage-top"><span className="stage-index">STAGE {stage.id}</span><span className="stage-state">{stageCount(stage.id) === 0 ? 'EMPTY' : `${stageCount(stage.id)} RECORD${stageCount(stage.id) === 1 ? '' : 'S'}`}</span></div><div className="stage-icon"><Icon size={20}/></div><strong>{stage.title}</strong><span className="stage-subtitle">{stage.subtitle}</span><div className="stage-bottom"><span className={`stage-signal-dot ${signal.cls}`}/><span className={`stage-signal ${signal.cls}`} aria-label={`Stage status: ${signal.label}`}>{signal.label}</span><span className="stage-bottom-note">{signal.eligibleCount === null ? 'On pathway: —' : `On pathway: ${signal.eligibleCount} of ${signal.records.length}`}</span><span className="stage-signal-detail">{signal.detail}</span></div></button>{index < stages.length - 1 && <div className="stage-connector"><div className="connector-line"/><ArrowRight size={15}/></div>}</div>})}
              </div><svg className="flowline" viewBox="0 0 1200 26" preserveAspectRatio="none" aria-hidden="true"><path d="M0,13 Q75,2 150,13 T300,13 T450,13 T600,13 T750,13 T900,13 T1050,13 T1200,13"/></svg><div className="pathway-legend"><div className="legend-states"><span><span className="stage-signal-dot signal-unassessed"/> Unassessed — no records</span><span><span className="stage-signal-dot signal-unresolved"/> Eligibility unresolved — no current engine report</span><span><span className="stage-signal-dot signal-excluded"/> Result excluded — engine reason shown</span><span><span className="stage-signal-dot signal-limited"/> Evidence limited — conflicting or no reportable result</span><span><span className="stage-signal-dot signal-positive"/> Eligible positive observed</span><span><span className="stage-signal-dot signal-negative"/> Eligible negative observed</span><span><span className="stage-signal-dot signal-off-pathway"/> Eligible result — off selected pathway</span></div><p>Stage states come from the current engine report only. Off-pathway results are not used in the selected pathway hypotheses. An eligible positive is an observation, not proof of origin. A negative does not prove absence.</p></div><div className="canvas-footnote"><span><Layers3 size={14}/> 4 conceptual stages</span><span><AlertCircle size={14}/> No observed transfer history</span></div></div>
              {selectedStage && (() => { const stage = stages.find((item) => item.id === selectedStage); if (!stage) return null; const stageKey = ({ '01': 'source', '02': 'collection', '03': 'storage', '04': 'serving' } as Record<string, string>)[stage.id]; const signal = stageSignalFor(stageKey); const entryById = new Map(signal.entries.map((entry) => [entry.record_id, entry])); return (<div className="stage-detail"><div className="stage-detail-header"><strong>{stage.title} — records and findings</strong><button className="quiet-button" onClick={() => setSelectedStage(null)}>Close</button></div><p className={`stage-detail-status ${signal.cls}`}>Status: {signal.label} — {signal.detail}</p>{signal.records.length === 0 ? <p className="stage-detail-empty">No records at this stage. A stage with no records is unassessed — it is not negative, clean, or verified.</p> : <table className="stage-detail-table"><thead><tr><th>Record</th><th>Result</th><th>Register check</th><th>Engine eligibility</th></tr></thead><tbody>{signal.pairs.map((pair) => { const entry = entryById.get(pair.record.id); return (<tr key={pair.record.id}><td>{pair.record.recordCode}</td><td>{resultLabels[pair.record.result] || pair.record.result}</td><td>{pair.review.status === 'blocked' ? 'Register: blocked' : pair.review.status === 'limited' ? 'Register: limited' : pair.review.status === 'metadata_complete' ? 'Register: no flags' : 'Register: record only'}</td><td>{entry ? (entry.eligible ? (entry.on_pathway ? 'Eligible · on pathway' : 'Eligible · off selected pathway') : `Excluded — ${entry.reason}`) : 'Eligibility unresolved'}</td></tr>); })}</tbody></table>}{signal.stageFindings.length > 0 && <div className="stage-detail-findings"><strong>Findings affecting this stage</strong><ul>{signal.stageFindings.map((finding, index) => <li key={`${finding.code}-${index}`}>{finding.message}</li>)}</ul></div>}<div className="stage-detail-actions"><button className="secondary-button" onClick={() => jumpToEvidence()}>Review in evidence register</button><button className="secondary-button" onClick={() => document.getElementById('diagnostic-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Open diagnostic review</button></div></div>); })()}
              <div className="panel-footer pathway-footer"><div className="footer-note-icon"><Activity size={16}/></div><div><strong>Causal origin remains unproven</strong><p>The engine can identify a candidate transition only when stage coverage, sample linkage, chronology, and test metadata pass its checks. It does not establish definitive causation.</p></div><span className="locked-pill">CAUSATION UNPROVEN</span></div>
            </section>

            <aside className="panel inspector-panel"><div className="panel-header inspector-heading"><div><div className="panel-kicker">02 / EVIDENCE REVIEW</div><h2>Evidence inspector</h2><p>Review records and their limits.</p></div><button className="small-icon-button" aria-label="Evidence inspector options" onClick={() => jumpToEvidence()}><SlidersHorizontal size={16}/></button></div>{evidenceRecords.length === 0 ? <><div className="inspector-empty"><div className="empty-illustration"><div className="empty-ring ring-one"/><div className="empty-ring ring-two"/><div className="empty-center"><ClipboardList size={23}/></div><span className="orbit-dot orbit-a"/><span className="orbit-dot orbit-b"/></div><h3>No evidence to inspect</h3><p>Sample records, test results, timestamps, and quality-control details will appear here after they are added.</p><button className="secondary-button" onClick={() => jumpToEvidence()}><Plus size={15}/> Go to evidence register</button></div><div className="inspector-checks"><div className="check-row"><span className="check-icon"><CheckCircle2 size={15}/></span><span>Sample identity</span><span className="check-state">Pending</span></div><div className="check-row"><span className="check-icon"><CheckCircle2 size={15}/></span><span>Collection timestamp</span><span className="check-state">Pending</span></div><div className="check-row"><span className="check-icon"><CheckCircle2 size={15}/></span><span>Test / QC metadata</span><span className="check-state">Pending</span></div></div></> : <div className="inspector-summary"><div className="inspector-count"><strong>{evidenceRecords.length}</strong><span>saved evidence records</span></div><div className="inspector-summary-row"><ShieldAlert size={14}/><span>Blocked by metadata checks</span><strong>{evidenceReviews.filter((review) => review.status === 'blocked').length}</strong></div><div className="inspector-summary-row"><AlertCircle size={14}/><span>Limited metadata</span><strong>{evidenceReviews.filter((review) => review.status === 'limited').length}</strong></div><button className="secondary-button" onClick={() => jumpToEvidence()}>Review evidence register <ArrowRight size={14}/></button><p className="inspector-summary-note">Register checks only. Diagnostic eligibility comes from the engine review — see the pathway and workbench.</p></div>} </aside>
          </div>

          {activeWorkspace ? <div key={activeWorkspace.id} className="case-evidence-workflow">
            <WaterJourneyWorkbench workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} records={evidenceRecords} report={engineReport} reportStale={engineReportStale} readOnly={!storageWritable} onNotice={setNotice} onJourneyModelChange={handleJourneyModelChange} />
            <EvidenceRegister records={evidenceRecords} workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} onChange={updateEvidenceRecords} onNotice={setNotice} readOnly={!storageWritable} />
            <DiagnosticWorkbench records={evidenceRecords} workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} journeyModel={selectedJourneyModel} onReportChange={handleEngineReport} />
            <IndependentReviewWorkbench workspaces={workspaces} activeWorkspaceId={activeWorkspace.id} activeJourneyModel={selectedJourneyModel} activeReport={engineReport} activeReportStale={engineReportStale} readOnly={!storageWritable} onNotice={setNotice} />
            <TemporalEvidenceWorkbench workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} records={evidenceRecords} report={engineReport} reportStale={engineReportStale} journeyModel={selectedJourneyModel} readOnly={!storageWritable} onNotice={setNotice} />
            <RiskControlRegister records={evidenceRecords} workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} readOnly={!storageWritable} onNotice={setNotice} />
            <ActionLoop records={evidenceRecords} workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} report={engineReport} reportStale={engineReportStale} journeyModel={selectedJourneyModel} readOnly={!storageWritable} onNotice={setNotice} />
          </div> : <section className="panel no-active-case"><div className="no-case-icon"><Layers3 size={22}/></div><div className="panel-kicker">INVESTIGATION REQUIRED</div><h2>Create a workspace before adding evidence</h2><p>Each investigation stores its own evidence records in this browser. Switching cases does not mix their samples or diagnostic reviews. No sample data is generated automatically.</p><button className="primary-button" disabled={!storageWritable || !storageHydrated} onClick={() => setShowCreateCase(true)}><Plus size={16}/> Create first investigation</button></section>}

          <div className="lower-grid single-panel-grid"><section className="panel timeline-panel"><div className="lower-panel-heading"><div><div className="panel-kicker">07 / INTERPRETATION GUARDRAILS</div><h2>Before accepting a candidate transition</h2></div><span className="locked-pill">REVIEW REQUIRED</span></div><div className="method-guardrails"><div className="guardrail-item"><span className="guardrail-number">01</span><div><strong>Verify the original lab report</strong><p>Record references are not authenticated by WaterChain. Check the original result, method, units, and quality-control notes.</p></div></div><div className="guardrail-item"><span className="guardrail-number">02</span><div><strong>Confirm real water lineage</strong><p>A matching batch ID is user-entered metadata. It does not prove there was no refill, mixing, branching, or unrecorded transfer.</p></div></div><div className="guardrail-item"><span className="guardrail-number">03</span><div><strong>Consider timing and repeat results</strong><p>Intermittent contamination and different sampling times can explain discordant results. A single negative result does not prove a stage is safe.</p></div></div><div className="guardrail-item"><span className="guardrail-number">04</span><div><strong>Treat abstention as a valid outcome</strong><p>If identity, chronology, methods, or QC are unresolved, collect better evidence instead of naming an entry point.</p></div></div></div></section></div>

          <footer className="page-footer"><span><span className="footer-status-dot"/> WATERCHAIN / EVIDENCE INTEGRITY & PATHWAY REVIEW</span><span>Prototype only · No real-world water-quality conclusions</span><button onClick={() => setNotice('This prototype is not a certified laboratory or public-health system. Decisions require qualified testing and local health guidance.')}><ShieldCheck size={14}/> Safety & limitations</button></footer>
        </div>
      </section>

      {restoreCandidate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRestoreCandidate(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="restore-title"><div className="modal-top"><div className="modal-icon"><Database size={19}/></div><button className="small-icon-button" aria-label="Cancel restore" onClick={() => setRestoreCandidate(null)}><X size={17}/></button></div><div className="panel-kicker">RESTORE BACKUP</div><h2 id="restore-title">Restore as a separate investigation?</h2><p className="modal-description">The file is structurally valid. WaterChain will create a new local investigation and copy its evidence records there. Existing investigations will not be replaced.</p><div className="restore-summary"><div><span>Source investigation</span><strong>{restoreCandidate.name}</strong></div><div><span>Evidence records</span><strong>{restoreCandidate.records.length}</strong></div><div><span>Backup exported</span><strong>{restoreCandidate.exportedAt}</strong></div></div><div className="modal-note"><ShieldCheck size={15}/> Records are schema-checked, but the backup does not authenticate laboratory evidence.</div><div className="modal-actions"><button className="secondary-button" onClick={() => setRestoreCandidate(null)}>Cancel</button><button className="primary-button" onClick={restoreAsNewWorkspace}>Restore separately <ArrowRight size={15}/></button></div></section></div>}

      {showCreateCase && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowCreateCase(false); setCaseName(''); setCaseNameError(''); } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><div className="modal-icon"><BrandMark size={22} /></div><button className="small-icon-button" aria-label="Close dialog" onClick={() => { setShowCreateCase(false); setCaseName(''); setCaseNameError(''); }}><X size={17}/></button></div><div className="panel-kicker">NEW WORKSPACE</div><h2 id="modal-title">Start an investigation</h2><p className="modal-description">Create a separate local investigation. Its evidence is isolated from other investigations; no sample records or results are created automatically.</p><label className="field-label" htmlFor="case-name">Investigation name</label><input id="case-name" className="text-input" maxLength={80} placeholder="e.g. Household sample review" value={caseName} onChange={(event) => { setCaseName(event.target.value); setCaseNameError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') createCase(); }} autoFocus/><div className="modal-note"><ShieldCheck size={15}/> No evidence or results are generated automatically.</div>{caseNameError && <p className="form-error" role="alert">{caseNameError}</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => { setShowCreateCase(false); setCaseName(''); setCaseNameError(''); }}>Cancel</button><button className="primary-button" disabled={!storageWritable || !storageHydrated || !caseName.trim()} onClick={createCase}>Create workspace <ArrowRight size={15}/></button></div></section></div>}
    </main>
  );
}
