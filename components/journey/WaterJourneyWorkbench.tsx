'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Archive, ArrowRight, CheckCircle2, ClipboardCheck, FileCheck2, Fingerprint, GitBranch, Link2, Plus, ShieldAlert, Trash2, UploadCloud } from 'lucide-react';
import { stages, type EvidenceRecord, type EvidenceStage } from '@/lib/evidence';
import { type DiagnosticReport } from '@/lib/diagnostics';
import { deleteArtifactFile, getArtifactFile, getVerifiedArtifactFile, putArtifactFile } from '@/lib/provenance-vault';
import {
  appendAuditEvent, assessJourney, auditEventSchema, emptyJourneyWorkspace, planNextActions, provenanceArtifactSchema,
  samplingEventSchema, transferEventSchema, waterJourneySchema, waterSourceSchema, verifyAuditChain,
  type JourneyAssessment, type JourneyWorkspaceData, type SelectedJourneyModel, type ProvenanceArtifact,
  artifactKinds, journeyStatusValues, linkBasisValues, transferBasisValues, transferKinds, sourceKinds,
} from '@/lib/investigation-model';

const linkLabels: Record<(typeof linkBasisValues)[number], string> = {
  directly_documented: 'Directly documented', associated_visit: 'Associated through same field visit', self_reported: 'Self-reported', unconfirmed: 'Unconfirmed',
};
const transferLabels: Record<(typeof transferBasisValues)[number], string> = {
  documented: 'Documented in field record', observed: 'Directly observed', self_reported: 'Self-reported', inferred: 'Inferred', unverified: 'Unverified',
};
const artifactLabels: Record<(typeof artifactKinds)[number], string> = {
  laboratory_report: 'Laboratory report', field_note: 'Field note', chain_of_custody: 'Chain-of-custody record', sample_photo: 'Sample / container photo', calibration_record: 'Calibration record', other: 'Other',
};
const stageDisplay: Record<EvidenceStage, string> = { source: 'Source', collection: 'Collection / transport', storage: 'Storage', serving: 'Serving' };
const journeyStatusLabels: Record<(typeof journeyStatusValues)[number], string> = { intake: 'Intake / planning', sampling: 'Sampling in progress', evidence_review: 'Evidence quality review', assessment: 'Diagnostic assessment', follow_up: 'Follow-up action', closed: 'Closed with documented disposition' };

