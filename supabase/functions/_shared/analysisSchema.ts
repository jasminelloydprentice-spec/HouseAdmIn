// Deno copy of src/features/analysis/schema.ts — keep in sync (see CLAUDE.md).
import { z } from 'npm:zod@3.24.1';

export const CATEGORY_SLUGS = [
  'pensions',
  'insurance',
  'home_property',
  'mortgage',
  'tax_hmrc',
  'banking',
  'utilities',
  'medical_nhs',
  'childcare_school',
  'work_employment',
  'business',
  'vehicle',
  'warranties_purchases',
  'legal',
  'identity_certificates',
  'other',
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dates must be ISO YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid date');

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'timestamps must be ISO 8601')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid timestamp');

const confidence = z.number().min(0).max(1);

export const extractedFieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/, 'keys are snake_case'),
    label: z.string().min(1).max(80),
    kind: z.enum(['text', 'date', 'amount']),
    value_text: z.string().max(500).nullable(),
    value_date: isoDate.nullable(),
    value_number: z.number().finite().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    confidence,
    page_number: z.number().int().min(1).max(100).nullable(),
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
    text: z.string().max(20000),
    is_unreadable: z.boolean(),
  })
  .strict();

export const documentAnalysisSchema = z
  .object({
    title: z.string().min(1).max(120).nullable(),
    provider: z.string().min(1).max(80).nullable(),
    category: z.enum(CATEGORY_SLUGS as unknown as [string, ...string[]]).nullable(),
    doc_type: z.string().min(1).max(80).nullable(),
    document_date: isoDate.nullable(),
    received_date: isoDate.nullable(),
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
    supersedes_hint: z.string().max(200).nullable(),
    overall_confidence: confidence,
    fields: z.array(extractedFieldSchema).max(40),
    pages: z.array(analysedPageSchema).min(1).max(100),
  })
  .strict();

export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type AnalysedPage = z.infer<typeof analysedPageSchema>;
export type DocumentAnalysis = z.infer<typeof documentAnalysisSchema>;

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
