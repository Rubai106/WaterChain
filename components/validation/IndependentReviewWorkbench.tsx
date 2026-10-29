'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileCheck2, LockKeyhole, ShieldAlert, Users } from 'lucide-react';
import { z } from 'zod';
import type { EvidenceRecord } from '@/lib/evidence';
import { diagnosticApiResponseSchema, type DiagnosticReport } from '@/lib/diagnostics';
import {
  samplingEventSchema, selectedJourneyModelSchema,
  transferEventSchema, waterJourneySchema, waterSourceSchema, type SelectedJourneyModel,
} from '@/lib/investigation-model';
import {
  buildBlindedCase, buildReviewerProtocolMarkdown, buildReviewerResponseTemplate, classifyEngineDecision, compareReviewerResponses,
  compareReviewerSessions, decisionLabel, matchesSha256Fingerprint, parseReviewerResponseCsv, sha256Hex, validateStoredReviewerResults, type BlindReviewPrivateManifest,
  type BlindReviewCasePrivate, type StoredReviewerResults, type SessionAgreementSummary, type ReviewerSession,
} from '@/lib/independent-review';

const reportCacheSchema = diagnosticApiResponseSchema.extend({ analysedFingerprint: z.string() });
const PRIVATE_MANIFEST_PREFIX = 'waterchain:independent-review-private:v1:';
const LATEST_PACKET_KEY = 'waterchain:independent-review-latest:v1';
const PACKET_PREFIX = 'waterchain:independent-review-packet:v1:';
const MAX_REVIEW_PACKET_CASES = 30;

type WorkspaceForReview = { id: string; name: string; records: EvidenceRecord[] };
type Props = {
  workspaces: WorkspaceForReview[];
  activeWorkspaceId: string;
  activeJourneyModel: SelectedJourneyModel | null;
  activeReport: DiagnosticReport | null;
  activeReportStale: boolean;
  readOnly?: boolean;
  onNotice?: (message: string) => void;
};
type CachedReview = z.infer<typeof reportCacheSchema>;
type PrivateStoredResults = StoredReviewerResults;

