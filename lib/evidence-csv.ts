import {
  analytes, controlStates, evidenceRecordSchema, resultStates, stages,
  type EvidenceRecord,
} from './evidence';

export type CsvImportResult = {
  records: EvidenceRecord[];
  errors: { row: number; message: string }[];
};

// CSV parser supports commas, CRLF, escaped double quotes, and quoted newlines.
function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (quoted) throw new Error('The CSV contains an opening quote without a matching closing quote.');
  if (cell.length > 0 || row.length > 0) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[ -]+/g, '_');
}
function nullable(value: string | undefined) { const trimmed = value?.trim() ?? ''; return trimmed ? trimmed : null; }
function parseControl(value: string | undefined): (typeof controlStates)[number] {
  const normalized = value?.trim().toLowerCase() ?? '';
  return controlStates.includes(normalized as (typeof controlStates)[number]) ? normalized as (typeof controlStates)[number] : 'not_recorded';
}

export function parseEvidenceCsv(input: string, existingRecordCodes: readonly string[] = []): CsvImportResult {
  const rows = parseCsvRows(input);
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one evidence row.');
  const headers = rows[0].map(normalizeHeader);
  if (new Set(headers).size !== headers.length) throw new Error('CSV has duplicate column names after normalisation.');
  const supportedHeaders = new Set(['record_code', 'sample_code', 'stage', 'collected_at', 'water_source_id', 'batch_id', 'analyte', 'result', 'numeric_value', 'unit', 'method', 'lab_name', 'positive_control', 'negative_control', 'blank_control', 'source_reference', 'notes']);
  const unknownHeaders = headers.filter((header) => !supportedHeaders.has(header));
  if (unknownHeaders.length) throw new Error(`Unsupported CSV column(s): ${unknownHeaders.join(', ')}. Map or remove these columns before importing so their data is not silently discarded.`);
  for (const required of ['sample_code', 'stage']) {
    if (!headers.includes(required)) throw new Error(`Required CSV column is missing: ${required}`);
  }

  const records: EvidenceRecord[] = [];
  const errors: CsvImportResult['errors'] = [];
  const seenRecordCodes = new Set(existingRecordCodes.map((code) => code.trim().toLocaleLowerCase()));
  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    if (cells.length > headers.length) { errors.push({ row: rowNumber, message: `Row has ${cells.length - headers.length} extra cell(s) beyond the header columns.` }); return; }
    const values: Record<string, string> = {};
    headers.forEach((header, column) => { values[header] = cells[column] ?? ''; });
    const stage = values.stage.trim().toLowerCase();
    const analyte = (values.analyte || 'e_coli_presence').trim().toLowerCase();
    const result = (values.result || 'not_tested').trim().toLowerCase();
    if (!values.sample_code?.trim()) { errors.push({ row: rowNumber, message: 'sample_code is blank.' }); return; }
    if (!stages.includes(stage as (typeof stages)[number])) { errors.push({ row: rowNumber, message: `Unknown stage "${values.stage}". Use source, collection, storage, or serving.` }); return; }
    if (!analytes.includes(analyte as (typeof analytes)[number])) { errors.push({ row: rowNumber, message: `Unknown analyte "${analyte}".` }); return; }
    if (!resultStates.includes(result as (typeof resultStates)[number])) { errors.push({ row: rowNumber, message: `Unknown result "${result}".` }); return; }
    // Quality-control values must be one of pass / fail / not_recorded (or
    // blank, which means not recorded). An unknown value used to be silently
    // rewritten to not_recorded, turning an invalid row into a seemingly
    // valid record; it is now a row error like any other invalid value.
    for (const [field, value] of [['positive_control', values.positive_control], ['negative_control', values.negative_control], ['blank_control', values.blank_control]] as const) {
      const normalized = value?.trim().toLowerCase() ?? '';
      if (normalized && !controlStates.includes(normalized as (typeof controlStates)[number])) {
        errors.push({ row: rowNumber, message: `Unknown ${field} value "${value}". Use pass, fail, or not_recorded.` });
        return;
      }
    }

    let numericValue: number | null = null;
    if ((values.numeric_value ?? '').trim() !== '') {
      numericValue = Number(values.numeric_value);
      if (!Number.isFinite(numericValue)) { errors.push({ row: rowNumber, message: 'numeric_value must be a finite number or blank.' }); return; }
    }
    const record = {
      id: crypto.randomUUID(),
      recordCode: nullable(values.record_code) || `EV-CSV-${Date.now().toString(36).toUpperCase()}-${rowNumber}`,
      sampleCode: values.sample_code.trim(),
      stage: stage as (typeof stages)[number],
      collectedAt: nullable(values.collected_at),
      waterSourceId: nullable(values.water_source_id),
      batchId: nullable(values.batch_id),
      analyte: analyte as (typeof analytes)[number],
      result: result as (typeof resultStates)[number],
      numericValue,
      unit: nullable(values.unit),
      method: nullable(values.method),
      labName: nullable(values.lab_name),
      positiveControl: parseControl(values.positive_control),
      negativeControl: parseControl(values.negative_control),
      blankControl: parseControl(values.blank_control),
      sourceReference: nullable(values.source_reference),
      notes: nullable(values.notes),
      createdAt: new Date().toISOString(),
    };
    const normalizedRecordCode = record.recordCode.trim().toLocaleLowerCase();
    if (seenRecordCodes.has(normalizedRecordCode)) {
      errors.push({ row: rowNumber, message: `Duplicate record_code "${record.recordCode}" already exists in this import or the current investigation.` });
      return;
    }
    const parsed = evidenceRecordSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({ row: rowNumber, message: parsed.error.issues.map((issue) => issue.message).join('; ') });
      return;
    }
    seenRecordCodes.add(normalizedRecordCode);
    records.push(parsed.data);
  });
  return { records, errors };
}

export const EVIDENCE_CSV_TEMPLATE = [
  'record_code,sample_code,stage,collected_at,water_source_id,batch_id,analyte,result,numeric_value,unit,method,lab_name,positive_control,negative_control,blank_control,source_reference,notes',
].join('\r\n');
