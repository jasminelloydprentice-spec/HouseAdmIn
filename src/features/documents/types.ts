import { CategorySlug } from '../../config/categories';

export type DocumentStatus =
  | 'uploading'
  | 'uploaded'
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'ready'
  | 'failed';

export type FieldSource = 'ai' | 'user_corrected' | 'manual';
export type FileKind = 'original' | 'page_image' | 'preview';
export type PersonKind = 'me' | 'partner' | 'child' | 'household' | 'business' | 'custom';

export interface DocumentRow {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  category: CategorySlug | string;
  provider: string | null;
  doc_type: string | null;
  document_date: string | null;
  received_date: string | null;
  person_id: string | null;
  status: DocumentStatus;
  summary: string | null;
  summary_source: FieldSource | null;
  action_required: string | null;
  deadline_date: string | null;
  renewal_date: string | null;
  expiry_date: string | null;
  appointment_at: string | null;
  is_sensitive: boolean;
  is_important: boolean;
  supersedes_hint: string | null;
  checksum: string | null;
  original_filename: string | null;
  page_count: number;
  analysis_model: string | null;
  analysed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFileRow {
  id: string;
  document_id: string;
  household_id: string;
  kind: FileKind;
  storage_path: string;
  page_number: number | null;
  mime_type: string;
  size_bytes: number;
  checksum: string | null;
  original_filename: string | null;
  created_at: string;
}

export interface DocumentFieldRow {
  id: string;
  document_id: string;
  household_id: string;
  key: string;
  label: string;
  value_text: string | null;
  value_date: string | null;
  value_number: number | null;
  currency: string | null;
  confidence: number | null;
  source: FieldSource;
  page_number: number | null;
  evidence_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentPageRow {
  id: string;
  document_id: string;
  household_id: string;
  page_number: number;
  text: string;
  is_unreadable: boolean;
  created_at: string;
}

export interface PersonRow {
  id: string;
  household_id: string;
  name: string;
  kind: PersonKind;
  created_at: string;
  updated_at: string;
}

export interface TagRow {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
}

export interface ProcessingJobRow {
  id: string;
  document_id: string;
  household_id: string;
  status: 'queued' | 'processing' | 'succeeded' | 'failed';
  attempt: number;
  error: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  pages_processed: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderRow {
  id: string;
  household_id: string;
  document_id: string | null;
  title: string;
  due_date: string;
  lead_days: number[];
  status: 'pending' | 'completed' | 'dismissed';
  source: 'ai_suggested' | 'user';
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** A document with joined relations used by detail/review screens. */
export interface DocumentDetail extends DocumentRow {
  document_files: DocumentFileRow[];
  document_fields: DocumentFieldRow[];
  document_pages: DocumentPageRow[];
  document_tags: { tag_id: string; tags: TagRow | null }[];
  people: PersonRow | null;
  processing_jobs: ProcessingJobRow[];
  reminders: ReminderRow[];
}
