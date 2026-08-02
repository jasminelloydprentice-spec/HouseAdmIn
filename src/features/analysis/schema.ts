import { z } from 'zod';
import { CATEGORY_SLUGS } from '../../config/categories';

/**
 * Strict schema for AI document analysis output.
 *
 * Principles:
 * - null for anything not clearly present — guessing is a schema violation
 *   in spirit and rejected in review;
 * - every important value carries confidence + page evidence;
 * - unknown keys are rejected (`.strict()`), so injected instructions can't
 *   smuggle extra data into the database.
 *
 * NOTE: a Deno copy lives at supabase/functions/_shared/analysisSchema.ts.
 * Keep the two in sync (see CLAUDE.md).
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dates must be ISO YYYY-MM-DD')
  .refine((v) => {
    // Reject rolled-over dates like 2026-02-30, which Date.parse accepts.
    const [y, m, d] = v.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'invalid date');

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'timestamps must be ISO 8601')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid timestamp');

const confidence = z.number().min(0).max(1);

export const extractedFieldSchema = z
  .object({
    /** snake_case identifier, e.g. "policy_number", "annual_premium". */
    key: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/, 'keys are snake_case'),
    /** Human label, e.g. "Policy number". */
    label: z.string().min(1).max(80),
    kind: z.enum(['text', 'date', 'amount']),
    value_text: z.string().max(500).nullable(),
    value_date: isoDate.nullable(),
    value_number: z.number().finite().nullable(),
    /** ISO 4217 code when kind is amount, e.g. "GBP". */
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    confidence,
    /** 1-based page where the value was found. */
    page_number: z.number().int().min(1).max(100).nullable(),
    /** Short quotation from the document supporting the value. */
    evidence_text: z.string().max(300).nullable(),
  })
  .strict()
  .refine(
    (f) =>
      (f.kind === 'date' && f.value_date !== null) ||
      (f.kind === 'amount' && f.value_number !== null) ||
      (f.kind === 'text' && f.value_text !== null),
    { message: 'field value must match its kind and not be null' },
  );

export const analysedPageSchema = z
  .object({
    page_number: z.number().int().min(1).max(100),
    /** Full readable text of the page (may be empty if unreadable). */
    text: z.string().max(20000),
    is_unreadable: z.boolean(),
  })
  .strict();

export const documentAnalysisSchema = z
  .object({
    title: z.string().min(1).max(120).nullable(),
    provider: z.string().min(1).max(80).nullable(),
    category: z.enum(CATEGORY_SLUGS as [string, ...string[]]).nullable(),
    doc_type: z.string().min(1).max(80).nullable(),
    document_date: isoDate.nullable(),
    received_date: isoDate.nullable(),
    /** Names of people the document is addressed to / concerns. */
    people: z.array(z.string().min(1).max(80)).max(6),
    address: z.string().max(200).nullable(),
    summary: z.string().min(1).max(600).nullable(),
    action_required: z.string().max(300).nullable(),
    deadline_date: isoDate.nullable(),
    renewal_date: isoDate.nullable(),
    expiry_date: isoDate.nullable(),
    appointment_at: isoDateTime.nullable(),
    contact_phone: z.string().max(30).nullable(),
    contact_email: z.string().max(120).nullable(),
    keywords: z.array(z.string().min(1).max(40)).max(10),
    is_important: z.boolean(),
    /** Free-text hint that this replaces an earlier document, else null. */
    supersedes_hint: z.string().max(200).nullable(),
    overall_confidence: confidence,
    fields: z.array(extractedFieldSchema).max(40),
    pages: z.array(analysedPageSchema).min(1).max(100),
  })
  .strict();

export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type AnalysedPage = z.infer<typeof analysedPageSchema>;
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

/** Parse unknown AI output; returns a typed result or a readable error list. */
export function validateAnalysis(raw: unknown):
  | { ok: true; analysis: DocumentAnalysis }
  | { ok: false; errors: string[] } {
  const parsed = documentAnalysisSchema.safeParse(raw);
  if (parsed.success) return { ok: true, analysis: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
