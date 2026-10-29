'use client';

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, Download,
  FileSpreadsheet, FileWarning, Plus, Search, ShieldAlert, ShieldCheck, Trash2,
  Upload, X,
} from 'lucide-react';
import {
  analyteLabels, analytes, controlLabels, controlStates, evidenceRecordSchema,
  resultLabels, resultStates, reviewEvidence, stageLabels, stages, generateUniqueRecordCode,
  type Analyte, type ControlState, type EvidenceRecord, type EvidenceStage, type ResultState,
} from '@/lib/evidence';
import { EVIDENCE_CSV_TEMPLATE, parseEvidenceCsv, type CsvImportResult } from '@/lib/evidence-csv';

type Mode = 'manual' | 'csv';
type Draft = {
  sampleCode: string; stage: EvidenceStage; collectedAt: string; waterSourceId: string; batchId: string;
  analyte: Analyte; result: ResultState; numericValue: string; unit: string; method: string; labName: string;
  positiveControl: ControlState; negativeControl: ControlState; blankControl: ControlState;
  sourceReference: string; notes: string;
};

function emptyDraft(): Draft {
  return {
    sampleCode: '', stage: 'source', collectedAt: '', waterSourceId: '', batchId: '',
    analyte: 'e_coli_presence', result: 'not_tested', numericValue: '', unit: '', method: '', labName: '',
    positiveControl: 'not_recorded', negativeControl: 'not_recorded', blankControl: 'not_recorded',
    sourceReference: '', notes: '',
  };
}
function nullable(value: string) { const trimmed = value.trim(); return trimmed ? trimmed : null; }
function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  // Guard CSV exports against spreadsheet formula injection from user-entered text.
  const text = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function exportRecords(records: EvidenceRecord[], workspaceName: string) {
  const headers = ['record_code', 'sample_code', 'stage', 'collected_at', 'water_source_id', 'batch_id', 'analyte', 'result', 'numeric_value', 'unit', 'method', 'lab_name', 'positive_control', 'negative_control', 'blank_control', 'source_reference', 'notes'];
  const lines = records.map((r) => [r.recordCode, r.sampleCode, r.stage, r.collectedAt, r.waterSourceId, r.batchId, r.analyte, r.result, r.numericValue, r.unit, r.method, r.labName, r.positiveControl, r.negativeControl, r.blankControl, r.sourceReference, r.notes].map(csvCell).join(','));
  const safeName = workspaceName.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'investigation';
  downloadText(`waterchain-${safeName}-evidence-export.csv`, [headers.join(','), ...lines].join('\r\n'));
}
function exportWorkspaceBackup(records: EvidenceRecord[], workspaceName: string, workspaceId: string) {
  if (records.length === 0) return;
  const safeName = workspaceName.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'investigation';
  const backup = {
    backupSchema: 'waterchain-investigation-backup-v1',
    exportedAt: new Date().toISOString(),
    workspace: { id: workspaceId, name: workspaceName },
    recordCount: records.length,
    evidenceRecords: records,
    notice: 'Evidence snapshot only. This file does not authenticate laboratory records or establish contamination causation.',
    privacyNotice: 'May contain sensitive sample identifiers and notes. Store securely and share only with authorized people.',
  };
  downloadText(`waterchain-${safeName}-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
}

export default function EvidenceRegister({ records, onChange, onNotice, readOnly = false, workspaceId, workspaceName }: {
  records: EvidenceRecord[]; onChange: (next: EvidenceRecord[]) => void; onNotice: (message: string) => void; readOnly?: boolean; workspaceId: string; workspaceName: string;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [searchText, setSearchText] = useState('');
  const [filterStage, setFilterStage] = useState<'all' | EvidenceStage>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvImportResult | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [formError, setFormError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => records.filter((record) => {
    const matchesSearch = !searchText.trim() || [record.sampleCode, record.recordCode, record.waterSourceId, record.batchId, record.method, record.labName]
      .some((value) => value?.toLowerCase().includes(searchText.trim().toLowerCase()));
    return matchesSearch && (filterStage === 'all' || record.stage === filterStage);
  }), [records, searchText, filterStage]);

  const allReviews = useMemo(() => records.map((record) => ({ record, review: reviewEvidence(record, records) })), [records]);
  const blocked = allReviews.filter(({ review }) => review.status === 'blocked').length;
  const limited = allReviews.filter(({ review }) => review.status === 'limited').length;
  const metadataComplete = allReviews.filter(({ review }) => review.status === 'metadata_complete').length;

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function openManual() { if (readOnly) { onNotice('This workspace is read-only because stored data could not be fully validated. Export available records before trying to repair browser storage.'); return; } setDraft(emptyDraft()); setFormError(''); setMode('manual'); }
  function openCsv() { if (readOnly) { onNotice('This workspace is read-only because stored data could not be fully validated. Export available records before trying to repair browser storage.'); return; } setCsvPreview(null); setCsvFileName(''); setFormError(''); setMode('csv'); }

  function saveManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) { setFormError('This workspace became read-only because stored data could not be fully validated. Export available records and reload before editing.'); return; }
    let recordCode: string;
    try {
      recordCode = generateUniqueRecordCode(records.map((existing) => existing.recordCode));
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not generate a unique evidence record code.');
      return;
    }
    const record: EvidenceRecord = {
      id: crypto.randomUUID(),
      recordCode,
      sampleCode: draft.sampleCode.trim(),
      stage: draft.stage,
      collectedAt: draft.collectedAt ? new Date(draft.collectedAt).toISOString() : null,
      waterSourceId: nullable(draft.waterSourceId),
      batchId: nullable(draft.batchId),
      analyte: draft.analyte,
      result: draft.result,
      numericValue: draft.numericValue.trim() ? Number(draft.numericValue) : null,
      unit: nullable(draft.unit),
      method: nullable(draft.method),
      labName: nullable(draft.labName),
      positiveControl: draft.positiveControl,
      negativeControl: draft.negativeControl,
      blankControl: draft.blankControl,
      sourceReference: nullable(draft.sourceReference),
      notes: nullable(draft.notes),
      createdAt: new Date().toISOString(),
    };
    const parsed = evidenceRecordSchema.safeParse(record);
    if (!parsed.success) { setFormError(parsed.error.issues.map((issue) => issue.message).join(' ')); return; }
    const newCode = parsed.data.recordCode.trim().toLocaleLowerCase();
    if (records.some((existing) => existing.recordCode.trim().toLocaleLowerCase() === newCode)) {
      setFormError('An evidence record with this code already exists in the current investigation. Try saving again to generate a distinct code.');
      return;
    }
    if (draft.result === 'quantified' && (!draft.numericValue.trim() || !Number.isFinite(Number(draft.numericValue)))) {
      setFormError('Enter a valid numeric value for a quantitative result.'); return;
    }
    if (draft.result === 'quantified' && Number(draft.numericValue) < 0) { setFormError('Quantitative values cannot be negative.'); return; }
    onChange([...records, parsed.data]);
    setMode(null);
    onNotice(`Added evidence record ${parsed.data.recordCode}. Metadata validation flags are shown in the evidence register; no contamination diagnosis was generated.`);
  }

  async function readCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setCsvPreview(null); setFormError(''); setCsvFileName(file.name);
    try {
      if (file.size > 5_000_000) { setFormError('File exceeds the 5 MB prototype limit. Split it into smaller CSV files.'); return; }
      const text = await file.text();
      setCsvPreview(parseEvidenceCsv(text, records.map((record) => record.recordCode)));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not parse this CSV file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function confirmCsvImport() {
    if (readOnly || !csvPreview || csvPreview.records.length === 0) return;
    onChange([...records, ...csvPreview.records]);
    const count = csvPreview.records.length;
    const failed = csvPreview.errors.length;
    setMode(null); setCsvPreview(null);
    onNotice(`Imported ${count} record${count === 1 ? '' : 's'} from CSV.${failed ? ` ${failed} row${failed === 1 ? ' was' : 's were'} skipped; check the import report before retrying those rows.` : ''} No diagnosis was generated.`);
  }

  function removeRecord(record: EvidenceRecord) {
    if (readOnly) { onNotice('This workspace is read-only because stored data could not be fully validated.'); return; }
    onChange(records.filter((current) => current.id !== record.id));
    onNotice(`Removed ${record.recordCode} from this browser's local evidence register.`);
    if (expandedId === record.id) setExpandedId(null);
  }

  return (
    <section className="panel evidence-register-panel" id="evidence-register">
      <div className="panel-header evidence-register-header">
        <div><div className="panel-kicker">05 / DATA INTAKE & INTEGRITY</div><h2>Evidence register</h2><p>Record sample provenance and test metadata; validation is not a diagnosis.</p></div>
        <div className="register-actions"><button id="evidence-csv-open" className="secondary-button" disabled={readOnly} onClick={openCsv}><Upload size={14}/> Import CSV</button><button className="primary-button" disabled={readOnly} onClick={openManual}><Plus size={15}/> Add evidence</button></div>
      </div>
      <div className="register-privacy"><ShieldCheck size={14}/><span>{readOnly ? 'Read-only recovery view: storage validation failed, so edits are disabled to protect existing data. Export available records before recovery.' : 'Stored in this browser only. Nothing is uploaded to a server. Keep sensitive household information out of notes.'}</span><button onClick={() => downloadText('waterchain-evidence-template.csv', EVIDENCE_CSV_TEMPLATE)}><Download size={13}/> Download CSV template</button></div>

      <div className="integrity-summary">
        <div><span className="summary-label">TOTAL RECORDS</span><strong>{records.length}</strong></div>
        <div><span className="summary-label">NOT READY FOR ANALYSIS</span><strong className={blocked || allReviews.some(({ review }) => review.status === 'record_only') ? 'metric-warn' : ''}>{blocked + allReviews.filter(({ review }) => review.status === 'record_only').length}</strong></div>
        <div><span className="summary-label">LIMITED METADATA</span><strong className={limited ? 'metric-warn' : ''}>{limited}</strong></div>
        <div><span className="summary-label">NO REGISTER FLAGS</span><strong>{metadataComplete}</strong></div>
      </div>
      <p className="integrity-scope-note">Register flags are a record-level metadata screen, not diagnostic eligibility. The engine applies stricter checks and may exclude a record that has no register flags; see the diagnostic findings for the exact reason.</p>
  <div className="register-toolbar">
        <label className="register-search"><Search size={15}/><input id="evidence-record-search" aria-label="Search evidence records" placeholder="Search sample, batch, method…" value={searchText} onChange={(e) => setSearchText(e.target.value)}/></label>
        <label className="stage-filter"><span>Stage</span><select value={filterStage} onChange={(e) => setFilterStage(e.target.value as 'all' | EvidenceStage)}><option value="all">All stages</option>{stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select><ChevronDown size={13}/></label>
        <button className="quiet-button" disabled={records.length === 0} onClick={() => exportRecords(records, workspaceName)}><Download size={14}/> Export CSV</button><button className="quiet-button" disabled={records.length === 0} onClick={() => exportWorkspaceBackup(records, workspaceName, workspaceId)}><Download size={14}/> JSON backup</button>
      </div>

      {records.length === 0 ? <div className="register-empty"><div className="register-empty-icon"><FileSpreadsheet size={22}/></div><h3>No evidence records yet</h3><p>Add a real sample record manually or import a CSV using the documented column names. Empty fields are kept visible as validation warnings instead of silently invented.</p><div className="register-empty-actions"><button className="primary-button" disabled={readOnly} onClick={openManual}><Plus size={15}/> Add first record</button><button className="secondary-button" disabled={readOnly} onClick={openCsv}><Upload size={14}/> Import CSV</button></div></div> : filtered.length === 0 ? <div className="register-no-results">No records match this search or stage filter.</div> : <div className="evidence-table-wrap"><table className="evidence-table"><thead><tr><th>Sample / record</th><th>Stage</th><th>Collected</th><th>Test & result</th><th>Integrity review</th><th aria-label="Actions"></th></tr></thead><tbody>{filtered.map((record) => {
        const review = reviewEvidence(record, records);
        const blockers = review.issues.filter((issue) => issue.severity === 'blocker').length;
        const warnings = review.issues.filter((issue) => issue.severity === 'warning').length;
        return <FragmentRow key={record.id} record={record} blockers={blockers} warnings={warnings} reviewStatus={review.status} allRecords={records} expanded={expandedId === record.id} onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)} onRemove={() => removeRecord(record)} readOnly={readOnly} />;
      })}</tbody></table></div>}

      <div className="register-disclaimer"><AlertCircle size={14}/><span>“Metadata checks clear” only means no configured integrity blocker was found. It does not certify the laboratory result, establish contamination source, or enable a public-health conclusion.</span></div>

      {mode && <div className="modal-backdrop evidence-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMode(null); }}><section className="modal evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title">
        <div className="modal-top"><div className="modal-icon">{mode === 'manual' ? <Plus size={18}/> : <FileSpreadsheet size={18}/>}</div><button className="small-icon-button" aria-label="Close evidence dialog" onClick={() => setMode(null)}><X size={17}/></button></div>
        <div className="panel-kicker">EVIDENCE INTAKE / STEP 02</div><h2 id="evidence-modal-title">{mode === 'manual' ? 'Add a sample record' : 'Import evidence from CSV'}</h2>
        <p className="modal-description">{mode === 'manual' ? 'Enter only what the source record supports. Leave unknown fields blank; WaterChain will flag the gaps.' : 'CSV import validates required columns and basic row structure. Parsed rows are previewed before they are added; malformed rows are skipped with explicit reasons. Metadata-integrity checks run after import.'}</p>
        <div className="intake-tabs"><button className={mode === 'manual' ? 'intake-tab active' : 'intake-tab'} onClick={() => { setMode('manual'); setFormError(''); }}>Manual entry</button><button className={mode === 'csv' ? 'intake-tab active' : 'intake-tab'} onClick={openCsv}>CSV import</button></div>
        {mode === 'manual' ? <form onSubmit={saveManual} className="evidence-form">
          <div className="form-section-title">IDENTITY & TIMING</div>
          <div className="form-grid"><div><label className="field-label" htmlFor="sample-code">Sample ID <span className="required-mark">*</span></label><input id="sample-code" className="text-input" required maxLength={100} placeholder="Use the ID from the actual sample record" value={draft.sampleCode} onChange={(e) => setField('sampleCode', e.target.value)}/></div><div><label className="field-label" htmlFor="sample-stage">Pathway stage <span className="required-mark">*</span></label><select id="sample-stage" className="form-select" value={draft.stage} onChange={(e) => setField('stage', e.target.value as EvidenceStage)}>{stages.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></div>
            <div><label className="field-label" htmlFor="collected-at">Collection date & time</label><input id="collected-at" className="text-input" type="datetime-local" value={draft.collectedAt} onChange={(e) => setField('collectedAt', e.target.value)}/><span className="field-hint">Leave blank only when the source record omits it.</span></div><div><label className="field-label" htmlFor="water-source">Water-source ID</label><input id="water-source" className="text-input" placeholder="Recorded source identifier" value={draft.waterSourceId} onChange={(e) => setField('waterSourceId', e.target.value)}/></div><div><label className="field-label" htmlFor="batch-id">Batch / transfer ID</label><input id="batch-id" className="text-input" placeholder="Link this water journey if known" value={draft.batchId} onChange={(e) => setField('batchId', e.target.value)}/></div></div>
          <div className="form-section-title">TEST RESULT</div>
          <div className="form-grid"><div><label className="field-label" htmlFor="analyte">Test / analyte</label><select id="analyte" className="form-select" value={draft.analyte} onChange={(e) => setField('analyte', e.target.value as Analyte)}>{analytes.map((analyte) => <option key={analyte} value={analyte}>{analyteLabels[analyte]}</option>)}</select></div><div><label className="field-label" htmlFor="result-state">Reported outcome</label><select id="result-state" className="form-select" value={draft.result} onChange={(e) => setField('result', e.target.value as ResultState)}>{resultStates.map((result) => <option key={result} value={result}>{resultLabels[result]}</option>)}</select></div>
            {draft.result === 'quantified' && <><div><label className="field-label" htmlFor="numeric-value">Numeric value <span className="required-mark">*</span></label><input id="numeric-value" className="text-input" type="number" step="any" min="0" required value={draft.numericValue} onChange={(e) => setField('numericValue', e.target.value)}/></div><div><label className="field-label" htmlFor="result-unit">Unit <span className="required-mark">*</span></label><input id="result-unit" className="text-input" required placeholder="e.g. CFU/100 mL or NTU" value={draft.unit} onChange={(e) => setField('unit', e.target.value)}/></div></>}
            <div><label className="field-label" htmlFor="method">Test method</label><input id="method" className="text-input" placeholder="Method name / standard as reported" value={draft.method} onChange={(e) => setField('method', e.target.value)}/></div><div><label className="field-label" htmlFor="lab-name">Laboratory / testing provider</label><input id="lab-name" className="text-input" placeholder="Provider named on the result" value={draft.labName} onChange={(e) => setField('labName', e.target.value)}/></div></div>
          <div className="form-section-title">QUALITY CONTROL & PROVENANCE</div>
          <div className="form-grid three-cols">{([['positiveControl','Positive control'], ['negativeControl','Negative control'], ['blankControl','Blank control']] as const).map(([key,label]) => <div key={key}><label className="field-label" htmlFor={key}>{label}</label><select id={key} className="form-select" value={draft[key]} onChange={(e) => setField(key, e.target.value as ControlState)}>{controlStates.map((state) => <option key={state} value={state}>{controlLabels[state]}</option>)}</select></div>)}</div>
          <div className="form-grid"><div><label className="field-label" htmlFor="source-reference">Report / source reference</label><input id="source-reference" className="text-input" placeholder="Actual lab report ID or document reference" value={draft.sourceReference} onChange={(e) => setField('sourceReference', e.target.value)}/></div><div><label className="field-label" htmlFor="notes">Notes</label><input id="notes" className="text-input" maxLength={500} placeholder="Neutral factual note; no personal details" value={draft.notes} onChange={(e) => setField('notes', e.target.value)}/></div></div>
          {formError && <div className="form-error"><AlertCircle size={15}/>{formError}</div>}
          <div className="intake-note"><CircleHelp size={15}/><span>Missing metadata does not prevent preserving a record. It will, however, block or limit its use in future analysis.</span></div>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setMode(null)}>Cancel</button><button type="submit" className="primary-button">Save evidence record <Plus size={14}/></button></div>
        </form> : <div className="csv-intake">
          <div className="csv-upload-box"><input ref={fileInput} type="file" accept=".csv,text/csv" aria-label="Choose CSV file" onChange={readCsv}/><div className="csv-upload-icon"><Upload size={21}/></div><strong>Choose a CSV file</strong><p>Up to 5 MB · UTF-8 recommended · Header row required</p><button className="secondary-button" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={14}/> Browse CSV files</button>{csvFileName && <span className="selected-file">Selected: {csvFileName}</span>}</div>
          <div className="csv-column-note"><strong>Required headers</strong><code>sample_code, stage</code><strong>Supported stages</strong><code>source · collection · storage · serving</code><strong>Result values</strong><code>detected · not_detected · quantified · not_tested · invalid</code></div>
          {formError && <div className="form-error"><AlertCircle size={15}/>{formError}</div>}
          {csvPreview && <div className="csv-preview"><div className="csv-preview-heading"><div><strong>Import preview</strong><span>{csvFileName}</span></div><div className="csv-counts"><span className="csv-count-good">{csvPreview.records.length} parsed</span><span className={csvPreview.errors.length ? 'csv-count-bad' : ''}>{csvPreview.errors.length} skipped</span></div></div>{csvPreview.records.length > 0 && <div className="csv-preview-table"><table><thead><tr><th>Sample ID</th><th>Stage</th><th>Result</th></tr></thead><tbody>{csvPreview.records.slice(0, 6).map((record) => <tr key={record.id}><td>{record.sampleCode}</td><td>{stageLabels[record.stage]}</td><td>{resultLabels[record.result]}</td></tr>)}</tbody></table>{csvPreview.records.length > 6 && <p>Showing 6 of {csvPreview.records.length} parsed records.</p>}</div>}{csvPreview.errors.length > 0 && <div className="csv-errors"><strong><FileWarning size={14}/> Rows skipped due to import errors</strong><ul>{csvPreview.errors.slice(0, 8).map((error) => <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>)}</ul>{csvPreview.errors.length > 8 && <p>And {csvPreview.errors.length - 8} more row errors.</p>}</div>}{csvPreview.records.length === 0 && <div className="form-error"><AlertCircle size={15}/>No valid rows to import. Fix the errors or select another file.</div>}</div>}
          <div className="intake-note"><ShieldCheck size={15}/><span>Import preserves the values you provide. WaterChain does not infer missing outcomes, assign source identities, or create measurements.</span></div>
          <div className="modal-actions"><button className="secondary-button" onClick={() => downloadText('waterchain-evidence-template.csv', EVIDENCE_CSV_TEMPLATE)}><Download size={14}/> Template</button><button className="secondary-button" onClick={() => setMode(null)}>Cancel</button><button className="primary-button" disabled={readOnly || !csvPreview || csvPreview.records.length === 0} onClick={confirmCsvImport}>Import {csvPreview?.records.length ?? 0} parsed rows <ArrowIcon/></button></div>
        </div>}
      </section></div>}
    </section>
  );
}

