'use client';

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Download, FlaskConical, LoaderCircle, ShieldCheck, ShieldQuestion, SlidersHorizontal } from 'lucide-react';
import { diagnosticApiResponseSchema, type DiagnosticReport } from '@/lib/diagnostics';
import type { EvidenceRecord, EvidenceStage } from '@/lib/evidence';
import type { SelectedJourneyModel } from '@/lib/investigation-model';

type Props = {
  records: EvidenceRecord[];
  report: DiagnosticReport;
  journeyModel: SelectedJourneyModel | null;
  workspaceName: string;
};

type ScenarioResult = {
  recordId: string;
  recordCode: string;
  stage: EvidenceStage;
  resultLabel: string;
  status: 'success' | 'error';
  report?: DiagnosticReport;
  error?: string;
  classificationChanged?: boolean;
  conclusionChanged?: boolean;
};

const stageLabels: Record<EvidenceStage, string> = {
  source: 'Source', collection: 'Collection / transport', storage: 'Storage', serving: 'Serving',
};

function decisionSignature(report: DiagnosticReport): string {
  // Compare decision categories, not free-text wording alone.
  const stageStates = report.hypotheses.map((hypothesis) => `${hypothesis.stage}:${hypothesis.status}`).join('|');
  const firstPositive = report.hypotheses.find((hypothesis) => hypothesis.status === 'observed_positive')?.stage ?? 'none';
  const lineageState = report.lineage_review?.status ?? 'legacy_or_unknown';
  return [report.attribution_permitted ? 'attribution_permitted' : 'attribution_withheld', report.confidence_label, firstPositive, stageStates, lineageState].join('::');
}

function outputLabel(report: DiagnosticReport): string {
  if (report.attribution_permitted) return 'Candidate transition permitted';
  if (report.confidence_label.toLowerCase().includes('not assessed')) return 'Not assessed';
  return 'Attribution withheld';
}

function stageStateChanges(baseline: DiagnosticReport, altered: DiagnosticReport) {
  return altered.hypotheses.flatMap((hypothesis) => {
    const prior = baseline.hypotheses.find((item) => item.stage === hypothesis.stage);
    return prior && prior.status !== hypothesis.status
      ? [{ stage: hypothesis.stage, before: prior.status, after: hypothesis.status }]
      : [];
  });
}

