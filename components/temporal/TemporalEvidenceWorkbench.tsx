'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowDownRight, ArrowRight, CalendarClock, CircleHelp,
  ClipboardList, Clock3, GitCompareArrows, ShieldAlert, Waves,
} from 'lucide-react';
import { analyteLabels, resultLabels, stageLabels, stages, type EvidenceRecord, type EvidenceStage } from '@/lib/evidence';
import type { DiagnosticReport } from '@/lib/diagnostics';
import type { SelectedJourneyModel } from '@/lib/investigation-model';
import { buildTemporalSnapshot, describeResult, planSamplingActions, type SamplingActionCandidate, type TemporalEligibility, type TemporalPoint } from '@/lib/temporal-evidence';

const eligibilityLabels: Record<TemporalEligibility, string> = {
  eligible_on_pathway: 'Eligible · on selected pathway',
  eligible_observation: 'Eligible observation',
  excluded: 'Excluded by engine',
  off_pathway: 'Eligible · off selected pathway',
  unresolved: 'Eligibility unresolved',
};
const eligibilityClasses: Record<TemporalEligibility, string> = {
  eligible_on_pathway: 'temporal-eligibility-on-pathway',
  eligible_observation: 'temporal-eligibility-observation',
  excluded: 'temporal-eligibility-excluded',
  off_pathway: 'temporal-eligibility-offpath',
  unresolved: 'temporal-eligibility-unresolved',
};
const priorityLabels = { high: 'High priority', medium: 'Medium priority', low: 'Lower priority' } as const;
const stageOptions: Array<{ value: 'all' | EvidenceStage; label: string }> = [
  { value: 'all', label: 'All stages' }, ...stages.map((stage) => ({ value: stage, label: stageLabels[stage] })),
];

type Scope = 'journey' | 'investigation';

function formatDate(value: string | null): string {
  if (!value) return 'No timestamp';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? `Invalid timestamp: ${value}` : parsed.toLocaleString();
}
function formatPeriod(records: TemporalPoint[]): string {
  const dated = records.map((point) => point.timeMs).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!dated.length) return 'No valid collection times';
  const start = new Date(dated[0] as number).toLocaleDateString();
  const end = new Date(dated[dated.length - 1] as number).toLocaleDateString();
  return start === end ? start : `${start} – ${end}`;
}