function ArrowIcon() { return <span aria-hidden="true">→</span>; }

function FragmentRow({ record, blockers, warnings, reviewStatus, allRecords, expanded, onToggle, onRemove, readOnly = false }: {
  record: EvidenceRecord; blockers: number; warnings: number; reviewStatus: ReturnType<typeof reviewEvidence>['status']; allRecords: EvidenceRecord[];
  expanded: boolean; onToggle: () => void; onRemove: () => void; readOnly?: boolean;
}) {
  const review = reviewEvidence(record, allRecords);
  const statusCopy = reviewStatus === 'blocked' ? 'Blocked' : reviewStatus === 'limited' ? 'Limited' : reviewStatus === 'record_only' ? 'No result' : 'No register flags';
  const statusClass = reviewStatus === 'blocked' ? 'integrity-blocked' : reviewStatus === 'limited' ? 'integrity-limited' : reviewStatus === 'record_only' ? 'integrity-record-only' : 'integrity-clear';
  const collected = record.collectedAt && !Number.isNaN(new Date(record.collectedAt).getTime()) ? new Date(record.collectedAt).toLocaleString() : 'Not recorded';
  return <>
    <tr className="evidence-data-row"><td><button className="sample-identity-button" onClick={onToggle}><strong>{record.sampleCode}</strong><span>{record.recordCode}</span></button></td><td><span className="stage-chip">{stageLabels[record.stage]}</span></td><td><span className={record.collectedAt ? 'table-date' : 'table-missing'}>{collected}</span></td><td><span className="test-name">{record.analyte === 'e_coli_presence' ? 'E. coli presence / absence' : record.analyte === 'e_coli_concentration' ? 'E. coli concentration' : record.analyte === 'free_chlorine' ? 'Free chlorine' : record.analyte === 'turbidity' ? 'Turbidity' : 'Other test'}</span><span className="test-result">{record.result === 'quantified' ? `${record.numericValue ?? 'Missing value'} ${record.unit ?? ''}` : resultLabels[record.result]}</span></td><td><button className={`integrity-badge ${statusClass}`} onClick={onToggle}>{reviewStatus === 'blocked' ? <ShieldAlert size={13}/> : reviewStatus === 'limited' ? <AlertTriangle size={13}/> : reviewStatus === 'record_only' ? <CircleHelp size={13}/> : <CheckCircle2 size={13}/>}<span>{statusCopy}</span>{blockers > 0 && <b>{blockers}B</b>}{warnings > 0 && <b>{warnings}W</b>}</button></td><td><div className="row-actions"><button className="small-icon-button" aria-label={`Review ${record.sampleCode}`} onClick={onToggle}><ChevronDown size={14}/></button><button className="small-icon-button danger-action" disabled={readOnly} aria-label={`Remove ${record.sampleCode}`} onClick={onRemove}><Trash2 size={14}/></button></div></td></tr>
    {expanded && <tr className="evidence-detail-row"><td colSpan={6}><div className="evidence-detail-grid"><div><span className="detail-label">WATER SOURCE ID</span><strong>{record.waterSourceId || 'Not recorded'}</strong></div><div><span className="detail-label">BATCH / TRANSFER ID</span><strong>{record.batchId || 'Not recorded'}</strong></div><div><span className="detail-label">METHOD / LAB</span><strong>{[record.method, record.labName].filter(Boolean).join(' · ') || 'Not recorded'}</strong></div><div><span className="detail-label">REPORT REFERENCE</span><strong>{record.sourceReference || 'Not recorded'}</strong></div><div><span className="detail-label">QUALITY CONTROL</span><strong>Positive: {controlLabels[record.positiveControl]} · Negative: {controlLabels[record.negativeControl]} · Blank: {controlLabels[record.blankControl]}</strong></div>{record.notes && <div><span className="detail-label">NOTES</span><strong>{record.notes}</strong></div>}</div><div className="issue-list"><div className="detail-label">VALIDATION FINDINGS</div>{review.issues.length === 0 ? <p className="no-issues"><CheckCircle2 size={14}/> No configured metadata blockers or warnings. This is not a diagnostic conclusion.</p> : review.issues.map((issue) => <div className={`issue-row issue-${issue.severity}`} key={issue.code}>{issue.severity === 'blocker' ? <ShieldAlert size={13}/> : issue.severity === 'warning' ? <AlertTriangle size={13}/> : <CircleHelp size={13}/>}<span>{issue.message}</span></div>)}</div></td></tr>}
  </>;
}