function findingSeverityRank(severity: string): number {
  if (severity === 'blocker') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function DecisionRobustnessStudio({ records, report, journeyModel, workspaceName }: Props) {
  const currentInputFingerprint = JSON.stringify({ records, journeyModel });
  const eligibleCandidates = useMemo(() => {
    const eligibility = report.record_eligibility ?? [];
    const byId = new Map(records.map((record) => [record.id, record]));
    const seen = new Set<string>();
    return eligibility
      .filter((entry) => entry.eligible && entry.on_pathway && (entry.result_kind === 'positive' || entry.result_kind === 'negative'))
      .map((entry) => {
        const record = byId.get(entry.record_id);
        return record ? { record, resultKind: entry.result_kind } : null;
      })
      .filter((item): item is { record: EvidenceRecord; resultKind: 'positive' | 'negative' } => {
        if (!item || seen.has(item.record.id)) return false;
        seen.add(item.record.id);
        return true;
      })
      .slice(0, 12);
  }, [records, report.record_eligibility]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  // A ref guard, not just state: two rapid clicks can both pass a state guard
  // before React re-renders, which would start duplicate scenario runs.
  const runningRef = useRef(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState('');
  const isStale = Boolean(testedFingerprint && testedFingerprint !== currentInputFingerprint);

  function toggleRecord(recordId: string) {
    setSelectedIds((current) => {
      if (current.includes(recordId)) return current.filter((id) => id !== recordId);
      if (current.length >= 4) return current;
      return [...current, recordId];
    });
  }

  async function runStressTest() {
    if (runningRef.current || running || selectedIds.length === 0 || !report.record_eligibility) return;
    runningRef.current = true;
    setRunning(true);
    setError('');
    setResults([]);
    setCompletedCount(0);
    const snapshotFingerprint = currentInputFingerprint;
    setTestedFingerprint(snapshotFingerprint);
    const selected = selectedIds
      .map((id) => eligibleCandidates.find((candidate) => candidate.record.id === id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    const baselineSignature = decisionSignature(report);

    try {
      const outcomes = await Promise.all(selected.map(async ({ record, resultKind }) => {
        const modifiedRecords = records.filter((item) => item.id !== record.id);
        const modifiedJourney = journeyModel ? {
          ...journeyModel,
          // This is a simulated evidence-availability test. It removes the linked
          // sampling event too, but leaves unrelated transfer records untouched so
          // the engine must explain any resulting path gap.
          samplingEvents: journeyModel.samplingEvents.filter((event) => event.evidenceRecordId !== record.id),
        } : null;
        try {
          const response = await fetch('/api/diagnose', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: modifiedRecords, ...(modifiedJourney ? { journeyModel: modifiedJourney } : {}) }),
          });
          const raw: unknown = await response.json();
          if (!response.ok) {
            const message = raw && typeof raw === 'object' && 'error' in raw ? String((raw as { error: unknown }).error) : `API returned HTTP ${response.status}`;
            throw new Error(message);
          }
          const parsed = diagnosticApiResponseSchema.safeParse(raw);
          if (!parsed.success) throw new Error('The diagnostic API returned a report that failed schema validation.');
          const resultReport = parsed.data.report;
          return {
            recordId: record.id,
            recordCode: record.recordCode,
            stage: record.stage,
            resultLabel: resultKind === 'positive' ? 'Positive result' : 'Negative result',
            status: 'success' as const,
            report: resultReport,
            classificationChanged: decisionSignature(resultReport) !== baselineSignature,
            conclusionChanged: resultReport.conclusion !== report.conclusion,
          } satisfies ScenarioResult;
        } catch (cause) {
          return {
            recordId: record.id,
            recordCode: record.recordCode,
            stage: record.stage,
            resultLabel: resultKind === 'positive' ? 'Positive result' : 'Negative result',
            status: 'error' as const,
            error: cause instanceof Error ? cause.message : 'Scenario failed unexpectedly.',
          } satisfies ScenarioResult;
        } finally {
          setCompletedCount((count) => count + 1);
        }
      }));
      setResults(outcomes);
      const failed = outcomes.filter((outcome) => outcome.status === 'error').length;
      if (failed) setError(`${failed} scenario(s) could not complete. Treat the sensitivity review as incomplete and check the API before interpreting the remaining results.`);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  async function exportResults() {
    if (!results.length || isStale || running) return;
    const evidenceSha256 = await sha256(currentInputFingerprint);
    const scenariosPayload = results.map((result) => ({
      omittedRecordId: result.recordId,
      omittedRecordCode: result.recordCode,
      omittedStage: result.stage,
      omittedResultKind: result.resultLabel,
      status: result.status,
      decisionClassificationChanged: result.classificationChanged ?? null,
      conclusionTextChanged: result.conclusionChanged ?? null,
      resultingConclusion: result.report?.conclusion ?? null,
      resultingClassification: result.report ? outputLabel(result.report) : null,
      confidenceLabel: result.report?.confidence_label ?? null,
      findings: result.report?.findings.map((finding) => ({ code: finding.code, severity: finding.severity, message: finding.message })) ?? [],
      error: result.error ?? null,
    }));
    // Binds the report's own content to a fingerprint, so later edits to the
    // exported file are detectable by the in-app verifier.
    const contentSha256 = await sha256(JSON.stringify(scenariosPayload));
    const payload = {
      schema: 'waterchain-decision-sensitivity-v1',
      generatedAt: new Date().toISOString(),
      investigationName: workspaceName,
      method: 'single-record-omission sensitivity analysis',
      evidenceSnapshotSha256: evidenceSha256,
      contentSha256,
      baseline: {
        conclusion: report.conclusion,
        classification: outputLabel(report),
        confidenceLabel: report.confidence_label,
        attributionPermitted: report.attribution_permitted,
      },
      scenarios: scenariosPayload,
      interpretation: 'This tests sensitivity to record availability in the submitted data. It does not simulate physical contamination, estimate probabilities, authenticate evidence, or establish causation. Results are applicable only to the hashed evidence snapshot.',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `waterchain-sensitivity-${evidenceSha256.slice(0, 12)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function verifyExportFile(file: File) {
    setVerifyMessage('');
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || (parsed as { schema?: unknown }).schema !== 'waterchain-decision-sensitivity-v1') {
        setVerifyMessage('Not a WaterChain sensitivity report: unexpected schema. This file cannot be verified.');
        return;
      }
      const fingerprint = (parsed as { evidenceSnapshotSha256?: unknown }).evidenceSnapshotSha256;
      if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) {
        setVerifyMessage('The report does not carry a valid evidence-snapshot fingerprint. Treat it as unverifiable.');
        return;
      }
      // Self-consistency first: recompute the content fingerprint from the
      // scenarios inside the file. Edits to conclusions or scenario rows
      // after export are detectable here.
      const contentFingerprint = (parsed as { contentSha256?: unknown }).contentSha256;
      if (typeof contentFingerprint === 'string') {
        const scenariosInFile = (parsed as { scenarios?: unknown }).scenarios ?? [];
        const recomputed = await sha256(JSON.stringify(scenariosInFile));
        if (recomputed !== contentFingerprint) {
          setVerifyMessage('Mismatch: the scenario data in this file was altered after export (content fingerprint does not match). Do not rely on it.');
          return;
        }
      } else {
        setVerifyMessage('Note: this export predates the content fingerprint. Its binding to the current evidence can be checked, but edits to its conclusions cannot be detected.');
      }
      const current = await sha256(currentInputFingerprint);
      if (current === fingerprint) {
        setVerifyMessage('Verified: this export was generated from the evidence snapshot currently loaded in this investigation. It is current.');
      } else {
        setVerifyMessage('Mismatch: this export does not match the evidence currently loaded. It was generated from a different evidence set or has been altered; do not treat it as current.');
      }
    } catch {
      setVerifyMessage('The file could not be read as a sensitivity report.');
    }
  }

  const successful = results.filter((result) => result.status === 'success');
  const changed = successful.filter((result) => result.classificationChanged).length;

  return (
    <section className="decision-robustness-panel" id="decision-robustness" aria-labelledby="decision-robustness-title">
      <div className="decision-robustness-header">
        <div className="decision-robustness-icon"><SlidersHorizontal size={17}/></div>
        <div className="decision-robustness-heading">
          <span className="panel-kicker">EVIDENCE STRESS TEST</span>
          <h3 id="decision-robustness-title">Decision sensitivity</h3>
          <p>Ask: “Would the engine reach the same decision if one eligible record were unavailable?” The original evidence and report are never changed.</p>
        </div>
        <span className="decision-robustness-tag">Deterministic</span>
      </div>

      {!report.record_eligibility ? (
        <div className="decision-robustness-empty"><ShieldQuestion size={19}/><div><strong>Record-level eligibility is unavailable</strong><p>Run a current diagnostic review with the current engine before stress-testing evidence dependence.</p></div></div>
      ) : eligibleCandidates.length === 0 ? (
        <div className="decision-robustness-empty"><ShieldCheck size={19}/><div><strong>No eligible on-pathway observations to test</strong><p>The engine must first identify eligible positive or negative observations linked to the selected pathway. This is not evidence that the pathway is safe.</p></div></div>
      ) : (
        <>
          <div className="decision-robustness-method"><AlertTriangle size={14}/><p>This is a <strong>single-record-omission analysis</strong>, not a physical-world counterfactual, probability, or statistical robustness guarantee. Each run removes one selected evidence record from a temporary request and reruns the same engine.</p></div>
          <div className="decision-robustness-candidates">
            <div className="decision-robustness-candidate-title"><strong>Choose records to omit temporarily</strong><span>{selectedIds.length}/4 selected</span></div>
            <p className="decision-robustness-help">Select up to four current, engine-eligible observations. If a selected record belongs to an explicit journey, its sampling event is omitted from that test too.</p>
            {eligibleCandidates.map(({ record, resultKind }) => (
              <label key={record.id} className={`decision-robustness-record${selectedIds.includes(record.id) ? ' selected' : ''}`}>
                <input type="checkbox" aria-label={`Temporarily omit ${record.recordCode}`} checked={selectedIds.includes(record.id)} onChange={() => toggleRecord(record.id)} disabled={running || (!selectedIds.includes(record.id) && selectedIds.length >= 4)}/>
                <span className="decision-robustness-record-main"><strong>{record.recordCode}</strong><small>{stageLabels[record.stage]} · {resultKind === 'positive' ? 'Eligible positive' : 'Eligible negative'} · Sample {record.sampleCode}</small></span>
                <span className={`decision-robustness-result-label result-${resultKind}`}>{resultKind === 'positive' ? 'Positive' : 'Negative'}</span>
              </label>
            ))}
            {eligibleCandidates.length > 4 && <p className="decision-robustness-help">For practicality, choose at most four records per run. Up to {eligibleCandidates.length} eligible observations are listed; rerun with different selections to examine other records.</p>}
          </div>
          <div className="decision-robustness-actions">
            <button className="secondary-button" type="button" onClick={() => { setSelectedIds([]); setResults([]); setError(''); }} disabled={running || (!selectedIds.length && !results.length)}>Clear selection / results</button>
            <button className="primary-button" type="button" onClick={runStressTest} disabled={running || selectedIds.length === 0 || isStale}>
              {running ? <LoaderCircle size={14} className="spin-icon"/> : <FlaskConical size={14}/>} {running ? `Testing ${completedCount}/${selectedIds.length}…` : 'Run sensitivity test'}
            </button>
          </div>
          {error && <div className="decision-robustness-error" role="alert">{error}</div>}
          {isStale && <div className="decision-robustness-stale" role="alert"><AlertTriangle size={14}/> The evidence or journey changed after this sensitivity run. These results are stale; run the diagnostic review again and repeat the stress test.</div>}
          {results.length > 0 && <div className="decision-robustness-results" aria-live="polite">
            <div className="decision-robustness-summary">
              <div><span>Scenarios completed</span><strong>{successful.length}/{results.length}</strong></div>
              <div><span>Decision categories changed</span><strong>{changed}</strong></div>
              <div><span>Basis</span><strong>Record omissions</strong></div>
            </div>
            <p className="decision-robustness-interpretation">{successful.length === 0 ? 'No scenario completed successfully. No conclusion about sensitivity can be made.' : changed > 0 ? `The engine's decision category changed in ${changed} of ${successful.length} successful omission scenario(s). The current conclusion depends on at least some tested evidence being available; inspect each change below.` : `The engine's decision category did not change under the ${successful.length} tested omission(s). This only describes these specific tests; it is not a general robustness guarantee.`}</p>
            {results.map((result) => {
              const stageChanges = result.report ? stageStateChanges(report, result.report) : [];
              const notableFindings = result.report ? [...result.report.findings].sort((a, b) => findingSeverityRank(a.severity) - findingSeverityRank(b.severity)).slice(0, 2) : [];
              return <article className={`decision-robustness-result-card ${result.status === 'error' ? 'scenario-error' : result.classificationChanged ? 'scenario-changed' : 'scenario-same'}`} key={result.recordId}>
                <div className="decision-robustness-result-top"><div><strong>Omit {result.recordCode}</strong><span>{stageLabels[result.stage]} · {result.resultLabel}</span></div>{result.status === 'error' ? <span className="decision-robustness-pill pill-error">Failed</span> : result.classificationChanged ? <span className="decision-robustness-pill pill-changed">Decision changed</span> : <span className="decision-robustness-pill pill-same">Same decision category</span>}</div>
                {result.status === 'error' ? <p>{result.error}</p> : <><p className="decision-robustness-outcome"><strong>{outputLabel(result.report!)}</strong> — {result.report!.confidence_label}</p><p>{result.report!.conclusion}</p>{stageChanges.length > 0 && <div className="decision-robustness-stage-diff"><strong>Stage status changes</strong>{stageChanges.map((change) => <div key={change.stage}><span>{stageLabels[change.stage as EvidenceStage] || change.stage}</span><span>{change.before.replaceAll('_', ' ')} <ArrowRight size={11}/> {change.after.replaceAll('_', ' ')}</span></div>)}</div>}{notableFindings.length > 0 && <details className="decision-robustness-findings"><summary>Why did this result change? ({result.report!.findings.length} finding(s))</summary><ul>{notableFindings.map((finding, index) => <li key={`${finding.code}-${index}`}><strong>{finding.severity} · {finding.code.replaceAll('_', ' ')}</strong><span>{finding.message}</span></li>)}</ul></details>}{result.classificationChanged && <p className="decision-robustness-caveat"><AlertTriangle size={13}/> The decision category differs from the baseline. This shows dependence on the availability of this record in the submitted dataset; it does not estimate the chance of that scenario occurring.</p>}{!result.classificationChanged && result.conclusionChanged && <p className="decision-robustness-caveat"><ArrowRight size={13}/> The wording changed, but the decision-category signature did not.</p>}</>}
              </article>;
            })}
            <div className="decision-robustness-export"><p>Export includes scenario conclusions and record identifiers, but not the raw evidence records. It is bound to the current evidence fingerprint.</p><button className="secondary-button" type="button" onClick={exportResults} disabled={isStale || running}><Download size={14}/> Export sensitivity report</button></div>
            <details className="decision-robustness-verify">
              <summary>Verify an exported sensitivity report</summary>
              <p>Checks that a previously exported JSON report matches the evidence snapshot currently loaded in this investigation. A tampered or out-of-date file will not verify as current.</p>
              <input type="file" accept="application/json,.json" aria-label="Choose a sensitivity report to verify" onChange={(event) => { const file = event.target.files?.[0]; if (file) void verifyExportFile(file); event.target.value = ''; }} />
              {verifyMessage && <p className="decision-robustness-verify-message" role="status">{verifyMessage}</p>}
            </details>
          </div>}
        </>
      )}
      <p className="decision-robustness-footer">WaterChain does not estimate probabilities, model physical-world contamination, or prove causation through this feature. Run tests only on evidence you are authorized to analyze.</p>
    </section>
  );
}