type Store = JourneyWorkspaceData & { selectedJourneyId: string | null };
function blankStore(): Store { return { ...emptyJourneyWorkspace(), selectedJourneyId: null }; }
function safeNullable(value: string) { const v = value.trim(); return v || null; }
function saveFile(name: string, payload: string, mime: string) {
  const url = URL.createObjectURL(new Blob([payload], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function WaterJourneyWorkbench({
  workspaceId, workspaceName, records, report, reportStale, readOnly = false, onNotice, onJourneyModelChange,
}: {
  workspaceId: string; workspaceName: string; records: EvidenceRecord[]; report: DiagnosticReport | null; reportStale: boolean;
  readOnly?: boolean; onNotice?: (message: string) => void; onJourneyModelChange?: (model: SelectedJourneyModel | null) => void;
}) {
  const [store, setStore] = useState<Store>(blankStore);
  const storeRef = useRef<Store>(blankStore());
  const [hydrated, setHydrated] = useState(false);
  const [writable, setWritable] = useState(true);
  const [localError, setLocalError] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceIdentifier, setSourceIdentifier] = useState('');
  const [editSourceIdentifier, setEditSourceIdentifier] = useState('');
  const [sourceKind, setSourceKind] = useState<(typeof sourceKinds)[number]>('borehole');
  const [sourceLocation, setSourceLocation] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [journeyName, setJourneyName] = useState('');
  const [journeyDescription, setJourneyDescription] = useState('');
  const [existingSourceId, setExistingSourceId] = useState('');
  const [existingJourneyName, setExistingJourneyName] = useState('');
  const [existingJourneyDescription, setExistingJourneyDescription] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<(typeof journeyStatusValues)[number]>('intake');
  const [workflowCloseoutNote, setWorkflowCloseoutNote] = useState('');
  const [sampleRecordId, setSampleRecordId] = useState('');
  const [sampleBasis, setSampleBasis] = useState<(typeof linkBasisValues)[number]>('directly_documented');
  const [sampleRef, setSampleRef] = useState('');
  const [sampleEntityRef, setSampleEntityRef] = useState('');
  const [sampleNotes, setSampleNotes] = useState('');
  const [transferFrom, setTransferFrom] = useState<EvidenceStage>('source');
  const [transferKind, setTransferKind] = useState<(typeof transferKinds)[number]>('collection');
  const [transferTime, setTransferTime] = useState('');
  const [transferFromEntityRef, setTransferFromEntityRef] = useState('');
  const [transferToEntityRef, setTransferToEntityRef] = useState('');
  const [transferBasis, setTransferBasis] = useState<(typeof transferBasisValues)[number]>('documented');
  const [transferRef, setTransferRef] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [artifactRecordId, setArtifactRecordId] = useState('');
  const [artifactKind, setArtifactKind] = useState<(typeof artifactKinds)[number]>('laboratory_report');
  const [artifactRef, setArtifactRef] = useState('');
  const [artifactVerification, setArtifactVerification] = useState<'unreviewed' | 'reviewed_against_original' | 'independently_checked'>('unreviewed');
  const [artifactNote, setArtifactNote] = useState('');
  const [artifactVaultStatus, setArtifactVaultStatus] = useState<Record<string, 'checking' | 'present' | 'missing' | 'fingerprint_only' | 'mismatch'>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const recordFingerprint = useRef<string | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; checked: number; error?: string } | null>(null);
  const [ledgerFileStatus, setLedgerFileStatus] = useState<string | null>(null);
  const storageKey = `waterchain:journey-model:v1:${workspaceId}`;

  const installStore = useCallback((next: Store) => { storeRef.current = next; setStore(next); }, []);

  useEffect(() => {
    setHydrated(false); setWritable(true); setLocalError(''); setChainStatus(null); onJourneyModelChange?.(null);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) { installStore(blankStore()); }
      else {
        const parsed = JSON.parse(raw) as Partial<Store>;
        const schemas = [
          ['sources', waterSourceSchema], ['journeys', waterJourneySchema], ['samplingEvents', samplingEventSchema],
          ['transferEvents', transferEventSchema], ['artifacts', provenanceArtifactSchema],
        ] as const;
        let malformed = false;
        const data = blankStore();
        for (const [key, schema] of schemas) {
          const rows = (parsed as Record<string, unknown>)[key];
          if (!Array.isArray(rows)) { if (rows !== undefined) malformed = true; continue; }
          const valid: unknown[] = [];
          for (const row of rows) {
            const result = schema.safeParse(row);
            if (result.success) valid.push(result.data);
            else malformed = true;
          }
          Object.assign(data, { [key]: valid });
        }
        if (parsed.version !== 1) malformed = true;
        data.selectedJourneyId = typeof parsed.selectedJourneyId === 'string' ? parsed.selectedJourneyId : null;
        const auditRows = Array.isArray(parsed.auditEvents) ? parsed.auditEvents : [];
        const validAuditRows = auditRows.filter((row) => auditEventSchema.safeParse(row).success);
        data.auditEvents = validAuditRows as JourneyWorkspaceData['auditEvents'];
        if (validAuditRows.length !== auditRows.length) malformed = true;
        if (malformed) {
          setWritable(false);
          setLocalError('Some saved water-journey data is incompatible with this version. Automatic saving is paused so the original browser data is not overwritten. Export a backup before making changes.');
        }
        installStore(data);
        void verifyAuditChain(data.auditEvents).then(setChainStatus);
      }
    } catch {
      setWritable(false); setLocalError('The relationship ledger could not be read. Automatic saving is paused to protect the existing browser data.');
      installStore(blankStore());
    } finally { setHydrated(true); }
  }, [storageKey, installStore, onJourneyModelChange]);

  useEffect(() => {
    if (!hydrated || !writable || readOnly) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(store)); }
    catch { setWritable(false); setLocalError('Browser storage is unavailable or full. Relationship-ledger editing is paused; export the ledger if possible.'); }
  }, [store, hydrated, writable, readOnly, storageKey]);

  const selectedJourney = store.journeys.find((journey) => journey.id === store.selectedJourneyId) ?? null;
  const selectedSource = selectedJourney ? store.sources.find((source) => source.id === selectedJourney.sourceId) ?? null : null;
  const selectedModel = useMemo<SelectedJourneyModel | null>(() => {
    if (!selectedJourney || !selectedSource) return null;
    return {
      journey: selectedJourney, source: selectedSource,
      samplingEvents: store.samplingEvents.filter((event) => event.journeyId === selectedJourney.id),
      transferEvents: store.transferEvents.filter((event) => event.journeyId === selectedJourney.id),
    };
  }, [selectedJourney, selectedSource, store.samplingEvents, store.transferEvents]);
  const assessment: JourneyAssessment | null = useMemo(() => selectedModel ? assessJourney(selectedModel, records, report, reportStale) : null, [selectedModel, records, report, reportStale]);
  const nextActions = useMemo(() => assessment ? planNextActions(assessment) : [], [assessment]);
  const linkedRecordIds = new Set(store.samplingEvents.filter((event) => event.journeyId === selectedJourney?.id).map((event) => event.evidenceRecordId));
  // Step 12 audit fix: the same evidence record can be linked to more than one
  // journey in an investigation. The engine judges one journey model at a time
  // and cannot see that, so surface it here instead of letting one observation
  // silently support two paths.
  const otherJourneyLinks = new Map<string, string[]>();
  for (const event of store.samplingEvents) {
    if (event.journeyId === selectedJourney?.id) continue;
    const name = store.journeys.find((journey) => journey.id === event.journeyId)?.name || 'another journey';
    const names = otherJourneyLinks.get(event.evidenceRecordId) || [];
    if (!names.includes(name)) names.push(name);
    otherJourneyLinks.set(event.evidenceRecordId, names);
  }
  const unlinkedRecords = records.filter((record) => !linkedRecordIds.has(record.id));
  const selectedSamplingEvents = store.samplingEvents.filter((event) => event.journeyId === selectedJourney?.id);
  const selectedTransfers = store.transferEvents.filter((event) => event.journeyId === selectedJourney?.id);
  const selectedArtifacts = store.artifacts.filter((artifact) => artifact.journeyId === selectedJourney?.id || (artifact.journeyId === null && artifact.evidenceRecordId && selectedSamplingEvents.some((event) => event.evidenceRecordId === artifact.evidenceRecordId)));

  useEffect(() => { onJourneyModelChange?.(selectedModel); }, [selectedModel, onJourneyModelChange]);
  useEffect(() => { setEditSourceIdentifier(selectedSource?.sourceIdentifier || ''); }, [selectedSource?.id, selectedSource?.sourceIdentifier]);
  useEffect(() => { setWorkflowStatus(selectedJourney?.status || 'intake'); setWorkflowCloseoutNote(selectedJourney?.closeoutNote || ''); }, [selectedJourney?.id, selectedJourney?.status, selectedJourney?.closeoutNote]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    for (const artifact of store.artifacts) {
      if (artifact.contentStorage !== 'browser_local') {
        setArtifactVaultStatus((current) => ({ ...current, [artifact.id]: 'fingerprint_only' }));
        continue;
      }
      setArtifactVaultStatus((current) => ({ ...current, [artifact.id]: 'checking' }));
      void getVerifiedArtifactFile(artifact.id, artifact.sha256).then(() => {
        if (!cancelled) setArtifactVaultStatus((current) => ({ ...current, [artifact.id]: 'present' }));
      }).catch(async () => {
        if (cancelled) return;
        const existing = await getArtifactFile(artifact.id).catch(() => null);
        if (!cancelled) setArtifactVaultStatus((current) => ({ ...current, [artifact.id]: existing ? 'mismatch' : 'missing' }));
      });
    }
    return () => { cancelled = true; };
  }, [hydrated, store.artifacts]);

  useEffect(() => {
    if (!hydrated) return;
    const fingerprint = JSON.stringify(records.map((record) => ({ id: record.id, recordCode: record.recordCode, sampleCode: record.sampleCode, stage: record.stage, collectedAt: record.collectedAt, result: record.result, sourceReference: record.sourceReference })));
    if (recordFingerprint.current === null) { recordFingerprint.current = fingerprint; return; }
    if (recordFingerprint.current === fingerprint) return;
    recordFingerprint.current = fingerprint;
    void (async () => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
      const snapshotHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      await enqueueAudit({ eventType: 'evidence_register_changed', entityType: 'evidence_register', entityId: workspaceId, summary: `Evidence register changed; ${records.length} record(s) observed. Snapshot SHA-256: ${snapshotHash}.` });
    })();
    // The audit entry is a local integrity aid, not authenticated identity or server-side audit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, hydrated, workspaceId]);

  function enqueueAudit(input: Omit<Parameters<typeof appendAuditEvent>[1], 'actorLabel'>): Promise<void> {
    const nextOperation = queueRef.current.then(async () => {
      const current = storeRef.current;
      const event = await appendAuditEvent(current, { ...input, actorLabel: 'Local browser user' });
      const next: Store = { ...current, auditEvents: [...current.auditEvents, event] };
      installStore(next);
      setChainStatus(await verifyAuditChain(next.auditEvents));
    });
    queueRef.current = nextOperation.catch(() => undefined);
    return nextOperation;
  }

  function patchStore(patch: (current: Store) => Store, audit: Omit<Parameters<typeof appendAuditEvent>[1], 'actorLabel'>) {
    queueRef.current = queueRef.current.then(async () => {
      const current = storeRef.current;
      const event = await appendAuditEvent(current, { ...audit, actorLabel: 'Local browser user' });
      const modified = patch(current);
      const next = { ...modified, auditEvents: [...modified.auditEvents, event] };
      installStore(next);
      setChainStatus(await verifyAuditChain(next.auditEvents));
    }).catch((error) => { setLocalError(error instanceof Error ? error.message : 'Could not update the local relationship ledger.'); });
  }

  function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (readOnly || !writable || !sourceName.trim() || !sourceIdentifier.trim()) return;
    const now = new Date().toISOString();
    const source = waterSourceSchema.parse({ id: crypto.randomUUID(), name: sourceName.trim(), kind: sourceKind, sourceIdentifier: sourceIdentifier.trim(), locationLabel: safeNullable(sourceLocation), sourceReference: safeNullable(sourceRef), notes: null, createdAt: now });
    const journey = waterJourneySchema.parse({ id: crypto.randomUUID(), name: journeyName.trim() || `${source.name} water journey`, sourceId: source.id, description: safeNullable(journeyDescription), startedAt: null, householdOrSiteRef: null, createdAt: now, updatedAt: now });
    patchStore((current) => ({ ...current, sources: [...current.sources, source], journeys: [journey, ...current.journeys], selectedJourneyId: journey.id }), {
      eventType: 'journey_created', entityType: 'water_journey', entityId: journey.id, summary: `Created water journey “${journey.name}” with source “${source.name}”.`, 
    });
    onNotice?.(`Created water journey “${journey.name}”. No sample results were generated.`);
    setSourceName(''); setSourceIdentifier(''); setSourceLocation(''); setSourceRef(''); setJourneyName(''); setJourneyDescription('');
  }

  function createJourneyFromExistingSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !writable || !existingSourceId || !existingJourneyName.trim()) return;
    const source = storeRef.current.sources.find((item) => item.id === existingSourceId);
    if (!source) { setLocalError('Select an existing registered source.'); return; }
    const now = new Date().toISOString();
    const journey = waterJourneySchema.parse({
      id: crypto.randomUUID(), name: existingJourneyName.trim(), sourceId: source.id,
      description: safeNullable(existingJourneyDescription), startedAt: null, householdOrSiteRef: null,
      createdAt: now, updatedAt: now,
    });
    patchStore((current) => ({ ...current, journeys: [journey, ...current.journeys], selectedJourneyId: journey.id }), {
      eventType: 'journey_created_for_existing_source', entityType: 'water_journey', entityId: journey.id,
      summary: `Created a separate journey “${journey.name}” for existing source “${source.name}”.`,
    });
    onNotice?.(`Created a new journey for ${source.name}. Source samples can be contextual references; downstream samples must still be explicitly linked with evidence.`);
    setExistingJourneyName(''); setExistingJourneyDescription(''); setLocalError('');
  }

  function saveJourneyWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJourney || readOnly || !writable) return;
    if (workflowStatus === 'closed' && !workflowCloseoutNote.trim()) {
      setLocalError('Add a short disposition note before closing this investigation. Closing is administrative; it does not certify that water is safe.');
      return;
    }
    const now = new Date().toISOString();
    const status = workflowStatus;
    const closeoutNote = safeNullable(workflowCloseoutNote);
    patchStore((current) => ({
      ...current,
      journeys: current.journeys.map((journey) => journey.id === selectedJourney.id
        ? { ...journey, status, closeoutNote, updatedAt: now }
        : journey),
    }), {
      eventType: 'journey_workflow_status_changed', entityType: 'water_journey', entityId: selectedJourney.id,
      summary: `Changed investigation stage for “${selectedJourney.name}” to ${journeyStatusLabels[status]}.${status === 'closed' ? ` Disposition: ${closeoutNote}` : ''}`,
    });
    setLocalError('');
    onNotice?.(`Investigation stage saved: ${journeyStatusLabels[status]}. This administrative status is not a water-safety certification.`);
  }

  function saveSourceIdentifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSource || !selectedJourney || readOnly || !writable || !editSourceIdentifier.trim()) return;
    const nextIdentifier = editSourceIdentifier.trim();
    const now = new Date().toISOString();
    patchStore((current) => ({ ...current, sources: current.sources.map((source) => source.id === selectedSource.id ? { ...source, sourceIdentifier: nextIdentifier } : source), journeys: current.journeys.map((journey) => journey.id === selectedJourney.id ? { ...journey, updatedAt: now } : journey) }), {
      eventType: 'source_identifier_mapping_updated', entityType: 'water_source', entityId: selectedSource.id,
      summary: `Updated recorded source-ID mapping for “${selectedSource.name}”. Verify that it exactly matches the source identifier recorded on linked evidence.`,
    });
    setLocalError('');
    onNotice?.('Source-ID mapping saved. Run a fresh diagnostic review to apply it to the selected journey.');
  }

  function addSamplingEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedJourney || !sampleRecordId || readOnly || !writable) return;
    const record = records.find((item) => item.id === sampleRecordId);
    if (!record) { setLocalError('Select an existing evidence record.'); return; }
    if (['directly_documented', 'associated_visit'].includes(sampleBasis) && !sampleRef.trim()) { setLocalError('Enter the real field/visit reference required for this relationship basis, or choose a weaker basis and accept that the engine will not attribute a transition.'); return; }
    if (['directly_documented', 'associated_visit'].includes(sampleBasis) && !sampleEntityRef.trim()) { setLocalError('Enter the real water/container entity ID so this sample can be connected to the transfer graph.'); return; }
    if (record.stage === 'source' && selectedSource?.sourceIdentifier && sampleEntityRef.trim().toLocaleLowerCase() !== selectedSource.sourceIdentifier.trim().toLocaleLowerCase()) { setLocalError('The Source-stage entity ID must match the selected source’s recorded source ID.'); return; }
    if (selectedSamplingEvents.some((item) => item.evidenceRecordId === record.id)) { setLocalError('That evidence record is already linked to this journey. Use a distinct record for a distinct sample event.'); return; }
    const now = new Date().toISOString();
    const row = samplingEventSchema.parse({ id: crypto.randomUUID(), journeyId: selectedJourney.id, evidenceRecordId: record.id, stage: record.stage, sampledAt: record.collectedAt, waterEntityRef: safeNullable(sampleEntityRef), relationshipBasis: sampleBasis, relationshipReference: safeNullable(sampleRef), notes: safeNullable(sampleNotes), createdAt: now });
    patchStore((current) => ({ ...current, samplingEvents: [...current.samplingEvents, row], journeys: current.journeys.map((journey) => journey.id === selectedJourney.id ? { ...journey, updatedAt: now } : journey) }), {
      eventType: 'sampling_event_linked', entityType: 'sampling_event', entityId: row.id, summary: `Linked evidence ${record.recordCode} to “${selectedJourney.name}” at ${stageDisplay[record.stage]}. Relationship basis: ${linkLabels[sampleBasis]}.`, 
    });
    setSampleRecordId(''); setSampleRef(''); setSampleEntityRef(''); setSampleNotes(''); setLocalError('');
  }

  function addTransferEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedJourney || readOnly || !writable) return;
    const fromIndex = stages.indexOf(transferFrom);
    if (fromIndex < 0 || fromIndex >= stages.length - 1) { setLocalError('Choose a valid adjacent-stage transfer.'); return; }
    const toStage = stages[fromIndex + 1];
    if (transferBasis === 'documented' && !transferRef.trim()) { setLocalError('A documented transfer requires a real field-log or source-document reference.'); return; }
    if (transferBasis === 'observed' && !transferRef.trim() && !transferNotes.trim()) { setLocalError('A directly observed transfer needs a reference or an explanatory observation note.'); return; }
    if (['documented', 'observed'].includes(transferBasis) && (!transferFromEntityRef.trim() || !transferToEntityRef.trim())) { setLocalError('Directly supported transfers require both the physical from-entity ID and to-entity ID.'); return; }
    if (transferFrom === 'source' && selectedSource?.sourceIdentifier && transferFromEntityRef.trim().toLocaleLowerCase() !== selectedSource.sourceIdentifier.trim().toLocaleLowerCase()) { setLocalError('The first transfer must start from the selected source ID.'); return; }
    const now = new Date().toISOString();
    const row = transferEventSchema.parse({ id: crypto.randomUUID(), journeyId: selectedJourney.id, fromStage: transferFrom, toStage, fromEntityRef: safeNullable(transferFromEntityRef), toEntityRef: safeNullable(transferToEntityRef), transferKind, occurredAt: transferTime ? new Date(transferTime).toISOString() : null, evidenceBasis: transferBasis, sourceReference: safeNullable(transferRef), notes: safeNullable(transferNotes), createdAt: now });
    patchStore((current) => ({ ...current, transferEvents: [...current.transferEvents, row], journeys: current.journeys.map((journey) => journey.id === selectedJourney.id ? { ...journey, updatedAt: now } : journey) }), {
      eventType: 'transfer_event_added', entityType: 'transfer_event', entityId: row.id, summary: `Added ${stageDisplay[row.fromStage]} → ${stageDisplay[row.toStage]} transfer for “${selectedJourney.name}”. Basis: ${transferLabels[transferBasis]}.`, 
    });
    setTransferTime(''); setTransferRef(''); setTransferNotes(''); setLocalError('');
    setTransferFromEntityRef(transferToEntityRef.trim()); setTransferToEntityRef('');
  }


  function removeSamplingEvent(eventId: string) {
    if (!selectedJourney || readOnly || !writable) return;
    const row = selectedSamplingEvents.find((event) => event.id === eventId);
    if (!row) return;
    const record = records.find((item) => item.id === row.evidenceRecordId);
    patchStore((current) => ({ ...current, samplingEvents: current.samplingEvents.filter((event) => event.id !== eventId), journeys: current.journeys.map((journey) => journey.id === selectedJourney.id ? { ...journey, updatedAt: new Date().toISOString() } : journey) }), {
      eventType: 'sampling_event_removed', entityType: 'sampling_event', entityId: row.id,
      summary: `Removed relationship link for ${record?.recordCode || row.evidenceRecordId} from “${selectedJourney.name}”. The evidence record itself was retained.`,
    });
    setLocalError('');
  }

  function removeTransferEvent(eventId: string) {
    if (!selectedJourney || readOnly || !writable) return;
    const row = selectedTransfers.find((event) => event.id === eventId);
    if (!row) return;
    patchStore((current) => ({ ...current, transferEvents: current.transferEvents.filter((event) => event.id !== eventId), journeys: current.journeys.map((journey) => journey.id === selectedJourney.id ? { ...journey, updatedAt: new Date().toISOString() } : journey) }), {
      eventType: 'transfer_event_removed', entityType: 'transfer_event', entityId: row.id,
      summary: `Removed ${stageDisplay[row.fromStage]} → ${stageDisplay[row.toStage]} transfer relationship from “${selectedJourney.name}”.`,
    });
    setLocalError('');
  }

  async function removeArtifact(artifactId: string) {
    if (!selectedJourney || readOnly || !writable) return;
    const row = selectedArtifacts.find((artifact) => artifact.id === artifactId);
    if (!row) return;
    try {
      if (row.contentStorage === 'browser_local') await deleteArtifactFile(row.id);
      patchStore((current) => ({ ...current, artifacts: current.artifacts.filter((artifact) => artifact.id !== artifactId) }), {
        eventType: 'provenance_artifact_removed', entityType: 'provenance_artifact', entityId: row.id,
        summary: `Removed provenance metadata for ${row.fileName}; deleted its browser-local original when present.`,
      });
      setArtifactVaultStatus((current) => { const next = { ...current }; delete next[artifactId]; return next; });
      setLocalError('');
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not remove the browser-local original file.'); }
  }

  async function downloadVerifiedArtifact(artifact: ProvenanceArtifact) {
    try {
      const stored = await getVerifiedArtifactFile(artifact.id, artifact.sha256);
      const url = URL.createObjectURL(new Blob([stored.blob], { type: stored.mimeType }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = stored.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotice?.(`SHA-256 verified for ${stored.fileName} before download.`);
    } catch (error) {
      setArtifactVaultStatus((current) => ({ ...current, [artifact.id]: 'mismatch' }));
      setLocalError(error instanceof Error ? error.message : 'The browser-local original could not be verified.');
    }
  }

  async function addArtifact(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !selectedJourney || readOnly || !writable) return;
    if (file.size > 10_000_000) { setLocalError('Original document limit is 10 MB per file.'); return; }
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      let contentStorage: 'browser_local' | 'external_reference_only' = 'external_reference_only';
      let vaultMessage = 'Only the file fingerprint and metadata were saved; original bytes remain external.';
      const id = crypto.randomUUID();
      try {
        await putArtifactFile(file, id, sha256);
        contentStorage = 'browser_local';
        vaultMessage = 'Original document and SHA-256 fingerprint stored in this browser only.';
        setArtifactVaultStatus((current) => ({ ...current, [id]: 'present' }));
      } catch (vaultError) {
        vaultMessage = `Fingerprint saved without local original-file retention: ${vaultError instanceof Error ? vaultError.message : 'browser storage unavailable'}`;
        setArtifactVaultStatus((current) => ({ ...current, [id]: 'fingerprint_only' }));
      }
      const artifact = provenanceArtifactSchema.parse({ id, journeyId: selectedJourney.id, evidenceRecordId: artifactRecordId || null, fileName: file.name, artifactKind, byteLength: file.size, sha256, sourceReference: safeNullable(artifactRef), recordedAt: new Date().toISOString(), verificationStatus: artifactVerification, contentStorage, note: safeNullable(artifactNote) });
      patchStore((current) => ({ ...current, artifacts: [...current.artifacts, artifact] }), {
        eventType: 'provenance_artifact_recorded', entityType: 'provenance_artifact', entityId: artifact.id,
        summary: `Recorded SHA-256 provenance for ${artifact.fileName}; storage mode: ${contentStorage}. ${vaultMessage}`,
      });
      onNotice?.(`${vaultMessage} Hashes detect content changes; they do not authenticate the document.`);
      setArtifactRef(''); setArtifactNote(''); setLocalError('');
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Could not fingerprint the selected document.'); }
  }

  async function exportRelationshipLedger() {
    const current = storeRef.current;
    const payload = { schema: 'waterchain-relationship-ledger-v1', exportedAt: new Date().toISOString(), workspace: { id: workspaceId, name: workspaceName }, data: current,
      notice: 'Local relationship/provenance metadata export. Original laboratory/field files are not embedded; document hashes identify file content but do not authenticate it.', privacyNotice: 'Contains sample identifiers, notes and source references. Share only with authorized reviewers.' };
    saveFile(`waterchain-${workspaceName.replace(/[^a-z0-9_-]+/gi, '-')}-relationship-ledger.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  async function checkAuditChain() { setChainStatus(await verifyAuditChain(storeRef.current.auditEvents)); }

  // Step 12 audit fix: an exported ledger could previously only be verified
  // while it was still the live store. Re-verify an exported JSON file here.
  async function verifyLedgerFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const rows = Array.isArray(parsed) ? parsed : (parsed as { data?: { auditEvents?: unknown } })?.data?.auditEvents;
      if (!Array.isArray(rows)) { setLedgerFileStatus('That file does not contain a WaterChain audit event list.'); return; }
      const validRows = rows.filter((row) => auditEventSchema.safeParse(row).success);
      if (validRows.length !== rows.length) { setLedgerFileStatus(`That file contains ${rows.length - validRows.length} row(s) that do not match the audit event schema; it cannot be verified as an intact ledger.`); return; }
      const result = await verifyAuditChain(validRows as Parameters<typeof verifyAuditChain>[0]);
      setLedgerFileStatus(result.valid ? `Exported ledger verified: ${result.checked} event(s), hash links intact.` : `Exported ledger problem after ${result.checked} event(s): ${result.error}`);
    } catch { setLedgerFileStatus('Could not read that ledger file.'); }
  }
  const noEvidenceYet = records.length === 0;

  return (
    <section className="panel journey-workbench" id="water-journey-model">
      <div className="panel-header journey-header">
        <div><div className="panel-kicker">FIELDWORK FOUNDATION / RELATIONSHIP MODEL</div><h2>Water journey & sampling events</h2><p>Represent related sampling events and documented transfers without pretending that separate sample bottles are the same physical sample.</p></div>
        <button className="secondary-button" onClick={exportRelationshipLedger}><Archive size={15}/> Export relationship ledger</button>
      </div>
      <div className="journey-body">
        <div className="journey-disclaimer"><ShieldAlert size={16}/><span><strong>Relationship evidence is user-entered.</strong> Hashes detect content changes but do not authenticate documents. A complete relationship map still does not prove contamination causation.</span></div>
        {localError && <div className="journey-error" role="alert">{localError}</div>}
        {!hydrated && <div className="journey-empty">Loading this investigation’s relationship ledger…</div>}
        {localError.includes('Automatic saving') && <div className="journey-warning" role="alert">{localError}</div>}
        {hydrated && !writable && <div className="journey-warning" role="alert">This relationship ledger is read-only to protect existing data.</div>}
        {hydrated && store.journeys.length === 0 && <div className="journey-empty"><div className="journey-empty-icon"><GitBranch size={20}/></div><strong>No water journey registered</strong><p>Create a source and a journey, then link existing sample records and add transfer evidence. No samples or results are created automatically.</p></div>}
        <div className="journey-grid">
          <form className="journey-form-card" onSubmit={createSource}>
            <div className="journey-form-heading"><span>01</span><div><strong>Create source & journey</strong><p>Start with a source and a named investigation path.</p></div></div>
            <label>Source name<input required maxLength={160} value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. Borehole BH-04" /></label>
            <label>Recorded source ID used in evidence records<input required maxLength={240} value={sourceIdentifier} onChange={(e) => setSourceIdentifier(e.target.value)} placeholder="Exact water-source ID from the Evidence Register" /><span className="journey-hint">This maps the source entity to the user-entered waterSourceId field. It is a consistency check, not independent source authentication.</span></label>
            <div className="journey-form-two"><label>Source type<select value={sourceKind} onChange={(e) => setSourceKind(e.target.value as (typeof sourceKinds)[number])}>{sourceKinds.map((kind) => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select></label><label>Location / site reference<input maxLength={240} value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} placeholder="Community or site" /></label></div>
            <label>Source document / external reference<input maxLength={500} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="Optional reference only" /></label>
            <label>Journey name<input maxLength={160} value={journeyName} onChange={(e) => setJourneyName(e.target.value)} placeholder="e.g. Household 08 · 12 Oct" /></label>
            <label>Investigation question / context<textarea maxLength={3000} value={journeyDescription} onChange={(e) => setJourneyDescription(e.target.value)} placeholder="What relationship or change are you investigating?" rows={2}/></label>
            <button className="primary-button" type="submit" disabled={readOnly || !writable || !hydrated || !sourceName.trim() || !sourceIdentifier.trim()}><Plus size={15}/> Create journey</button>
          </form>
          {store.sources.length > 0 && <form className="journey-form-card" onSubmit={createJourneyFromExistingSource}>
            <div className="journey-form-heading"><span>02</span><div><strong>Create journey from existing source</strong><p>Reuse a registered source for a separate household, site, or sampling visit without merging its evidence into another journey.</p></div></div>
            <label>Registered source<select required value={existingSourceId} onChange={(e) => setExistingSourceId(e.target.value)}><option value="">Select source</option>{store.sources.map((source) => <option value={source.id} key={source.id}>{source.name} · {source.sourceIdentifier || 'unmapped source ID'}</option>)}</select></label>
            <label>New journey name<input required maxLength={160} value={existingJourneyName} onChange={(e) => setExistingJourneyName(e.target.value)} placeholder="e.g. Household 08 · 12 Oct" /></label>
            <label>Visit / household context<textarea rows={2} maxLength={3000} value={existingJourneyDescription} onChange={(e) => setExistingJourneyDescription(e.target.value)} placeholder="Separate visit details; don't imply water-transfer linkage without evidence" /></label>
            <button className="secondary-button" type="submit" disabled={readOnly || !writable || !hydrated || !existingSourceId || !existingJourneyName.trim()}><Plus size={15}/> Create separate journey</button>
          </form>}
          <div className="journey-form-card">
            <div className="journey-form-heading"><span>03</span><div><strong>Selected journey</strong><p>Manage its relationship evidence.</p></div></div>
            <label>Active water journey<select aria-label="Active water journey" value={store.selectedJourneyId ?? ''} disabled={!hydrated || store.journeys.length === 0} onChange={(e) => { installStore({ ...storeRef.current, selectedJourneyId: e.target.value || null }); setLocalError(''); }}><option value="">Choose a journey</option>{store.journeys.map((journey) => <option key={journey.id} value={journey.id}>{journey.name}</option>)}</select></label>
            {selectedJourney && selectedSource ? <><div className="journey-selected-card"><div className="journey-source-orb"><GitBranch size={18}/></div><div><strong>{selectedJourney.name}</strong><span>{selectedSource.name} · {selectedSource.kind.replaceAll('_', ' ')}{selectedSource.locationLabel ? ` · ${selectedSource.locationLabel}` : ''}</span><p>{selectedJourney.description || 'No context notes provided.'}</p></div></div><form className="journey-source-mapping" onSubmit={saveSourceIdentifier}><label>Source ID mapping<input required maxLength={240} value={editSourceIdentifier} onChange={(e) => setEditSourceIdentifier(e.target.value)} placeholder="Must match the Water-source ID in evidence" /></label><button className="secondary-button" type="submit" disabled={readOnly || !writable || !editSourceIdentifier.trim() || editSourceIdentifier.trim() === (selectedSource.sourceIdentifier || '')}>Save mapping</button>{selectedSource.sourceIdentifier ? <span>Current mapping: <strong>{selectedSource.sourceIdentifier}</strong></span> : <span className="journey-mapping-warning">Not mapped. Explicit pathway attribution remains blocked until this matches linked evidence records.</span>}</form><form className="journey-workflow-status" onSubmit={saveJourneyWorkflow}>
              <label>Investigation workflow stage<select aria-label="Investigation workflow stage" value={workflowStatus} onChange={(e) => setWorkflowStatus(e.target.value as (typeof journeyStatusValues)[number])}>{journeyStatusValues.map((status) => <option key={status} value={status}>{journeyStatusLabels[status]}</option>)}</select></label>
              <label>Disposition / closeout note {workflowStatus === 'closed' ? '(required)' : '(optional)'}<textarea rows={2} maxLength={3000} value={workflowCloseoutNote} onChange={(e) => setWorkflowCloseoutNote(e.target.value)} placeholder="Document completed actions, unresolved questions, reviewer, and follow-up ownership. Do not claim water is safe without adequate evidence." /></label>
              <button className="secondary-button" type="submit" disabled={readOnly || !writable || !hydrated || (workflowStatus === 'closed' && !workflowCloseoutNote.trim())}><ClipboardCheck size={15}/> Save investigation stage</button>
              <p className="journey-hint">Current stage: <strong>{journeyStatusLabels[selectedJourney.status || 'intake']}</strong>. Closing records an administrative disposition only; it does not certify water safety or resolve unsupported claims.</p>
            </form></> : <p className="journey-hint">Create or select a journey to link samples and transfers.</p>}
            <div className="journey-integrity-summary">
              <span><Activity size={14}/> {selectedSamplingEvents.length} sampling events</span><span><Link2 size={14}/> {selectedTransfers.length} transfer records</span><span><FileCheck2 size={14}/> {selectedArtifacts.length} document fingerprints</span>
            </div>
          </div>
        </div>

        {selectedJourney && <>
          <div className="journey-workflow-grid">
            <form className="journey-form-card" onSubmit={addSamplingEvent}>
              <div className="journey-form-heading"><span>04</span><div><strong>Link an existing sample</strong><p>Each event points to an actual Evidence Register record.</p></div></div>
              {unlinkedRecords.length === 0 ? <p className="journey-hint">There are no unlinked evidence records in this investigation. Add a sample to the Evidence Register first.</p> : <>
                <label>Evidence record<select required value={sampleRecordId} onChange={(e) => { const nextId = e.target.value; setSampleRecordId(nextId); const nextRecord = records.find((record) => record.id === nextId); setSampleEntityRef(nextRecord?.stage === 'source' ? (selectedSource?.sourceIdentifier || '') : ''); }}><option value="">Select existing sample record</option>{unlinkedRecords.map((record) => <option value={record.id} key={record.id}>{record.recordCode} · {stageDisplay[record.stage]} · {record.sampleCode}</option>)}</select></label>
                {sampleRecordId && otherJourneyLinks.get(sampleRecordId)?.length ? <p className="journey-warning">This record is already linked to {otherJourneyLinks.get(sampleRecordId)?.join(', ')}. Linking it here too means the same observation supports two paths — only do this deliberately, for example for a shared comparison sample.</p> : null}
                <label>Relationship basis<select value={sampleBasis} onChange={(e) => setSampleBasis(e.target.value as (typeof linkBasisValues)[number])}>{linkBasisValues.map((basis) => <option key={basis} value={basis}>{linkLabels[basis]}</option>)}</select></label>
                <label>Field record / visit reference<input maxLength={500} value={sampleRef} onChange={(e) => setSampleRef(e.target.value)} placeholder="Real field visit/sample-link reference" /></label>
                <label>Water entity / container ID<input required={['directly_documented', 'associated_visit'].includes(sampleBasis)} maxLength={240} value={sampleEntityRef} onChange={(e) => setSampleEntityRef(e.target.value)} placeholder="e.g. TRANSPORT-JERRY-17 or STORAGE-POT-17" /><span className="journey-hint">Use the same physical entity ID on its sampling event and connected transfer events. For the Source stage, use the recorded source ID.</span></label>
                <label>Relationship notes<textarea rows={2} maxLength={2000} value={sampleNotes} onChange={(e) => setSampleNotes(e.target.value)} placeholder="Explain how this sample relates to the journey" /></label>
                <button type="submit" className="secondary-button" disabled={readOnly || !writable || !sampleRecordId}><Link2 size={14}/> Link sample event</button>
              </>}
              {noEvidenceYet && <p className="journey-hint">No evidence records exist yet. Create records in the evidence register first.</p>}
            </form>

            <form className="journey-form-card" onSubmit={addTransferEvent}>
              <div className="journey-form-heading"><span>05</span><div><strong>Record a transfer</strong><p>Document how water moved; do not infer it from test results alone.</p></div></div>
              <div className="journey-transfer-arrow"><label>From stage<select value={transferFrom} onChange={(e) => { const next = e.target.value as EvidenceStage; setTransferFrom(next); const idx = stages.indexOf(next); if (idx < stages.length - 1) setTransferKind(idx === 0 ? 'collection' : idx === 1 ? 'container_transfer' : 'serving'); }}><option value="source">Source</option><option value="collection">Collection / transport</option><option value="storage">Storage</option></select></label><ArrowRight size={17}/><div><span>To stage</span><strong>{stageDisplay[stages[stages.indexOf(transferFrom) + 1] || 'serving']}</strong></div></div>
              <div className="journey-form-two"><label>Transfer type<select value={transferKind} onChange={(e) => setTransferKind(e.target.value as (typeof transferKinds)[number])}>{transferKinds.map((kind) => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select></label><label>When (if known)<input type="datetime-local" value={transferTime} onChange={(e) => setTransferTime(e.target.value)} /></label></div>
              <div className="journey-form-two"><label>From water/container entity ID<input maxLength={240} value={transferFromEntityRef} onChange={(e) => setTransferFromEntityRef(e.target.value)} placeholder="Must match previous stage's entity ID" /></label><label>To water/container entity ID<input maxLength={240} value={transferToEntityRef} onChange={(e) => setTransferToEntityRef(e.target.value)} placeholder="Must match next stage's sample entity ID" /></label></div>
              <label>Evidence basis<select value={transferBasis} onChange={(e) => setTransferBasis(e.target.value as (typeof transferBasisValues)[number])}>{transferBasisValues.map((basis) => <option key={basis} value={basis}>{transferLabels[basis]}</option>)}</select></label>
              <label>Transfer log / source reference<input maxLength={500} value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder="Reference to real transfer record" /></label>
              <label>Notes<textarea rows={2} maxLength={2000} value={transferNotes} onChange={(e) => setTransferNotes(e.target.value)} placeholder="Refill, mixing, container handoff, or unknowns" /></label>
              <button type="submit" className="secondary-button" disabled={readOnly || !writable}><Plus size={14}/> Add transfer evidence</button>
            </form>
          </div>

          <div className="journey-assessment-panel">
            <div className="journey-section-title"><div><div className="panel-kicker">LINEAGE REVIEW</div><h3>What does the relationship model support?</h3></div><span className={`journey-status journey-status-${assessment?.status || 'not_ready'}`}>{assessment?.status.replaceAll('_', ' ')}</span></div>
            {assessment?.pathCount !== null && assessment?.pathCount !== undefined && <div className={`journey-path-resolution ${assessment.pathCount === 1 ? 'path-resolved' : 'path-unresolved'}`} role="status"><strong>{assessment.pathCount === 1 ? 'One complete entity-connected route found' : assessment.pathCount === 0 ? 'No complete entity-connected route found' : 'Multiple complete entity-connected routes found'}</strong><span>{assessment.pathCount === 1 && assessment.selectedPathEntityRefs ? stages.map((stage) => `${stageDisplay[stage]}: ${assessment.selectedPathEntityRefs?.[stage] || 'unmapped'}`).join(' → ') : assessment.pathCount === 0 ? 'Review sample entity IDs and transfer from/to references. No transition attribution is supported until the selected journey has one complete route.' : 'Two or more routes are possible. The engine stops after finding a second distinct route; this is a multiple-route sentinel, not an exact count. Split the investigation or provide real evidence that resolves which route applies; do not choose a route merely to force a diagnosis.'}</span></div>}
            <div className="journey-stage-grid">{assessment?.stages.map((item, index) => <div className="journey-stage-card" key={item.stage}><div className="journey-stage-top"><span>{String(index + 1).padStart(2, '0')}</span><strong>{stageDisplay[item.stage]}</strong></div><div className="journey-stage-metrics"><div><b>{item.sampleEvents}</b><span>events</span></div><div><b>{item.eligibleRecords}</b><span>engine eligible</span></div><div><b>{item.positiveResults}</b><span>positive</span></div></div>{item.gaps.length > 0 && <ul>{item.gaps.map((gap, i) => <li key={`${item.stage}-${i}`}>{gap}</li>)}</ul>}</div>)}</div>
            <div className="journey-transfer-grid">{assessment?.transferEdges.map((edge) => <div className="journey-transfer-status" key={`${edge.fromStage}-${edge.toStage}`}><div><strong>{stageDisplay[edge.fromStage]} → {stageDisplay[edge.toStage]}</strong><span>{edge.count} event(s)</span></div><span className={`journey-edge-status edge-${edge.status}`}>{edge.status}</span></div>)}</div>
            <div className="journey-linked-ledgers">
              <div className="journey-linked-ledger"><div className="journey-linked-ledger-header"><strong>Linked sampling events</strong><span>{selectedSamplingEvents.length}</span></div>
                {selectedSamplingEvents.length === 0 ? <p className="journey-hint">No sample events linked yet.</p> : selectedSamplingEvents.map((event) => { const record = records.find((item) => item.id === event.evidenceRecordId); return <div className="journey-linked-row" key={event.id}><div><strong>{record?.recordCode || 'Missing evidence record'}</strong><span>{stageDisplay[event.stage]} · {linkLabels[event.relationshipBasis]} · {event.sampledAt || 'Time not recorded'}</span>{event.waterEntityRef && <small>Water/container entity: {event.waterEntityRef}</small>}{event.relationshipReference && <small>Reference: {event.relationshipReference}</small>}{otherJourneyLinks.get(event.evidenceRecordId)?.length ? <small>Also linked to: {otherJourneyLinks.get(event.evidenceRecordId)?.join(', ')} — the same observation is used in two investigation paths; interpret each path separately.</small> : null}</div><button type="button" className="journey-remove-button" disabled={readOnly || !writable} onClick={() => removeSamplingEvent(event.id)} aria-label={`Remove sampling event ${record?.recordCode || event.id}`}><Trash2 size={14}/> Remove link</button></div>; })}
              </div>
              <div className="journey-linked-ledger"><div className="journey-linked-ledger-header"><strong>Transfer records</strong><span>{selectedTransfers.length}</span></div>
                {selectedTransfers.length === 0 ? (
                  <p className="journey-hint">No transfer events documented yet.</p>
                ) : (
                  selectedTransfers.map((event) => (
                    <div className="journey-linked-row" key={event.id}>
                      <div>
                        <strong>{stageDisplay[event.fromStage]} → {stageDisplay[event.toStage]}</strong>
                        <span>{transferLabels[event.evidenceBasis]} · {event.occurredAt || 'Time not recorded'}</span>
                        <small>Entity path: {event.fromEntityRef || 'unmapped'} → {event.toEntityRef || 'unmapped'}</small>
                        {event.sourceReference && <small>Reference: {event.sourceReference}</small>}
                      </div>
                      <button type="button" className="journey-remove-button" disabled={readOnly || !writable} onClick={() => removeTransferEvent(event.id)} aria-label={`Remove transfer ${event.id}`}>
                        <Trash2 size={14}/> Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            {assessment?.blockers.length ? <div className="journey-blockers"><strong><ShieldAlert size={15}/> Before this relationship model is considered fully linked</strong><ul>{assessment.blockers.map((blocker, i) => <li key={i}>{blocker}</li>)}</ul></div> : <div className="journey-success"><CheckCircle2 size={16}/><span>All four stages and their adjacent transfers have sufficient relationship documentation for the engine&rsquo;s candidate-transition gate. This still does not establish causation.</span></div>}
          </div>

          <div className="journey-workflow-grid">
            <div className="journey-form-card">
              <div className="journey-form-heading"><span>06</span><div><strong>Document provenance</strong><p>Keep an optional browser-local original and record its SHA-256 fingerprint without claiming the document is authenticated.</p></div></div>
              <label>Artifact type<select value={artifactKind} onChange={(e) => setArtifactKind(e.target.value as (typeof artifactKinds)[number])}>{artifactKinds.map((kind) => <option key={kind} value={kind}>{artifactLabels[kind]}</option>)}</select></label>
              <label>Link to evidence record (optional)<select value={artifactRecordId} onChange={(e) => setArtifactRecordId(e.target.value)}><option value="">Journey-level artifact</option>{records.map((record) => <option key={record.id} value={record.id}>{record.recordCode} · {record.sampleCode}</option>)}</select></label>
              <label>External file/document reference<input maxLength={500} value={artifactRef} onChange={(e) => setArtifactRef(e.target.value)} placeholder="Repository, report ID, or controlled file path" /></label>
              <label>Review status<select value={artifactVerification} onChange={(e) => setArtifactVerification(e.target.value as typeof artifactVerification)}><option value="unreviewed">Unreviewed</option><option value="reviewed_against_original">Reviewed against original</option><option value="independently_checked">Independently checked (reviewer attests)</option></select></label>
              <label>Notes<textarea rows={2} maxLength={2000} value={artifactNote} onChange={(e) => setArtifactNote(e.target.value)} placeholder="Who reviewed it and what was checked?" /></label>
              <input ref={fileInput} type="file" className="visually-hidden" onChange={addArtifact} aria-label="Choose document to fingerprint" />
              <button type="button" className="secondary-button" disabled={readOnly || !writable} onClick={() => fileInput.current?.click()}><Fingerprint size={15}/> Choose file and record SHA-256</button>
              <p className="journey-hint">Files up to 10 MB can be retained in this browser via IndexedDB and re-hashed before download. If browser storage is unavailable, only the fingerprint and metadata are kept. Original files are not uploaded or shared; exported relationship ledgers contain metadata only. Hashes detect content changes but cannot prove a report is genuine.</p>
              {selectedArtifacts.length > 0 && <div className="journey-artifact-list">{selectedArtifacts.map((artifact) => <div className="journey-artifact" key={artifact.id}><FileCheck2 size={15}/><div><strong>{artifact.fileName}</strong><span>{artifactLabels[artifact.artifactKind]} · {artifact.verificationStatus.replaceAll('_', ' ')}</span><span>{artifactVaultStatus[artifact.id] === 'present' ? 'Original stored in this browser; hash verified' : artifactVaultStatus[artifact.id] === 'checking' ? 'Checking local original…' : artifactVaultStatus[artifact.id] === 'missing' ? 'Local original missing; fingerprint metadata remains' : artifactVaultStatus[artifact.id] === 'mismatch' ? 'HASH / SIZE CHECK FAILED — do not use this file' : 'Fingerprint only; original is not retained here'}</span><code>{artifact.sha256}</code></div>{artifactVaultStatus[artifact.id] === 'present' && <button type="button" className="secondary-button" onClick={() => void downloadVerifiedArtifact(artifact)} disabled={readOnly}>Verify & download</button>}<button type="button" className="journey-remove-button" disabled={readOnly || !writable} onClick={() => void removeArtifact(artifact.id)} aria-label={`Remove provenance artifact ${artifact.fileName}`}><Trash2 size={14}/> Remove</button></div>)}</div>}
            </div>
            <div className="journey-form-card">
              <div className="journey-form-heading"><span>07</span><div><strong>Explainable next-action planner</strong><p>Actions address missing evidence and uncertainty; no invented costs or probabilities.</p></div></div>
              {nextActions.length === 0 ? <p className="journey-hint">Select a journey to see actions.</p> : <div className="journey-action-list">{nextActions.map((action) => <article className="journey-action-card" key={action.id}><div className="journey-action-top"><span className={`journey-priority priority-${action.priority}`}>{action.priority} priority</span><span>{action.actionType.replaceAll('_', ' ')}</span></div><strong>{action.title}</strong><p>{action.why}</p><details><summary>What would possible outcomes mean?</summary><div><b>Positive:</b> {action.whatPositiveWouldMean}</div><div><b>Negative:</b> {action.whatNegativeWouldMean}</div><ul>{action.prerequisites.map((item, i) => <li key={i}>{item}</li>)}</ul></details></article>)}</div>}
            </div>
          </div>

          <div className="journey-audit-panel">
            <div className="journey-section-title"><div><div className="panel-kicker">LOCAL AUDIT LEDGER</div><h3>Change history</h3><p>Hash-linked events from this browser. This is a tamper-evident aid, not an authenticated server audit.</p></div><button className="secondary-button" onClick={checkAuditChain}><ClipboardCheck size={14}/> Verify hash chain</button></div>
            <div className={`journey-chain-status ${chainStatus ? chainStatus.valid ? 'chain-valid' : 'chain-invalid' : ''}`} role="status">{chainStatus ? chainStatus.valid ? `Hash links verified: ${chainStatus.checked} event(s).` : `Hash-chain problem after ${chainStatus.checked} event(s): ${chainStatus.error}` : `${store.auditEvents.length} audit event(s). Verify to check the local hash chain.`}</div>
            {store.auditEvents.length === 0 ? <p className="journey-hint">No relationship changes have been recorded yet.</p> : <div className="journey-audit-list">{[...store.auditEvents].reverse().slice(0, 12).map((event) => <div className="journey-audit-row" key={event.id}><span>{new Date(event.occurredAt).toLocaleString()}</span><div><strong>{event.eventType.replaceAll('_', ' ')}</strong><p>{event.summary}</p><code>{event.eventHash.slice(0, 18)}…</code></div></div>)}</div>}
            <button className="quiet-button" onClick={exportRelationshipLedger}><UploadCloud size={14}/> Export relationship and audit ledger</button>
            <label className="quiet-button" style={{ cursor: 'pointer' }}>Verify exported ledger file<input type="file" accept="application/json,.json" hidden onChange={verifyLedgerFile} /></label>
            {ledgerFileStatus && <p className="journey-hint" role="status">{ledgerFileStatus}</p>}
          </div>
        </>}
      </div>
    </section>
  );
}