function downloadFile(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function parseSavedJourneyModel(workspaceId: string): SelectedJourneyModel | null {
  try {
    const raw = localStorage.getItem(`waterchain:journey-model:v1:${workspaceId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const journeys = Array.isArray(data.journeys) ? data.journeys.flatMap((row) => { const parsed = waterJourneySchema.safeParse(row); return parsed.success ? [parsed.data] : []; }) : [];
    const sources = Array.isArray(data.sources) ? data.sources.flatMap((row) => { const parsed = waterSourceSchema.safeParse(row); return parsed.success ? [parsed.data] : []; }) : [];
    const events = Array.isArray(data.samplingEvents) ? data.samplingEvents.flatMap((row) => { const parsed = samplingEventSchema.safeParse(row); return parsed.success ? [parsed.data] : []; }) : [];
    const transfers = Array.isArray(data.transferEvents) ? data.transferEvents.flatMap((row) => { const parsed = transferEventSchema.safeParse(row); return parsed.success ? [parsed.data] : []; }) : [];
    const selectedJourney = journeys.find((journey) => journey.id === data.selectedJourneyId);
    if (!selectedJourney) return null;
    const source = sources.find((candidate) => candidate.id === selectedJourney.sourceId);
    if (!source) return null;
    const model = selectedJourneyModelSchema.safeParse({ journey: selectedJourney, source, samplingEvents: events.filter((event) => event.journeyId === selectedJourney.id), transferEvents: transfers.filter((event) => event.journeyId === selectedJourney.id) });
    return model.success ? model.data : null;
  } catch { return null; }
}

function getCachedReview(workspaceId: string): CachedReview | null {
  try {
    const raw = localStorage.getItem(`waterchain:diagnostic-review:v1:${workspaceId}`);
    if (!raw) return null;
    const parsed = reportCacheSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

function readPrivateManifest(packetId: string): BlindReviewPrivateManifest | null {
  try {
    const raw = localStorage.getItem(`${PRIVATE_MANIFEST_PREFIX}${packetId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<BlindReviewPrivateManifest>;
    if (data.schema !== 'waterchain-blind-review-private-v1' || data.packetId !== packetId || !Array.isArray(data.cases) || typeof data.packetFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(data.packetFingerprint)) return null;
    if (!data.cases.every((item) => item && typeof item.reviewCaseId === 'string' && typeof item.workspaceId === 'string' && typeof item.workspaceName === 'string' && typeof item.evidenceFingerprint === 'string' && typeof item.reportGeneratedAt === 'string' && ['candidate_transition', 'abstain', 'cannot_assess'].includes(item.engineDecision) && (item.engineCandidateStage === null || ['source', 'collection', 'storage', 'serving'].includes(item.engineCandidateStage)) && item.recordMap && typeof item.recordMap === 'object' && !Array.isArray(item.recordMap) && Object.entries(item.recordMap).every(([alias, record]) => /^R\d{3,}$/.test(alias) && record && typeof record.id === 'string' && typeof record.recordCode === 'string' && typeof record.sampleCode === 'string'))) return null;
    return data as BlindReviewPrivateManifest;
  } catch { return null; }
}

export default function IndependentReviewWorkbench({ workspaces, activeWorkspaceId, activeJourneyModel, activeReport, activeReportStale, readOnly = false, onNotice }: Props) {
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([activeWorkspaceId]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [packetJson, setPacketJson] = useState('');
  const [templateCsv, setTemplateCsv] = useState('');
  const [packetId, setPacketId] = useState<string | null>(null);
  const [packetIntegrityError, setPacketIntegrityError] = useState('');
  const [storedResults, setStoredResults] = useState<PrivateStoredResults | null>(null);

  useEffect(() => {
    setSelectedWorkspaceIds((current) => current.includes(activeWorkspaceId) ? current : [activeWorkspaceId]);
  }, [activeWorkspaceId]);

  useEffect(() => {
    let cancelled = false;
    async function restoreSavedPacket() {
      try {
        const latest = localStorage.getItem(LATEST_PACKET_KEY);
        if (!latest) return;
        const manifest = readPrivateManifest(latest);
        if (!manifest) {
          if (!cancelled) setPacketIntegrityError('The private review key is missing or invalid. Do not score reviewer responses against an incomplete local key.');
          return;
        }
        const savedPacket = localStorage.getItem(`${PACKET_PREFIX}${latest}`);
        let packetValid = false;
        if (savedPacket) {
          packetValid = (await matchesSha256Fingerprint(savedPacket, manifest.packetFingerprint));
        }
        if (cancelled) return;
        setPacketId(latest);
        setTemplateCsv(buildReviewerResponseTemplate(manifest.packetId, manifest.cases.map((item) => item.reviewCaseId)));
        if (packetValid && savedPacket) {
          setPacketJson(savedPacket);
          setPacketIntegrityError('');
        } else {
          setPacketJson('');
          setPacketIntegrityError('Saved blinded packet is missing or its SHA-256 does not match the private review key. Re-prepare the packet before downloading or importing a reviewer response.');
        }
        const key = `waterchain:independent-review-results:v1:${latest}`;
        const rawResults = localStorage.getItem(key);
        if (rawResults) {
          // Browser-local state is mutable and may be corrupted. Validate every saved
          // reviewer response against this packet's private manifest, and recompute
          // summaries rather than trusting a stored summary object.
          const parsed = JSON.parse(rawResults) as unknown;
          try {
            const validated = validateStoredReviewerResults(parsed, manifest);
            if (!cancelled) setStoredResults(validated);
          } catch (cause) {
            if (!cancelled) setError(cause instanceof Error ? `Saved reviewer responses failed validation and were preserved without loading: ${cause.message}` : 'Saved reviewer responses failed validation and were preserved without loading.');
          }
        }
      } catch {
        if (!cancelled) setPacketIntegrityError('Saved independent-review data could not be read or verified. Existing local data has not been overwritten.');
      }
    }
    void restoreSavedPacket();
    return () => { cancelled = true; };
  }, []);

  const selectedWorkspaces = useMemo(() => workspaces.filter((workspace) => selectedWorkspaceIds.includes(workspace.id)), [workspaces, selectedWorkspaceIds]);

  async function preparePacket() {
    setError(''); setMessage(''); setStoredResults(null); setBusy(true);
    try {
      if (readOnly) throw new Error('Browser storage is read-only. Resolve the existing storage warning before preparing a review packet.');
      if (selectedWorkspaceIds.length === 0) throw new Error('Select at least one investigation.');
      if (selectedWorkspaceIds.length > MAX_REVIEW_PACKET_CASES) throw new Error(`Select no more than ${MAX_REVIEW_PACKET_CASES} investigations per packet.`);
      const nextPacketId = `WC-PACKET-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const cases: ReturnType<typeof buildBlindedCase>[] = [];
      const privateCases: BlindReviewCasePrivate[] = [];
      const skipped: string[] = [];
      for (const workspace of selectedWorkspaces) {
        const journeyModel = workspace.id === activeWorkspaceId ? activeJourneyModel : parseSavedJourneyModel(workspace.id);
        let report: DiagnosticReport | null = null;
        const expectedFingerprint = JSON.stringify({ records: workspace.records, journeyModel });
        const cache = getCachedReview(workspace.id);
        // Use the same persisted fingerprint contract as DiagnosticWorkbench for every case.
        // The active in-memory report is not enough: during a rapid investigation switch it
        // could briefly still belong to the previously selected case.
        if (!cache || cache.analysedFingerprint !== expectedFingerprint) {
          skipped.push(`${workspace.name}: no saved current diagnostic report for this exact evidence/journey snapshot.`);
          continue;
        }
        if (workspace.id === activeWorkspaceId && activeReportStale) {
          skipped.push(`${workspace.name}: active diagnostic report is marked stale.`);
          continue;
        }
        report = cache.report;
        const generatedAt = cache.generatedAt;
        if (!report || !Array.isArray(report.record_eligibility)) { skipped.push(`${workspace.name}: the diagnostic report has no per-record eligibility data.`); continue; }
        if (workspace.records.length === 0) { skipped.push(`${workspace.name}: no evidence records.`); continue; }
        // Packet-scoped random case IDs prevent a response from an older packet
        // accidentally matching the same sequential case ID in a newer packet.
        const reviewCaseId = `WC-BR-${nextPacketId.slice(-8)}-${String(privateCases.length + 1).padStart(3, '0')}`;
        const built = buildBlindedCase({ reviewCaseId, records: workspace.records, journeyModel });
        cases.push(built);
        const baselineFingerprint = JSON.stringify({ records: workspace.records, journeyModel });
        const evidenceFingerprint = await sha256Hex(baselineFingerprint);
        const engineDecision = classifyEngineDecision(report, workspace.records.length);
        privateCases.push({ reviewCaseId, workspaceId: workspace.id, workspaceName: workspace.name, evidenceFingerprint, reportGeneratedAt: generatedAt, engineDecision: engineDecision.decision, engineCandidateStage: engineDecision.candidateStage, recordMap: built.recordMap });
      }
      if (cases.length === 0) throw new Error(`No eligible cases to package. ${skipped.join(' ')}`);
      const createdAt = new Date().toISOString();
      const blindedPacket = {
        schema: 'waterchain-blinded-independent-review-packet-v1',
        packetId: nextPacketId,
        createdAt,
        purpose: 'Independent blinded review of the evidence summary and relationship support. Expected engine decisions are intentionally omitted.',
        syntheticNotice: 'Some submitted cases may be synthetic QA fixtures and others may be user-entered case data. Case content is not independently authenticated by WaterChain. Do not use these packets to claim real-world diagnostic performance.',
        privacyNotice: 'This file includes de-identified test/field measurements and relationship metadata. Exact case names, source names, sample IDs, record codes, lab names, notes, free-text locations and source references are not included. Numeric results, analytes, stages, QC states and relationship topology are retained because they are needed for review. Review only if authorized and keep the packet secure.',
        timeAnonymization: 'Absolute timestamps are replaced with relative hours from the first known timestamp. These offsets retain the ordering and rough interval but not the original dates.',
        decisionOptions: ['candidate_transition', 'abstain', 'cannot_assess'],
        reviewerResponseCsvColumns: ['reviewer_code', 'reviewer_role', 'review_date', 'packet_id', 'review_case_id', 'decision', 'candidate_stage', 'supporting_record_ids', 'limitations_or_conflicts', 'rationale', 'rule_issue', 'rule_issue_description'],
        reviewerInstructions: [
          'Judge only from the records and relationship information supplied; do not assume a transfer occurred merely because two samples share a source or visit.',
          'Use candidate_transition only when the evidence supports a bracketed candidate interval; do not state that it proves causal origin.',
          'Use abstain when evidence exists but linkage, chronology, QC, or coverage is insufficient.',
          'Use cannot_assess when there is no usable evidence to make an assessment.',
          'Cite only valid reviewerRecordIds for that case (for example R001;R002), document limitations, and provide a rationale of at least 8 characters.',
          'Use the exact packet_id included in this packet on every row of the response CSV; response files from another packet are rejected.',
          'Use a pseudonymous reviewer_code and a role label; do not enter a personal name in the reviewer_code field.',
          'Do not treat the reference engine as a gold standard. The post-review comparison measures disagreement with a rule-based prototype, not diagnostic accuracy.',
        ],
        cases: cases.map((item) => item.payload),
      };
      const packetString = JSON.stringify(blindedPacket, null, 2);
      const packetFingerprint = await sha256Hex(packetString);
      const privateManifest: BlindReviewPrivateManifest = { schema: 'waterchain-blind-review-private-v1', packetId: nextPacketId, createdAt, packetFingerprint, cases: privateCases };
      const template = buildReviewerResponseTemplate(nextPacketId, privateCases.map((item) => item.reviewCaseId));
      // Save expected decisions and ID mappings privately before allowing export.
      // The blind packet itself never contains the reference engine conclusions.
      // Store both the blind packet and private comparison key locally before export.
      // If storage fails, do not create a packet that cannot later be matched to its response.
      localStorage.setItem(`${PACKET_PREFIX}${nextPacketId}`, packetString);
      localStorage.setItem(`${PRIVATE_MANIFEST_PREFIX}${nextPacketId}`, JSON.stringify(privateManifest));
      localStorage.setItem(LATEST_PACKET_KEY, nextPacketId);
      setPacketId(nextPacketId); setPacketJson(packetString); setPacketIntegrityError(''); setTemplateCsv(template); setMessage(`Prepared ${cases.length} blinded case(s). ${skipped.length ? `${skipped.length} selected case(s) were skipped; details are listed below.` : 'All selected cases had current reports.'}`);
      if (skipped.length) setError(`Skipped cases: ${skipped.join(' ')}`);
      setStoredResults(null);
      onNotice?.('Blinded reviewer packet prepared. The exported packet excludes engine conclusions; the comparison key stays in this browser only.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the blind reviewer packet.');
    } finally { setBusy(false); }
  }

  function importTemplate() {
    if (!templateCsv) { setError('Prepare a blinded packet first.'); return; }
    downloadFile(`waterchain-review-response-template-${packetId?.slice(-8) ?? 'packet'}.csv`, templateCsv, 'text/csv;charset=utf-8');
  }

  async function downloadPacket() {
    if (!packetJson || !packetId) return;
    const manifest = readPrivateManifest(packetId);
    if (!manifest || !(await matchesSha256Fingerprint(packetJson, manifest.packetFingerprint))) {
      setPacketIntegrityError('The blinded packet hash does not match the private comparison key. Export was blocked.');
      setPacketJson('');
      return;
    }
    downloadFile(`waterchain-blind-review-${packetId.slice(-8)}.json`, packetJson, 'application/json;charset=utf-8');
  }

  function downloadProtocol() {
    if (!packetId || !latestManifest || packetIntegrityError) return;
    const protocol = buildReviewerProtocolMarkdown(packetId, latestManifest.cases.map((item) => item.reviewCaseId));
    downloadFile(`waterchain-review-protocol-${packetId.slice(-8)}.md`, protocol, 'text/markdown;charset=utf-8');
  }

  async function importReviewerResponse(file: File | undefined) {
    setError(''); setMessage('');
    if (!file) return;
    if (file.size > 1_000_000) { setError('Reviewer response CSV exceeds the 1 MB prototype limit.'); return; }
    if (!packetId) { setError('No packet is selected in this browser. Prepare or restore the private comparison key first.'); return; }
    if (packetIntegrityError || !packetJson) { setError('The blinded packet is missing or has failed its integrity check. Re-prepare it before importing reviewer responses.'); return; }
    const manifest = readPrivateManifest(packetId);
    if (!manifest) { setError('The private comparison key is missing or unreadable in this browser. The reviewer response cannot be compared. This is not a reason to infer the expected result.'); return; }
    if (!(await matchesSha256Fingerprint(packetJson, manifest.packetFingerprint))) {
      setPacketIntegrityError('The blinded packet hash does not match the private comparison key. Import was blocked.');
      setError('The blinded packet failed its integrity check. Re-prepare the packet before importing reviewer responses.');
      setPacketJson('');
      return;
    }
    setBusy(true);
    try {
      const knownIds = new Set(manifest.cases.map((item) => item.reviewCaseId));
      const recordAliasesByCase = new Map(manifest.cases.map((item) => [item.reviewCaseId, new Set(Object.keys(item.recordMap))]));
      const parsedReviewerFile = parseReviewerResponseCsv(await file.text(), knownIds, manifest.packetId, recordAliasesByCase);
      const resultsKey = `waterchain:independent-review-results:v1:${packetId}`;
      let existingSessions = storedResults?.sessions ?? [];
      const existingRaw = localStorage.getItem(resultsKey);
      if (existingRaw) {
        const existingParsed = JSON.parse(existingRaw) as unknown;
        // Validate old sessions against the exact packet before appending. If local
        // storage was edited or corrupted, preserve it and reject the new import.
        existingSessions = validateStoredReviewerResults(existingParsed, manifest).sessions;
      }
      if (existingSessions.some((session) => session.reviewerCode.toLowerCase() === parsedReviewerFile.reviewerCode.toLowerCase())) {
        throw new Error(`Reviewer code ${parsedReviewerFile.reviewerCode} has already submitted a response for this packet. Preserve the first submission; prepare a new packet if a new review round is required.`);
      }
      const summary = compareReviewerResponses(manifest.cases, parsedReviewerFile.responses);
      const session: ReviewerSession = { reviewerCode: parsedReviewerFile.reviewerCode, reviewerRole: parsedReviewerFile.reviewerRole, reviewDate: parsedReviewerFile.reviewDate, responses: parsedReviewerFile.responses, summary, importedAt: new Date().toISOString() };
      const result: PrivateStoredResults = { schema: 'waterchain-independent-review-sessions-v1', sessions: [...existingSessions, session] };
      localStorage.setItem(resultsKey, JSON.stringify(result));
      setStoredResults(result);
      setMessage(`Imported ${parsedReviewerFile.responses.length} case response(s) from reviewer ${parsedReviewerFile.reviewerCode}. Agreement is descriptive and does not establish which decision is correct.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not validate the reviewer response CSV.');
    } finally { setBusy(false); }
  }

  const readyCount = selectedWorkspaces.filter((workspace) => workspace.records.length > 0).length;
  const latestManifest = packetId ? readPrivateManifest(packetId) : null;
  const canDownloadPacket = Boolean(packetId && packetJson && latestManifest && !packetIntegrityError);

  return (
    <section className="panel independent-review-panel" id="independent-review">
      <div className="panel-header independent-review-header">
        <div><div className="panel-kicker">09 / INDEPENDENT VALIDATION</div><h2>Blinded reviewer workbench</h2><p>Prepare anonymized evidence packets for an external reviewer, then compare their response with the rule engine without revealing the engine result in the packet.</p></div>
        <div className="independent-review-icon"><Users size={19}/></div>
      </div>
      <div className="independent-review-disclaimer"><LockKeyhole size={16}/><span><strong>Blinding and privacy:</strong> exported packets omit investigation names, raw IDs, lab names, notes, source references, and absolute dates. Expected engine decisions and record-ID mappings remain in this browser&rsquo;s local storage and are never included in the reviewer packet. This is a local single-user workflow, not secure multi-user review infrastructure.</span></div>
      <div className="independent-review-layout">
        <div className="independent-review-case-select">
          <div className="independent-review-section-title"><strong>1. Select reviewed investigations</strong><span>{selectedWorkspaceIds.length}/{MAX_REVIEW_PACKET_CASES} selected</span></div>
          <p>Select investigations with a current engine report. Saved reports from other investigations are accepted only if their evidence/journey fingerprint still matches.</p>
          {workspaces.length === 0 ? <div className="independent-review-empty">Create investigations and run current diagnostic reviews first.</div> : <div className="independent-review-workspace-list">{workspaces.map((workspace) => {
            const selected = selectedWorkspaceIds.includes(workspace.id);
            const isActive = workspace.id === activeWorkspaceId;
            const label = workspace.id === activeWorkspaceId ? (activeReportStale ? 'Active report stale' : activeReport ? 'Active report in view' : 'Run a diagnostic first') : 'Saved report checked on packet preparation';
            return <label key={workspace.id} className={`independent-review-workspace ${selected ? 'selected' : ''}`}><input type="checkbox" checked={selected} onChange={(event) => setSelectedWorkspaceIds((current) => event.target.checked ? (current.length >= MAX_REVIEW_PACKET_CASES ? current : [...current, workspace.id]) : current.filter((id) => id !== workspace.id))} disabled={readOnly || (selectedWorkspaceIds.length >= MAX_REVIEW_PACKET_CASES && !selected)}/><span className="independent-review-workspace-copy"><strong>{workspace.name}</strong><small>{workspace.records.length} evidence record(s) · {label}</small></span>{isActive && <span className="independent-review-active-pill">ACTIVE</span>}</label>;
          })}</div>}
          {selectedWorkspaces.length > 0 && <div className="independent-review-selected-note"><CheckCircle2 size={15}/>{readyCount} selected investigation(s) contain records. A fresh report is still required for each case.</div>}
          <button className="primary-button" onClick={preparePacket} disabled={busy || readOnly || selectedWorkspaceIds.length === 0}>{busy ? 'Preparing…' : 'Prepare blinded packet'} <FileCheck2 size={15}/></button>
          {error && <div className="independent-review-error" role="alert"><AlertTriangle size={15}/><span>{error}</span></div>}
          {message && !error && <div className="independent-review-success" role="status"><CheckCircle2 size={15}/><span>{message}</span></div>}
        </div>
        <div className="independent-review-packet-panel">
          <div className="independent-review-section-title"><strong>2. Download reviewer materials</strong>{packetId && <span className="independent-review-packet-id">{packetId.slice(-12)}</span>}</div>
          {!packetId ? <div className="independent-review-empty"><ClipboardCheck size={19}/><strong>No blinded packet prepared</strong><span>Choose reviewed cases and prepare a packet. The reviewer materials intentionally do not contain the engine&rsquo;s conclusion.</span></div> : <div className="independent-review-download-list">
            <div className="independent-review-download-row"><div><strong>Blinded evidence packet</strong><small>{latestManifest?.cases.length ?? 0} case(s), anonymized with relative timestamps</small></div><button className="secondary-button" onClick={() => { void downloadPacket(); }} disabled={!canDownloadPacket}><Download size={14}/> Download JSON</button></div>
            <div className="independent-review-download-row"><div><strong>Reviewer response template</strong><small>Decision, candidate stage, record aliases, limitations and rationale</small></div><button className="secondary-button" onClick={importTemplate} disabled={!templateCsv || Boolean(packetIntegrityError)}><Download size={14}/> Download CSV</button></div>
            <div className="independent-review-download-row"><div><strong>Reviewer protocol</strong><small>Decision definitions, packet binding, privacy and response rules</small></div><button className="secondary-button" onClick={downloadProtocol} disabled={!latestManifest || Boolean(packetIntegrityError)}><Download size={14}/> Download protocol</button></div>
            <div className="independent-review-instructions"><strong>Give the reviewer only the JSON packet, protocol, and blank CSV.</strong><p>Do not share this project source or the private comparison key before their response is frozen. The reviewer must cite aliases such as R001, not original record IDs.</p></div>
          </div>}
          {packetIntegrityError && <div className="independent-review-error" role="alert"><AlertTriangle size={15}/><span>{packetIntegrityError}</span></div>}
          <div className="independent-review-upload"><label htmlFor="blind-review-response">3. Import completed reviewer response</label><p>Import a completed response CSV. It must include this packet&rsquo;s ID on every row, use valid record aliases for each case, and contain one response per case. Reviewer codes cannot be reused within this packet.</p><input id="blind-review-response" aria-label="Choose completed reviewer response CSV" type="file" accept=".csv,text/csv" disabled={busy || !packetId || !packetJson || Boolean(packetIntegrityError) || readOnly} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importReviewerResponse(file); }}/></div>
        </div>
      </div>
      {storedResults && latestManifest && storedResults.sessions.length > 0 && (() => {
        const aggregate: SessionAgreementSummary = compareReviewerSessions(latestManifest.cases, storedResults.sessions);
        return <div className="independent-review-results">
          <div className="independent-review-section-title"><strong>Reviewer comparison</strong><span>{aggregate.reviewerSessionCount} reviewer session(s) recorded</span></div>
          <div className="independent-review-metrics"><div><small>Reviewer-case decisions</small><strong>{aggregate.reviewed}</strong></div><div><small>Decision agreement vs engine</small><strong>{aggregate.decisionAgreement === null ? '—' : `${(aggregate.decisionAgreement * 100).toFixed(1)}%`}</strong></div><div><small>Inter-reviewer agreement</small><strong>{aggregate.interReviewerDecisionAgreement === null ? 'Need ≥2 reviewers per case' : `${(aggregate.interReviewerDecisionAgreement * 100).toFixed(1)}%`}</strong></div><div><small>Potential over-attribution disagreements</small><strong>{aggregate.reviewerCandidateEngineAbstain}</strong></div></div>
          <p className="independent-review-caveat"><ShieldAlert size={15}/> Agreement measures differences between reviewers and WaterChain&rsquo;s rule engine. Neither is a gold standard. It is not diagnostic accuracy, validation of causal claims, or evidence of product effectiveness.</p>
          <div className="independent-review-reviewer-list"><strong>Individual reviewers</strong>{storedResults.sessions.map((session) => <div key={session.reviewerCode} className="independent-review-reviewer-row"><div><strong>{session.reviewerCode}</strong><small>{session.reviewerRole || 'Role not supplied'} · {session.responses.length} cases · {new Date(session.importedAt).toLocaleString()}</small></div><span>{session.summary.decisionAgreement === null ? '—' : `${(session.summary.decisionAgreement * 100).toFixed(1)}% agreement`}</span></div>)}</div>
          {aggregate.decisionDisagreements.length > 0 || aggregate.stageDisagreements.length > 0 ? <details className="independent-review-disagreements"><summary>Inspect disagreements ({aggregate.decisionDisagreements.length + aggregate.stageDisagreements.length})</summary><div className="independent-review-disagreement-list">{aggregate.decisionDisagreements.map((item, index) => <div key={`decision-${item.reviewerCode}-${item.reviewCaseId}-${index}`}><strong>{item.reviewerCode} · {item.reviewCaseId}: engine {decisionLabel(item.engine)} / reviewer {decisionLabel(item.reviewer)}</strong><p>{item.rationale || 'No reviewer rationale supplied.'}</p></div>)}{aggregate.stageDisagreements.map((item, index) => <div key={`stage-${item.reviewerCode}-${item.reviewCaseId}-${index}`}><strong>{item.reviewerCode} · {item.reviewCaseId}: candidate-stage disagreement</strong><p>Engine: {item.engineStage ?? 'none'}; reviewer: {item.reviewerStage ?? 'none'}. {item.rationale}</p></div>)}</div></details> : <div className="independent-review-success"><CheckCircle2 size={15}/><span>No decision/stage disagreements were recorded in the imported responses. This does not prove either party is correct.</span></div>}
          <button className="secondary-button" onClick={() => downloadFile(`waterchain-review-comparison-${packetId?.slice(-8)}.json`, JSON.stringify({ schema: 'waterchain-review-comparison-v1', packetId, comparisonMethod: 'descriptive agreement against a rule-based prototype; no gold-standard truth claim', sessions: storedResults.sessions, summary: aggregate, limitations: ['A reviewer-engine agreement score is not accuracy.', 'Engine output is not a gold standard.', 'Cases in a packet may be synthetic or user-provided; inspect packet context.', 'Agreement does not establish real-world diagnostic accuracy or causation.', 'A single reviewer session is formative only; inter-reviewer agreement requires at least two reviewers rating the same cases.'] }, null, 2), 'application/json;charset=utf-8')}><Download size={14}/> Export comparison report</button>
        </div>;
      })()}
      <div className="independent-review-footer">The private comparison key is stored only in this browser. Clearing browser data can make returned responses impossible to score; retain your investigation backup. No reviewer has reviewed a case until an actual response is received and assessed.</div>
    </section>
  );
}