export default function TemporalEvidenceWorkbench({
  workspaceId, workspaceName, records, report, reportStale, journeyModel, readOnly = false, onNotice,
}: {
  workspaceId: string; workspaceName: string; records: EvidenceRecord[]; report: DiagnosticReport | null;
  reportStale: boolean; journeyModel: SelectedJourneyModel | null; readOnly?: boolean; onNotice?: (message: string) => void;
}) {
  const snapshot = useMemo(() => buildTemporalSnapshot(records, report, reportStale, journeyModel), [records, report, reportStale, journeyModel]);
  const candidates = useMemo(() => planSamplingActions(records, report, reportStale, journeyModel), [records, report, reportStale, journeyModel]);
  const [scope, setScope] = useState<Scope>(journeyModel ? 'journey' : 'investigation');
  const [stageFilter, setStageFilter] = useState<'all' | EvidenceStage>('all');
  const [analyteFilter, setAnalyteFilter] = useState<'all' | EvidenceRecord['analyte']>('all');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const selectedEventRecordIds = useMemo(() => new Set(journeyModel?.samplingEvents.map((event) => event.evidenceRecordId) ?? []), [journeyModel]);

  useEffect(() => { setScope(journeyModel ? 'journey' : 'investigation'); }, [journeyModel?.journey.id, workspaceId]);
  useEffect(() => {
    setSelectedCandidateIds((current) => {
      const existing = current.filter((id) => candidates.some((candidate) => candidate.id === id));
      return existing.length ? existing.slice(0, 3) : candidates.slice(0, 3).map((candidate) => candidate.id);
    });
  }, [candidates]);

  const visiblePoints = useMemo(() => snapshot.datedPoints.filter((point) =>
    (scope === 'investigation' || selectedEventRecordIds.has(point.record.id)) &&
    (stageFilter === 'all' || point.record.stage === stageFilter) &&
    (analyteFilter === 'all' || point.record.analyte === analyteFilter)
  ), [snapshot.datedPoints, scope, selectedEventRecordIds, stageFilter, analyteFilter]);
  const visiblePatterns = useMemo(() => snapshot.patterns.filter((pattern) => {
    if (stageFilter !== 'all' && pattern.stage !== stageFilter) return false;
    if (analyteFilter !== 'all' && pattern.analyte !== analyteFilter) return false;
    if (scope === 'journey') return pattern.records.some((point) => selectedEventRecordIds.has(point.record.id));
    return true;
  }), [snapshot.patterns, stageFilter, analyteFilter, scope, selectedEventRecordIds]);
  const selectedCandidates = candidates.filter((candidate) => selectedCandidateIds.includes(candidate.id)).slice(0, 3);

  function toggleCandidate(id: string) {
    setSelectedCandidateIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length >= 3 ? [...current.slice(1), id] : [...current, id]);
  }

  function createAction(candidate: SamplingActionCandidate) {
    window.dispatchEvent(new CustomEvent('waterchain:action-loop-prefill', { detail: {
      workspaceId,
      title: candidate.title,
      details: `${candidate.rationale}\n\nWhat a positive result would mean: ${candidate.whatPositiveWouldMean}\n\nWhat a negative result would mean: ${candidate.whatNegativeWouldMean}\n\nWhat remains unknown: ${candidate.remainingUnknown}\n\nPrerequisites:\n- ${candidate.prerequisites.join('\n- ')}\n\nPlanner basis: ${candidate.rankingBasis}`.slice(0, 4000),
      priority: candidate.priority,
      sourceKey: `temporal-plan:${candidate.id}`,
      sourceLabel: `Temporal evidence planner — ${candidate.kind.replaceAll('_', ' ')}`,
      evidenceRecordIds: candidate.evidenceRecordIds,
    } }));
    document.getElementById('action-loop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onNotice?.(`Prepared “${candidate.title}” in ActionLoop. Assign an owner and due date, then review the action details before saving.`);
  }

  return (
    <section className="panel temporal-evidence-panel" id="temporal-evidence" aria-labelledby="temporal-evidence-title">
      <div className="panel-header temporal-header">
        <div>
          <div className="panel-kicker">08 / TIME & FOLLOW-UP</div>
          <h2 id="temporal-evidence-title">Temporal evidence &amp; sampling planner</h2>
          <p>Review observations over time and compare follow-up actions using explicit rules—not invented probabilities.</p>
        </div>
        <div className="temporal-header-badge"><CalendarClock size={15}/><span>{snapshot.datedCount} dated · {snapshot.undatedCount} undated</span></div>
      </div>

      <div className="temporal-body">
        <div className="temporal-scope-bar">
          <div className="temporal-scope-copy"><Waves size={17}/><div><strong>{journeyModel ? journeyModel.journey.name : `${workspaceName} · Investigation-level timeline`}</strong><p>{journeyModel ? 'Journey-linked samples are shown by default. Switch scope to compare all investigation records.' : 'No water journey is selected. Records are shown as an investigation-level sequence, not a single physical water trajectory.'}</p></div></div>
          <div className="temporal-filters">
            <label>Scope<select className="form-select" value={scope} onChange={(event) => setScope(event.target.value as Scope)}><option value="investigation">All investigation records</option><option value="journey" disabled={!journeyModel}>Selected journey only</option></select></label>
            <label>Stage<select className="form-select" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as 'all' | EvidenceStage)}>{stageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Analyte<select className="form-select" value={analyteFilter} onChange={(event) => setAnalyteFilter(event.target.value as 'all' | EvidenceRecord['analyte'])}><option value="all">All analytes</option>{Object.entries(analyteLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </div>

        <div className="temporal-metrics" aria-label="Timeline summary">
          <div><span>Visible dated records</span><strong>{visiblePoints.length}</strong></div>
          <div><span>Temporal patterns</span><strong>{visiblePatterns.length}</strong></div>
          <div><span>Eligibility unresolved</span><strong>{visiblePoints.filter((point) => point.eligibility === 'unresolved').length}</strong></div>
          <div><span>Missing / invalid time</span><strong>{scope === 'journey' && journeyModel ? snapshot.undatedRecords.filter((record) => selectedEventRecordIds.has(record.id)).length : snapshot.undatedCount}</strong></div>
        </div>

        {(reportStale || !report) && <div className="temporal-alert"><AlertCircle size={15}/><div><strong>{reportStale ? 'Diagnostic report is stale' : 'No current diagnostic report'}</strong><p>The timeline still shows recorded data, but engine eligibility is unresolved. Rerun the diagnostic review before treating a record as an eligible observation.</p></div></div>}

        <div className="temporal-section-title"><div><h3>Observation timeline</h3><p>Chronological order comes from recorded collection times. Repeated observations are not proof of persistence or causation.</p></div><span>{formatPeriod(visiblePoints)}</span></div>
        {visiblePoints.length === 0 ? <div className="temporal-empty"><Clock3 size={22}/><strong>No dated records match this view</strong><p>Add evidence with real collection timestamps, or widen the scope and filters. Undated records are listed separately and are never assigned an invented date.</p></div> : <div className="temporal-timeline" role="list" aria-label="Chronological water-quality observations">
          {visiblePoints.map((point, index) => <article className="temporal-event" role="listitem" key={point.record.id}>
            <div className="temporal-event-rail"><span className={`temporal-dot ${point.eligibility === 'excluded' ? 'dot-excluded' : point.eligibility === 'unresolved' ? 'dot-unresolved' : point.eligibility === 'off_pathway' ? 'dot-offpath' : point.record.result === 'detected' ? 'dot-positive' : point.record.result === 'not_detected' ? 'dot-negative' : 'dot-neutral'}`}/>{index < visiblePoints.length - 1 && <span className="temporal-line"/>}</div>
            <div className="temporal-event-card">
              <div className="temporal-event-top"><time dateTime={point.record.collectedAt ?? undefined}>{formatDate(point.record.collectedAt)}</time><span className={`temporal-eligibility ${eligibilityClasses[point.eligibility]}`}>{eligibilityLabels[point.eligibility]}</span></div>
              <div className="temporal-event-main"><div><strong>{point.record.recordCode}</strong><span>{stageLabels[point.record.stage]} · {analyteLabels[point.record.analyte]}</span></div><div className="temporal-observed-result"><small>Recorded result</small><strong>{describeResult(point.record)}</strong></div></div>
              <div className="temporal-event-meta"><span>Sample {point.record.sampleCode}</span><span>Source {point.record.waterSourceId?.trim() || 'unrecorded'}</span><span>Batch {point.record.batchId?.trim() || 'unrecorded'}</span>{point.entityRef && <span>Entity {point.entityRef}</span>}</div>
              <p className="temporal-event-caveat">{point.eligibilityReason}</p>
            </div>
          </article>)}
        </div>}

        {snapshot.undatedRecords.length > 0 && <details className="temporal-undated"><summary><AlertCircle size={14}/> {scope === 'journey' && journeyModel ? snapshot.undatedRecords.filter((record) => selectedEventRecordIds.has(record.id)).length : snapshot.undatedCount} record(s) excluded from the timeline because collection time is missing or invalid</summary><div className="temporal-undated-list">{snapshot.undatedRecords.filter((record) => scope !== 'journey' || !journeyModel || selectedEventRecordIds.has(record.id)).map((record) => <div key={record.id}><strong>{record.recordCode}</strong><span>{stageLabels[record.stage]} · {resultLabels[record.result]}</span></div>)}</div></details>}

        <div className="temporal-section-title temporal-section-spaced"><div><h3>Observed repeat-sample patterns</h3><p>Patterns are descriptive summaries of comparable-looking records, not estimates of risk or proof of a contamination pathway.</p></div><span>Rule-based</span></div>
        {visiblePatterns.length === 0 ? <div className="temporal-empty compact"><GitCompareArrows size={20}/><strong>No interpretable repeat pattern identified</strong><p>WaterChain needs at least two dated observations in a comparable source/stage/analyte group with current eligible results. This does not mean conditions were stable or safe.</p></div> : <div className="temporal-pattern-grid">{visiblePatterns.map((pattern) => <article key={pattern.id} className="temporal-pattern-card"><div className="temporal-pattern-top"><span>{stageLabels[pattern.stage]}</span><span>{pattern.records.length} observations</span></div><h4>{analyteLabels[pattern.analyte]}</h4><p className="temporal-pattern-summary">{pattern.summary}</p><div className="temporal-sequence">{pattern.records.map((point, index) => <span key={point.record.id}>{index > 0 && <ArrowRight size={12}/>}<strong>{describeResult(point.record)}</strong></span>)}</div><p className="temporal-interpretation-limit"><ShieldAlert size={14}/>{pattern.interpretationLimit}</p><small>Source: {pattern.sourceId} · Entity: {pattern.entityRef || 'not explicitly mapped'} · {formatPeriod(pattern.records)}</small></article>)}</div>}

        <div className="temporal-section-title temporal-section-spaced"><div><h3>Compare next actions</h3><p>Ranked by explicit rules: evidence blockers first, interpretation conflicts next, then repeat observations and provenance gaps. No expected-information-gain probabilities are estimated.</p></div><span>{candidates.length} candidates</span></div>
        {candidates.length === 0 ? <div className="temporal-empty compact"><ClipboardList size={20}/><strong>No data-based action can be ranked yet</strong><p>Add real evidence records. WaterChain will not fabricate a sampling recommendation from an empty investigation.</p></div> : <>
          <div className="sampling-action-list">{candidates.map((candidate, index) => <article key={candidate.id} className={`sampling-action-card priority-${candidate.priority}`}>
            <label className="sampling-action-select"><input type="checkbox" checked={selectedCandidateIds.includes(candidate.id)} onChange={() => toggleCandidate(candidate.id)} aria-label={`Compare ${candidate.title}`} disabled={!selectedCandidateIds.includes(candidate.id) && selectedCandidateIds.length >= 3}/><span>Compare</span></label>
            <div className="sampling-action-content"><div className="sampling-action-meta"><span className={`priority-pill priority-pill-${candidate.priority}`}>{priorityLabels[candidate.priority]}</span><span>{candidate.kind.replaceAll('_', ' ')}</span>{candidate.stage && <span>{stageLabels[candidate.stage]}</span>}</div><h4>{index + 1}. {candidate.title}</h4><p>{candidate.rationale}</p><p className="sampling-ranking-basis">Ranking basis: {candidate.rankingBasis}</p><details><summary>Possible result meanings and prerequisites</summary><div className="sampling-meanings"><div><strong>If positive</strong><p>{candidate.whatPositiveWouldMean}</p></div><div><strong>If negative</strong><p>{candidate.whatNegativeWouldMean}</p></div><div><strong>Still unknown</strong><p>{candidate.remainingUnknown}</p></div><div><strong>Prerequisites</strong><ul>{candidate.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></div></div></details></div>
            <button type="button" className="secondary-button sampling-create-action" disabled={readOnly} onClick={() => createAction(candidate)}><ClipboardList size={14}/> Use in ActionLoop</button>
          </article>)}</div>
          {selectedCandidates.length > 0 && <section className="sampling-compare" aria-labelledby="sampling-compare-title"><div className="sampling-compare-heading"><div><h4 id="sampling-compare-title"><GitCompareArrows size={16}/> Side-by-side comparison</h4><p>Select up to three candidate actions. Priority is rule-based, not a probability that an action will succeed.</p></div><span>{selectedCandidates.length}/3 selected</span></div><div className="sampling-compare-grid">{selectedCandidates.map((candidate) => <article key={candidate.id}><span className={`priority-pill priority-pill-${candidate.priority}`}>{priorityLabels[candidate.priority]}</span><h5>{candidate.title}</h5><div><strong>Uncertainty targeted</strong><p>{candidate.rationale}</p></div><div><strong>What it needs</strong><p>{candidate.prerequisites[0] ?? 'Review the relevant investigation records.'}</p></div><div><strong>What it cannot prove</strong><p>{candidate.remainingUnknown}</p></div><button className="primary-button" type="button" disabled={readOnly} onClick={() => createAction(candidate)}>Create ActionLoop draft <ArrowDownRight size={14}/></button></article>)}</div></section>}
        </>}

        <details className="temporal-method-note"><summary><CircleHelp size={14}/> Method and limitations</summary><ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}<li>Priority labels use documented deterministic rules. They are not a calibrated risk score, expected information gain, cost estimate, or guarantee of the best sample.</li><li>Repeated records may be technical replicates, duplicate entries, different specimens, or observations at different sampling points. Verify context before interpreting them as a temporal pattern.</li></ul></details>
      </div>
    </section>
  );
}
