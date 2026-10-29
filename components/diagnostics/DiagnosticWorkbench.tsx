'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, CircleHelp, ClipboardList, Download, GitBranch,
  LoaderCircle, Play, RefreshCw, ShieldAlert, ShieldCheck, TestTube2,
} from 'lucide-react';
import { evidenceRecordSchema, stageLabels, type EvidenceRecord, type EvidenceStage } from '@/lib/evidence';
import { diagnosticApiResponseSchema, type DiagnosticReport } from '@/lib/diagnostics';
import { buildCaseReportMarkdown } from '@/lib/case-report';
import { type SelectedJourneyModel } from '@/lib/investigation-model';
import DecisionRobustnessStudio from '@/components/diagnostics/DecisionRobustnessStudio';

const stageOrder: EvidenceStage[] = ['source', 'collection', 'storage', 'serving'];
const cachedReviewSchema = diagnosticApiResponseSchema.extend({ analysedFingerprint: z.string() });
const stageExplainers: Record<string, string> = {
  not_assessed: 'Not assessed — no eligible result at this stage.',
  observed_positive: 'Positive result observed. This is not, by itself, proof of where contamination began.',
  no_positive_observed: 'No positive result observed in eligible records. This does not prove the stage was uncontaminated.',
};

export default function DiagnosticWorkbench({ records, workspaceId, workspaceName, journeyModel = null, onReportChange }: { records: EvidenceRecord[]; workspaceId: string; workspaceName: string; journeyModel?: SelectedJourneyModel | null; onReportChange?: (report: DiagnosticReport | null, stale: boolean) => void }) {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [engineName, setEngineName] = useState('');
  const [requestId, setRequestId] = useState('');
  const [evidenceSha256, setEvidenceSha256] = useState('');
  const [journeySha256, setJourneySha256] = useState<string | null>(null);
  const [analysedFingerprint, setAnalysedFingerprint] = useState<string | null>(null);
  const [persistenceNotice, setPersistenceNotice] = useState('');
  const currentFingerprint = JSON.stringify({ records, journeyModel });
  const isStale = Boolean(report && analysedFingerprint !== currentFingerprint);
  const [loading, setLoading] = useState(false);
  // The pathway panel shows engine states, never register guesses, so the
  // current report (and whether it is stale) is shared with the parent.
  // A stale report is shared as stale; the parent never displays its
  // states as current.
  useEffect(() => { onReportChange?.(report, isStale); }, [report, isStale, onReportChange]);
  const [error, setError] = useState('');
  const cacheKey = `waterchain:diagnostic-review:v1:${workspaceId}`;

  useEffect(() => {
    // Each investigation has its own cache key; validated reports survive a reload
    // while the evidence fingerprint prevents stale results being treated as current.
    setReport(null); setGeneratedAt(null); setEngineName(''); setRequestId('');
    setEvidenceSha256(''); setJourneySha256(null); setAnalysedFingerprint(null); setError(''); setPersistenceNotice('');
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = cachedReviewSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        setPersistenceNotice('A saved review could not be validated and was left untouched. Run a new review to create a fresh report.');
        return;
      }
      setReport(parsed.data.report);
      setGeneratedAt(parsed.data.generatedAt);
      setEngineName(parsed.data.engine);
      setRequestId(parsed.data.requestId);
      setEvidenceSha256(parsed.data.evidenceSha256);
      setJourneySha256(parsed.data.journeySha256 ?? null);
      setAnalysedFingerprint(parsed.data.analysedFingerprint);
      setPersistenceNotice('Restored the latest review for this investigation from this browser. Check the stale-report notice before using or exporting it.');
    } catch {
      setPersistenceNotice('A saved review could not be read. The stored value was left untouched; run a new review if needed.');
    }
  }, [cacheKey]);

  async function runReview() {
    setLoading(true);
    setError('');
    try {
      // Do not silently drop malformed records: fail the review and explain the issue.
      const invalidRecordIndex = records.findIndex((record) => !evidenceRecordSchema.safeParse(record).success);
      if (invalidRecordIndex >= 0) {
        throw new Error(`Evidence record ${invalidRecordIndex + 1} does not match the current record schema. Export a backup and inspect the stored record before reviewing.`);
      }
      const validRecords = records;
      const response = await fetch('/api/diagnose', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: validRecords, ...(journeyModel ? { journeyModel } : {}) }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const apiError = data && typeof data === 'object' && 'error' in data ? String(data.error) : `Diagnostic request failed (${response.status}).`;
        throw new Error(apiError);
      }
      const parsed = diagnosticApiResponseSchema.safeParse(data);
      if (!parsed.success) throw new Error('The diagnostic API returned a response that did not match the expected schema.');
      setReport(parsed.data.report);
      setGeneratedAt(parsed.data.generatedAt);
      setEngineName(parsed.data.engine);
      setRequestId(parsed.data.requestId);
      setEvidenceSha256(parsed.data.evidenceSha256);
      setJourneySha256(parsed.data.journeySha256 ?? null);
      const analysedNow = JSON.stringify({ records: validRecords, journeyModel });
      setAnalysedFingerprint(analysedNow);
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify({ ...parsed.data, analysedFingerprint: analysedNow }));
        setPersistenceNotice('This review is saved locally for this investigation. Any later evidence change will mark it stale.');
      } catch {
        setPersistenceNotice('The review completed, but browser storage could not save it. Export the review bundle before reloading or switching investigations.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unexpected error running diagnostic review.');
      setReport(null);
      setAnalysedFingerprint(null);
    } finally {
      setLoading(false);
    }
  }

  function exportReviewBundle() {
    if (!report || !generatedAt || !evidenceSha256 || isStale) return;
    const bundle = {
      bundleSchema: 'waterchain-review-bundle-v1',
      exportedAt: new Date().toISOString(),
      investigation: { id: workspaceId, name: workspaceName },
      review: {
        generatedAt,
        requestId,
        engine: engineName,
        evidenceSha256,
        journeySha256,
        selectedJourneyModel: journeyModel,
        evidenceHashAlgorithm: 'SHA-256 over UTF-8 JSON.stringify of schema-parsed records sorted by recordCode, id, then serialized record',
        recordCount: records.length,
      },
      evidenceRecords: records,
      report,
      interpretationNotice: 'Rule-based prototype output. This bundle does not establish water safety or prove contamination causation. Verify source records independently before use.',
      privacyNotice: 'This file includes the evidence records submitted to the engine, which may contain sensitive information. Store and share it only with authorized reviewers.',
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `waterchain-${workspaceName.trim().replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48) || 'investigation'}-review-${generatedAt.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCaseReport() {
    if (!report || !generatedAt || !evidenceSha256 || isStale) return;
    const markdown = buildCaseReportMarkdown({
      workspaceName, generatedAt, engineName, requestId, evidenceSha256, journeySha256,
      recordCount: records.length, report, journeyModel,
    });
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `waterchain-${workspaceName.trim().replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48) || 'investigation'}-case-report-${generatedAt.replace(/[:.]/g, '-')}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="panel diagnostic-workbench" id="diagnostic-workbench">
      <div className="panel-header diagnostic-header">
        <div><div className="panel-kicker">03 / DIAGNOSTIC ENGINE</div><h2>Competing pathway hypotheses</h2><p>Run the transparent Python review against the evidence currently in this browser.</p></div>
        <button className="primary-button diagnostic-run-button" onClick={runReview} disabled={loading}>
          {loading ? <LoaderCircle size={15} className="spin-icon" /> : report ? <RefreshCw size={15} /> : <Play size={15} />}
          {loading ? 'Evaluating…' : report ? (isStale ? 'Refresh review' : 'Run again') : 'Run diagnostic review'}
        </button>
      </div>
      <div className="diagnostic-body">
        <div className="diagnostic-disclaimer"><ShieldAlert size={16}/><span><strong>Rule-based review, not a proven diagnosis.</strong> The engine reports observed results and evidence gaps. It does not generate probabilities, independently authenticate records, or prove causation.</span></div>
        {persistenceNotice && <div className="diagnostic-cache-notice" role="status">{persistenceNotice}</div>}
        {error && <div className="diagnostic-error" role="alert"><AlertTriangle size={16}/><div><strong>Review could not be completed</strong><p>{error}</p><span>Check that Python 3 is installed and available to the Next.js server. See the README setup instructions.</span></div></div>}
        {!report && !loading && !error && <div className="diagnostic-empty"><div className="lower-icon"><GitBranch size={18}/></div><div><strong>No diagnostic run yet</strong><p>{records.length === 0 ? 'Add actual evidence records before running the review. An empty evidence set is not a negative water-quality result.' : `${records.length} evidence record(s) are ready to submit for review. The engine may exclude records with incomplete or unsupported metadata.`}</p></div></div>}
        {loading && <div className="diagnostic-loading"><LoaderCircle size={19} className="spin-icon"/><span>Checking eligibility, batch lineage, chronology, and stage coverage…</span></div>}
        {report && isStale && <div className="diagnostic-stale" role="alert"><RefreshCw size={15}/><span><strong>Evidence changed since this report.</strong> The previous conclusion is hidden because it does not describe the current register. Run the diagnostic review again before relying on any result.</span></div>}
        {report && isStale && <details className="diagnostic-stale-archive">
          <summary>View previous report <span>STALE · NOT FOR CURRENT EVIDENCE</span></summary>
          <div className="diagnostic-stale-archive-body">
            <strong>Previous conclusion — stale</strong>
            <p>{report.conclusion}</p>
            <dl><div><dt>Review generated</dt><dd>{generatedAt ? new Date(generatedAt).toLocaleString() : 'Unknown time'}</dd></div><div><dt>Records in previous review</dt><dd>{report.evidence_summary.records_received}</dd></div><div><dt>Previous request ID</dt><dd>{requestId || 'Unavailable'}</dd></div></dl>
            <p className="diagnostic-stale-archive-note">This is retained only for audit context. It must not be interpreted as the current assessment. Review-bundle export remains disabled until a fresh review completes.</p>
          </div>
        </details>}
        {report && !isStale && <>
          <div className={`diagnostic-result ${report.attribution_permitted ? 'result-permitted' : 'result-abstain'}`}>
            <div className="result-icon">{report.attribution_permitted ? <ShieldCheck size={19}/> : <CircleHelp size={19}/>}</div>
            <div className="result-copy"><span className="result-overline">ENGINE CONCLUSION / {report.confidence_label.toUpperCase()}</span><strong>{report.conclusion}</strong><p>{report.attribution_permitted ? 'Cross-stage comparison passed the engine’s minimum structural gates. Causal origin remains uncertain.' : 'The engine has not permitted contamination entry-point attribution from this evidence set.'}</p></div>
          </div>
          <div className="diagnostic-metrics">
            <div><span>Records received</span><strong>{report.evidence_summary.records_received}</strong></div>
            <div><span>Eligible records</span><strong>{report.evidence_summary.eligible_records}</strong></div>
            <div><span>Pathway stages linked</span><strong>{stageOrder.filter((stage) => report.evidence_summary.pathway_eligible_by_stage[stage] > 0).length} / 4</strong></div>
            <div><span>Integrity findings</span><strong>{report.findings.length}</strong></div>
          </div>
          <div className="diagnostic-lineage-note">
            <div><span>{report.evidence_summary.lineage_mode === 'explicit_journey' ? 'Selected water journey' : 'Unique shared batch'}</span><strong>{report.evidence_summary.lineage_mode === 'explicit_journey' ? (report.evidence_summary.journey_name || report.evidence_summary.journey_id || 'Not established') : (report.evidence_summary.pathway_batch_id || 'Not established')}</strong></div>
            <div><span>Records in selected pathway</span><strong>{stageOrder.reduce((total, stage) => total + (report.evidence_summary.pathway_eligible_by_stage[stage] || 0), 0)}</strong></div>
            <p>{report.evidence_summary.lineage_mode === 'explicit_journey' ? (report.lineage_review?.status === 'linked_for_review' ? 'The selected relationship graph links sampling events to this journey and provides documented adjacent-stage transfer evidence. This supports a candidate transition only when the remaining diagnostic gates are satisfied; it does not prove causation.' : 'The selected journey has incomplete or weaker relationship evidence. See the lineage blockers and recommended actions below; transition attribution remains unavailable.') : (report.evidence_summary.pathway_batch_id ? 'Only eligible records linked to this single shared batch contribute to pathway hypotheses. Other batches are disclosed and excluded.' : 'Stage-level results may be shown, but no linked pathway is selected. Transition attribution remains unavailable until one batch links all four stages or an explicit journey relationship model is supplied.')}</p>
          </div>
          <div className="hypothesis-list">
            {report.hypotheses.map((hypothesis) => <article className="hypothesis-card" key={hypothesis.stage}>
              <div className="hypothesis-top"><div><span className="hypothesis-stage-index">{String(stageOrder.indexOf(hypothesis.stage as EvidenceStage) + 1).padStart(2, '0')}</span><strong>{hypothesis.label}</strong></div><span className={`hypothesis-state state-${hypothesis.status}`}>{hypothesis.status.replaceAll('_', ' ')}</span></div>
              <p>{stageExplainers[hypothesis.status] || hypothesis.explanation}</p>
              <div className="hypothesis-evidence"><span><CheckCircle2 size={12}/> Supporting: {hypothesis.supporting_evidence.length ? hypothesis.supporting_evidence.join(', ') : 'none recorded'}</span><span><AlertCircle size={12}/> Contradicting: {hypothesis.contradicting_evidence.length ? hypothesis.contradicting_evidence.join(', ') : 'none recorded'}</span></div>
            </article>)}
          </div>
          <div className="diagnostic-subsection"><div className="diagnostic-subheading"><TestTube2 size={15}/><strong>Recommended next evidence step</strong></div><p className="next-step-action">{report.next_step.action}</p><p className="next-step-reason">{report.next_step.reason}</p>{report.next_step.target_stage && <span className="target-stage">Target stage: {stageLabels[report.next_step.target_stage as EvidenceStage] || report.next_step.target_stage}</span>}</div>
          {report.lineage_review?.mode === 'explicit_journey' && <div className="diagnostic-subsection"><div className="diagnostic-subheading"><GitBranch size={15}/><strong>Explicit water-journey lineage review</strong></div><p className="eligibility-note">Relationship mode was used instead of requiring the same batch ID at all stages. Sampling-event links and transfer bases are user-entered and are not independently authenticated.</p><div className="journey-transfer-grid">{report.lineage_review.transfer_edges.map((edge) => <div className="journey-transfer-status" key={`${edge.from_stage}-${edge.to_stage}`}><div><strong>{stageLabels[edge.from_stage as EvidenceStage] || edge.from_stage} → {stageLabels[edge.to_stage as EvidenceStage] || edge.to_stage}</strong><span>{edge.count} transfer event(s)</span></div><span className={`journey-edge-status edge-${edge.status}`}>{edge.status}</span></div>)}</div>{report.lineage_review.blockers.length > 0 && <ul>{report.lineage_review.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}</div>}
          {report.next_actions && report.next_actions.length > 0 && <div className="diagnostic-subsection"><div className="diagnostic-subheading"><ClipboardList size={15}/><strong>Explainable next-action options</strong><span className="finding-count">{report.next_actions.length}</span></div><div className="journey-action-list">{report.next_actions.map((action) => <article className="journey-action-card" key={action.id}><div className="journey-action-top"><span className={`journey-priority priority-${action.priority}`}>{action.priority} priority</span><span>{action.action_type.replaceAll('_', ' ')}</span></div><strong>{action.title}</strong><p>{action.why}</p><details><summary>How to interpret the possible outcome</summary><div><b>If positive:</b> {action.what_positive_would_mean}</div><div><b>If negative:</b> {action.what_negative_would_mean}</div><ul>{action.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></details></article>)}</div><p className="eligibility-note">These are rule-based planning prompts. WaterChain does not estimate test costs, time, probabilities or guaranteed information gain.</p></div>}
          <DecisionRobustnessStudio records={records} report={report} journeyModel={journeyModel} workspaceName={workspaceName} />
          {report.findings.length > 0 && <div className="diagnostic-subsection"><div className="diagnostic-subheading"><AlertTriangle size={15}/><strong>Integrity and inference findings</strong><span className="finding-count">{report.findings.length}</span></div><div className="diagnostic-findings">{report.findings.map((finding, index) => <div className={`diagnostic-finding finding-${finding.severity}`} key={`${finding.code}-${index}`}><span className="finding-level">{finding.severity}</span><div><strong>{finding.code.replaceAll('_', ' ')}</strong><p>{finding.message}</p>{finding.record_ids.length > 0 && <small>Record IDs: {finding.record_ids.join(', ')}</small>}</div></div>)}</div></div>}
          {report.record_eligibility ? <div className="diagnostic-subsection"><div className="diagnostic-subheading"><TestTube2 size={15}/><strong>Record eligibility (engine)</strong><span className="finding-count">{report.record_eligibility.length}</span></div>{isStale && <p className="eligibility-stale-note">This table describes the previous evidence set, not the current register — this report is stale. Run the review again for current eligibility.</p>}<table className="eligibility-table"><thead><tr><th>Record</th><th>Stage</th><th>Result</th><th>Engine eligibility</th></tr></thead><tbody>{report.record_eligibility.map((entry) => <tr key={`${entry.record_code}-${entry.stage}`}><td>{entry.record_code}</td><td>{stageLabels[entry.stage as EvidenceStage] || entry.stage}</td><td>{entry.result_kind === 'positive' ? 'Positive' : entry.result_kind === 'negative' ? 'Negative' : 'No reportable result'}</td><td className={entry.eligible ? 'eligibility-eligible' : 'eligibility-excluded'}>{entry.eligible ? (entry.on_pathway ? 'Eligible · on pathway' : 'Eligible · off selected pathway') : `Excluded — ${entry.reason}`}</td></tr>)}</tbody></table><p className="eligibility-note">Eligibility is the engine’s own gate (method, timestamp, source/batch identity, quality controls, supported analyte, finite numeric value). Register flags are a separate local screen; see the evidence register.</p></div> : <div className="diagnostic-subsection"><p>Per-record engine eligibility is unavailable for this saved report (it predates Step 10). Run a new review to see it.</p></div>}
          <details className="diagnostic-limitations"><summary>Read model limitations <ArrowRight size={13}/></summary><ul>{report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></details>
          <div className="review-bundle-export">
            <div><strong>Reproducible review bundle</strong><p>Includes the exact submitted records, selected journey relationships, report, request ID, and SHA-256 fingerprints. The export may contain sensitive notes or identifiers.</p></div>
            <div className="review-bundle-buttons">
              <button className="secondary-button" onClick={exportReviewBundle} disabled={isStale} title={isStale ? 'Refresh the review before exporting its matching evidence snapshot.' : 'Download evidence and report as a JSON bundle'}><Download size={14}/> Export review bundle</button>
              <button className="secondary-button" onClick={exportCaseReport} disabled={isStale} title={isStale ? 'Refresh the review before exporting its matching evidence snapshot.' : 'Download a human-readable case report (Markdown): conclusion, supporting and excluded evidence, uncertainties, limitations'}><Download size={14}/> Export readable case report</button>
            </div>
          </div>
          <div className="diagnostic-run-meta"><span><CheckCircle2 size={12}/> Engine: {engineName}</span><span>Run at {generatedAt ? new Date(generatedAt).toLocaleString() : 'unknown time'}</span><span>Request: {requestId}</span><span>Evidence SHA-256: {evidenceSha256.slice(0, 12)}…</span></div>
        </>}
      </div>
    </section>
  );
}
