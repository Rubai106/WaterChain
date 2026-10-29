import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evidenceRecordSchema } from '@/lib/evidence';
import { diagnosticReportSchema } from '@/lib/diagnostics';
import { selectedJourneyModelSchema } from '@/lib/investigation-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  records: z.array(evidenceRecordSchema).max(500, 'A single review is limited to 500 records.'),
  journeyModel: selectedJourneyModelSchema.optional(),
});

const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const ENGINE_NAME = 'waterchain-rule-engine-v1';

class RequestBodyTooLargeError extends Error {
  constructor() { super('Request body exceeds the configured limit.'); this.name = 'RequestBodyTooLargeError'; }
}

async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(combined);
}

function stableEvidenceHash(records: z.infer<typeof evidenceRecordSchema>[]): string {
  // Key order is schema-defined; sorting records makes the digest stable if the UI order changes.
  const canonical = [...records].sort((a, b) =>
    a.recordCode.localeCompare(b.recordCode) || a.id.localeCompare(b.id) || JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

function runPython(records: unknown[], journeyModel?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3');
    const script = path.join(process.cwd(), 'engine', 'diagnose_cli.py');
    const child = spawn(python, [script], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;

    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    };
    const timeout = setTimeout(() => finishError(new Error('Diagnostic engine timed out.')), TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        finishError(new Error('Diagnostic engine response exceeded the output limit.'));
        return;
      }
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8').slice(0, 8000); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      finishError(new Error(`Could not start Python (${python}): ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        try {
          const parsed = JSON.parse(stdout) as { error?: string };
          reject(new Error(parsed.error || stderr || `Python engine exited with code ${code}.`));
        } catch {
          reject(new Error(stderr || `Python engine exited with code ${code}.`));
        }
        return;
      }
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error('Python engine returned malformed JSON.')); }
    });
    child.stdin.on('error', () => { /* close/error handlers settle the request */ });
    child.stdin.end(JSON.stringify({ records, ...(journeyModel ? { journey_model: journeyModel } : {}) }));
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'Request body exceeds the 2 MiB limit.', requestId }, { status: 413 });
  }

  let payload: unknown;
  let body: string;
  try {
    body = await readBodyWithLimit(request, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body exceeds the 2 MiB limit.', requestId }, { status: 413 });
    }
    return NextResponse.json({ error: 'Could not read request body. Retry with a valid JSON payload.', requestId }, { status: 400 });
  }
  try { payload = JSON.parse(body); }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.', requestId }, { status: 400 }); }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Evidence payload failed request validation.',
      requestId,
      details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    }, { status: 400 });
  }

  try {
    const rawReport = await runPython(parsed.data.records, parsed.data.journeyModel);
    const checkedReport = diagnosticReportSchema.safeParse(rawReport);
    if (!checkedReport.success) {
      throw new Error('Diagnostic engine response did not match the report contract.');
    }
    return NextResponse.json({
      report: checkedReport.data,
      generatedAt: new Date().toISOString(),
      engine: ENGINE_NAME,
      requestId,
      evidenceSha256: stableEvidenceHash(parsed.data.records),
      journeySha256: parsed.data.journeyModel ? createHash('sha256').update(JSON.stringify(parsed.data.journeyModel), 'utf8').digest('hex') : null,
    });
  } catch (error) {
    // Log only a request ID and safe error class/message; never log evidence records.
    const internalMessage = error instanceof Error ? error.message : 'Unknown diagnostic service error.';
    console.error(`[WaterChain diagnostic ${requestId}] ${internalMessage}`);
    return NextResponse.json({
      error: 'The diagnostic engine could not complete this review. Check the server setup and logs.',
      requestId,
    }, { status: 503 });
  }
}
