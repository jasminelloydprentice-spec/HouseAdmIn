import { z } from 'npm:zod@3.24.1';
import { encodeBase64 } from '../_shared/base64.ts';
import { DocumentAnalysis } from '../_shared/analysisSchema.ts';
import { isHouseholdMember, serviceClient, verifyUser } from '../_shared/auth.ts';
import { ClaudeProvider } from '../_shared/claudeProvider.ts';
import { errorResponse, handleOptions, jsonResponse } from '../_shared/http.ts';
import { MockProvider } from '../_shared/mockProvider.ts';
import { AnalysisProviderError, DocumentAnalysisProvider } from '../_shared/provider.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

const bodySchema = z.object({ documentId: z.string().uuid() }).strict();

const MAX_FILES = Number(Deno.env.get('ANALYSIS_MAX_PAGES') ?? '20');
const RATE_LIMIT = Number(Deno.env.get('RATE_LIMIT_PROCESS_PER_HOUR') ?? '30');

function buildProvider(): DocumentAnalysisProvider {
  if ((Deno.env.get('MOCK_ANALYSIS') ?? 'false') === 'true') return new MockProvider();
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured (or set MOCK_ANALYSIS=true)');
  return new ClaudeProvider(apiKey, Deno.env.get('ANALYSIS_MODEL') ?? 'claude-sonnet-5');
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  // 1. Authenticate — the JWT, not the body, decides who this is.
  const user = await verifyUser(req);
  if (!user) return errorResponse('Not authenticated', 401);

  // 2. Validate input.
  let documentId: string;
  try {
    const body = bodySchema.parse(await req.json());
    documentId = body.documentId;
  } catch {
    return errorResponse('Invalid request', 400);
  }

  const db = serviceClient();

  // 3. Load the document and verify the caller belongs to its household.
  const { data: doc, error: docError } = await db
    .from('documents')
    .select('id, household_id, status, title, category, provider, summary, page_count')
    .eq('id', documentId)
    .maybeSingle();
  if (docError || !doc) return errorResponse('Document not found', 404);
  if (!(await isHouseholdMember(user.userId, doc.household_id))) {
    // Same response as not-found: no existence oracle for other households.
    return errorResponse('Document not found', 404);
  }

  // 4. Rate limit costly work.
  if (!(await checkRateLimit(user.userId, 'process-document', RATE_LIMIT))) {
    return errorResponse('Too many analysis requests — try again later', 429);
  }

  // 5. Idempotency: only one processor at a time; don't re-analyse silently.
  if (doc.status === 'processing') return jsonResponse({ status: 'already_processing' });
  if (doc.status === 'ready' || doc.status === 'needs_review') {
    return jsonResponse({ status: 'already_analysed' });
  }

  // 6. Claim the queued job (or create one) and mark the document.
  const { data: queuedJob } = await db
    .from('processing_jobs')
    .select('id, attempt')
    .eq('document_id', documentId)
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let jobId: string;
  if (queuedJob) {
    jobId = queuedJob.id;
    await db
      .from('processing_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);
  } else {
    const { data: newJob, error: jobError } = await db
      .from('processing_jobs')
      .insert({
        document_id: documentId,
        household_id: doc.household_id,
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (jobError || !newJob) return errorResponse('Could not start processing', 500, jobError?.message);
    jobId = newJob.id;
  }
  await db.from('documents').update({ status: 'processing' }).eq('id', documentId);

  const fail = async (publicMessage: string, logDetail?: string) => {
    await db
      .from('processing_jobs')
      .update({ status: 'failed', error: publicMessage, finished_at: new Date().toISOString() })
      .eq('id', jobId);
    await db.from('documents').update({ status: 'failed' }).eq('id', documentId);
    return errorResponse(publicMessage, 422, logDetail);
  };

  try {
    // 7. Load and validate the original files.
    const { data: files, error: filesError } = await db
      .from('document_files')
      .select('storage_path, mime_type, page_number, size_bytes')
      .eq('document_id', documentId)
      .eq('kind', 'original')
      .order('page_number', { ascending: true });
    if (filesError || !files || files.length === 0) {
      return await fail('No files found to analyse');
    }
    if (files.length > MAX_FILES) {
      return await fail(`Documents are limited to ${MAX_FILES} pages`);
    }

    const inputs = [];
    for (const file of files) {
      const { data: blob, error: dlError } = await db.storage.from('documents').download(file.storage_path);
      if (dlError || !blob) return await fail('A stored file could not be read');
      inputs.push({
        base64: encodeBase64(await blob.arrayBuffer()),
        mimeType: file.mime_type,
        pageNumber: file.page_number,
      });
    }

    // 8. Analyse (provider validates + one repair retry internally).
    const provider = buildProvider();
    const todayIso = new Date().toISOString().slice(0, 10);
    const result = await provider.analyseDocument({ files: inputs, todayIso });
    const analysis: DocumentAnalysis = result.analysis;

    // 9. Persist pages (replace), fields (never clobber user-authored rows),
    //    and document columns.
    await db.from('document_pages').delete().eq('document_id', documentId);
    if (analysis.pages.length > 0) {
      const { error: pagesError } = await db.from('document_pages').insert(
        analysis.pages.map((p) => ({
          document_id: documentId,
          household_id: doc.household_id,
          page_number: p.page_number,
          text: p.text,
          is_unreadable: p.is_unreadable,
        })),
      );
      if (pagesError) return await fail('Extracted text could not be stored', pagesError.message);
    }

    const { data: existingFields } = await db
      .from('document_fields')
      .select('key, source')
      .eq('document_id', documentId);
    const userOwnedKeys = new Set(
      (existingFields ?? []).filter((f) => f.source !== 'ai').map((f) => f.key),
    );
    const aiFields = analysis.fields.filter((f) => !userOwnedKeys.has(f.key));
    if (aiFields.length > 0) {
      const { error: fieldsError } = await db.from('document_fields').upsert(
        aiFields.map((f) => ({
          document_id: documentId,
          household_id: doc.household_id,
          key: f.key,
          label: f.label,
          value_text: f.value_text,
          value_date: f.value_date,
          value_number: f.value_number,
          currency: f.currency,
          confidence: f.confidence,
          source: 'ai',
          page_number: f.page_number,
          evidence_text: f.evidence_text,
        })),
        { onConflict: 'document_id,key' },
      );
      if (fieldsError) return await fail('Extracted fields could not be stored', fieldsError.message);
    }

    const { error: updateError } = await db
      .from('documents')
      .update({
        status: 'needs_review',
        title: analysis.title ?? doc.title,
        category: analysis.category ?? doc.category,
        provider: analysis.provider ?? doc.provider,
        doc_type: analysis.doc_type,
        document_date: analysis.document_date,
        received_date: analysis.received_date,
        summary: analysis.summary,
        summary_source: analysis.summary ? 'ai' : null,
        action_required: analysis.action_required,
        deadline_date: analysis.deadline_date,
        renewal_date: analysis.renewal_date,
        expiry_date: analysis.expiry_date,
        appointment_at: analysis.appointment_at,
        is_important: analysis.is_important,
        supersedes_hint: analysis.supersedes_hint,
        page_count: analysis.pages.length,
        analysis: analysis as unknown as Record<string, unknown>,
        analysis_model: result.usage.model,
        analysed_at: new Date().toISOString(),
      })
      .eq('id', documentId);
    if (updateError) return await fail('The document could not be updated', updateError.message);

    // 10. Close the job with usage (token counts only — never content).
    await db
      .from('processing_jobs')
      .update({
        status: 'succeeded',
        model: result.usage.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        pages_processed: analysis.pages.length,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    await db.from('audit_events').insert({
      household_id: doc.household_id,
      user_id: user.userId,
      event_type: 'document_analysed',
      entity: 'documents',
      entity_id: documentId,
    });

    return jsonResponse({ status: 'needs_review' });
  } catch (err) {
    const isProviderError = err instanceof AnalysisProviderError;
    const publicMessage = isProviderError
      ? err.retryable
        ? 'The analysis service is busy — try again shortly'
        : 'The document could not be analysed automatically'
      : 'Analysis failed unexpectedly';
    return await fail(publicMessage, err instanceof Error ? err.message : String(err));
  }
});
