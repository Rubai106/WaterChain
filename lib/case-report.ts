import type { DiagnosticReport } from '@/lib/diagnostics';
import type { SelectedJourneyModel } from '@/lib/investigation-model';

/**
 * Builds a human-readable Markdown case report from a diagnostic review.
 *
 * This is a presentation of the report already shown in the workbench; it
 * performs no inference of its own. The report deliberately references
 * records by code (with stage, result, and engine eligibility) rather than
 * embedding full records — the machine-readable review bundle (JSON)
 * remains the complete record. It reproduces the conclusion *and* the
 * uncertainties: exclusions with reasons, unresolved findings, and the
 * engine's own limitations. It never invents probabilities or causal claims.
 */
export type CaseReportInput = {
  workspaceName: string;
  generatedAt: string;
  engineName: string;
  requestId: string;
  evidenceSha256: string;
  journeySha256: string | null;
  recordCount: number;
  report: DiagnosticReport;
  journeyModel: SelectedJourneyModel | null;
};

function line(text = ''): string {
  return `${text}\n`;
}

export function buildCaseReportMarkdown(input: CaseReportInput): string {
  const { workspaceName, generatedAt, engineName, requestId, evidenceSha256, journeySha256, recordCount, report, journeyModel } = input;
  const out: string[] = [];
  const stageNames: Record<string, string> = { source: 'Source', collection: 'Collection', storage: 'Storage', serving: 'Serving' };

  out.push(line(`# WaterChain case report — ${workspaceName}`));
  out.push(line(`Exported ${new Date().toISOString()} (UTC).`));
  out.push(line());
  out.push(line('## Review provenance'));
  out.push(line(`- Review generated: ${generatedAt}`));
  out.push(line(`- Engine: ${engineName} (rule-based; no probabilities are estimated)`));
  out.push(line(`- Request ID: ${requestId}`));
  out.push(line(`- Evidence records submitted: ${recordCount}`));
  out.push(line(`- Evidence SHA-256: ${evidenceSha256}`));
  out.push(line(`- Journey model SHA-256: ${journeySha256 ?? 'none (shared-batch mode)'}`));
  out.push(line(`- Relationship model: ${journeyModel ? 'explicit water journey' : 'legacy shared-batch'}`));
  out.push(line('- A SHA-256 fingerprint detects whether this evidence snapshot changed; it does not authenticate the records or prove they are true.'));
  out.push(line());

  out.push(line('## Engine conclusion'));
  out.push(line(`**${report.confidence_label}**`));
  out.push(line());
  out.push(line(report.conclusion));
  out.push(line());
  out.push(line(report.attribution_permitted
    ? 'Cross-stage comparison passed the engine\u2019s minimum structural gates. Causal origin remains uncertain.'
    : 'The engine has not permitted contamination entry-point attribution from this evidence set.'));
  out.push(line());

  out.push(line('## Stage hypotheses'));
  for (const h of report.hypotheses) {
    const name = stageNames[h.stage] ?? h.stage;
    out.push(line(`### ${name} — ${h.status.replaceAll('_', ' ')}`));
    out.push(line(h.explanation));
    out.push(line(`- Supporting evidence: ${h.supporting_evidence.length ? h.supporting_evidence.join(', ') : 'none recorded'}`));
    out.push(line(`- Contradicting evidence: ${h.contradicting_evidence.length ? h.contradicting_evidence.join(', ') : 'none recorded'}`));
    out.push(line());
  }

  out.push(line('## Record eligibility (engine gate)'));
  out.push(line('Records are referenced by code, not embedded in full. "Excluded" rows list the engine\u2019s exact reason; a record excluded here contributed nothing to pathway hypotheses.'));
  out.push(line());
  if (report.record_eligibility && report.record_eligibility.length > 0) {
    out.push(line('| Record | Stage | Result | Engine eligibility |'));
    out.push(line('| --- | --- | --- | --- |'));
    for (const entry of report.record_eligibility) {
      const state = entry.eligible ? (entry.on_pathway ? 'Eligible · on pathway' : 'Eligible · off selected pathway') : `Excluded — ${entry.reason}`;
      out.push(line(`| ${entry.record_code} | ${stageNames[entry.stage] ?? entry.stage} | ${entry.result_kind} | ${state} |`));
    }
  } else {
    out.push(line('Per-record eligibility is unavailable for this report (it predates the eligibility field). Run a new review.'));
  }
  out.push(line());

  out.push(line('## Integrity and inference findings'));
  if (report.findings.length === 0) {
    out.push(line('No findings recorded.'));
  } else {
    for (const f of report.findings) {
      out.push(line(`- **[${f.severity}] ${f.code.replaceAll('_', ' ')}** — ${f.message}${f.record_ids.length ? ` (records: ${f.record_ids.join(', ')})` : ''}`));
    }
  }
  out.push(line());

  if (report.lineage_review) {
    out.push(line('## Lineage review'));
    out.push(line(`- Mode: ${report.lineage_review.mode}`));
    out.push(line(`- Status: ${report.lineage_review.status}`));
    for (const edge of report.lineage_review.transfer_edges) {
      out.push(line(`- Transfer ${stageNames[edge.from_stage] ?? edge.from_stage} → ${stageNames[edge.to_stage] ?? edge.to_stage}: ${edge.status} (${edge.count} event(s))`));
    }
    for (const blocker of report.lineage_review.blockers) {
      out.push(line(`- Unresolved: ${blocker}`));
    }
    out.push(line());
  }

  out.push(line('## Recommended next evidence step'));
  out.push(line(report.next_step.action));
  out.push(line(report.next_step.reason));
  if (report.next_step.target_stage) out.push(line(`Target stage: ${stageNames[report.next_step.target_stage] ?? report.next_step.target_stage}`));
  out.push(line());

  if (report.next_actions && report.next_actions.length > 0) {
    out.push(line('## Explainable next-action options'));
    for (const a of report.next_actions) {
      out.push(line(`### ${a.title} (${a.priority} priority · ${a.action_type.replaceAll('_', ' ')})`));
      out.push(line(a.why));
      out.push(line(`- If positive: ${a.what_positive_would_mean}`));
      out.push(line(`- If negative: ${a.what_negative_would_mean}`));
      out.push(line(`- Prerequisites: ${a.prerequisites.join('; ')}`));
      out.push(line());
    }
  }

  out.push(line('## Limitations (engine-stated)'));
  for (const limitation of report.limitations) {
    out.push(line(`- ${limitation}`));
  }
  out.push(line());

  out.push(line('## Interpretation notice'));
  out.push(line('Rule-based prototype output. This report does not establish water safety, prove contamination causation, or replace qualified field and laboratory procedures. Verify source records independently before use.'));
  out.push(line('This export references records by code; the full evidence records live in the machine-readable review bundle (JSON). Store and share both only with authorized reviewers.'));

  return out.join('');
}
