import { supabase } from '../../lib/supabase';
import { DocumentDetail, DocumentRow, PersonRow, ReminderRow, TagRow } from './types';

export interface LibraryFilters {
  category?: string;
  provider?: string;
  personId?: string;
  actionNeeded?: boolean;
  expiringSoon?: boolean;
  search?: string;
  sort?: 'newest' | 'oldest' | 'title';
}

const EXPIRING_WINDOW_DAYS = 60;

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchDocuments(householdId: string, filters: LibraryFilters = {}): Promise<DocumentRow[]> {
  // Keyword search goes through the layered search RPC first (RLS-scoped),
  // then hydrates the matching rows.
  if (filters.search && filters.search.trim().length >= 2) {
    const { data: hits, error: searchError } = await supabase.rpc('search_documents', {
      q: filters.search.trim(),
      max_results: 50,
    });
    if (searchError) throw searchError;
    const ids = (hits ?? []).map((h: { document_id: string }) => h.document_id);
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from('documents').select('*').in('id', ids);
    if (error) throw error;
    const rank = new Map<string, number>(ids.map((id: string, i: number) => [id, i]));
    return applyClientFilters((data ?? []) as DocumentRow[], filters).sort(
      (a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99),
    );
  }

  let query = supabase.from('documents').select('*').eq('household_id', householdId);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.provider) query = query.eq('provider', filters.provider);
  if (filters.personId) query = query.eq('person_id', filters.personId);
  if (filters.actionNeeded) query = query.not('action_required', 'is', null);
  if (filters.expiringSoon) {
    const horizon = isoDaysFromNow(EXPIRING_WINDOW_DAYS);
    const today = new Date().toISOString().slice(0, 10);
    query = query.or(
      `and(expiry_date.gte.${today},expiry_date.lte.${horizon}),and(renewal_date.gte.${today},renewal_date.lte.${horizon}),and(deadline_date.gte.${today},deadline_date.lte.${horizon})`,
    );
  }
  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'title':
      query = query.order('title', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

function applyClientFilters(rows: DocumentRow[], filters: LibraryFilters): DocumentRow[] {
  let out = rows;
  if (filters.category) out = out.filter((r) => r.category === filters.category);
  if (filters.provider) out = out.filter((r) => r.provider === filters.provider);
  if (filters.personId) out = out.filter((r) => r.person_id === filters.personId);
  if (filters.actionNeeded) out = out.filter((r) => r.action_required);
  return out;
}

export async function fetchDocumentDetail(id: string): Promise<DocumentDetail> {
  const { data, error } = await supabase
    .from('documents')
    .select(
      `*,
      document_files (*),
      document_fields (*),
      document_pages (*),
      document_tags (tag_id, tags (*)),
      people (*),
      processing_jobs (*),
      reminders (*)`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  const detail = data as unknown as DocumentDetail;
  detail.document_pages.sort((a, b) => a.page_number - b.page_number);
  detail.processing_jobs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return detail;
}

export async function fetchProviders(householdId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('provider')
    .eq('household_id', householdId)
    .not('provider', 'is', null);
  if (error) throw error;
  const set = new Set<string>((data ?? []).map((r) => r.provider as string));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export async function fetchPeople(householdId: string): Promise<PersonRow[]> {
  const { data, error } = await supabase.from('people').select('*').eq('household_id', householdId).order('created_at');
  if (error) throw error;
  return (data ?? []) as PersonRow[];
}

export async function fetchChecksums(householdId: string): Promise<Pick<DocumentRow, 'id' | 'checksum' | 'title'>[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, checksum, title')
    .eq('household_id', householdId)
    .not('checksum', 'is', null);
  if (error) throw error;
  return (data ?? []) as Pick<DocumentRow, 'id' | 'checksum' | 'title'>[];
}

export interface DocumentUpdate {
  title?: string;
  category?: string;
  provider?: string | null;
  doc_type?: string | null;
  document_date?: string | null;
  person_id?: string | null;
  status?: DocumentRow['status'];
  summary?: string | null;
  summary_source?: DocumentRow['summary_source'];
  action_required?: string | null;
  deadline_date?: string | null;
  renewal_date?: string | null;
  expiry_date?: string | null;
  is_sensitive?: boolean;
  is_important?: boolean;
}

export async function updateDocument(id: string, update: DocumentUpdate): Promise<void> {
  const { error } = await supabase.from('documents').update(update).eq('id', id);
  if (error) throw error;
}

export interface FieldUpdate {
  value_text?: string | null;
  value_date?: string | null;
  value_number?: number | null;
  source: 'user_corrected' | 'manual';
}

export async function updateField(fieldId: string, update: FieldUpdate): Promise<void> {
  const { error } = await supabase.from('document_fields').update(update).eq('id', fieldId);
  if (error) throw error;
}

export async function deleteField(fieldId: string): Promise<void> {
  const { error } = await supabase.from('document_fields').delete().eq('id', fieldId);
  if (error) throw error;
}

/** Delete storage objects first (RLS-checked), then the row (FK cascade clears the rest). */
export async function deleteDocument(doc: Pick<DocumentDetail, 'id' | 'household_id' | 'document_files'>): Promise<void> {
  const paths = doc.document_files.map((f) => f.storage_path);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('documents').remove(paths);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
  if (error) throw error;
  await supabase.from('audit_events').insert({
    household_id: doc.household_id,
    user_id: (await supabase.auth.getUser()).data.user?.id,
    event_type: 'document_deleted',
    entity: 'documents',
    entity_id: doc.id,
  });
}

/** Short-lived signed URL for viewing a stored object. Storage policies gate creation. */
export async function getSignedUrl(storagePath: string, expiresInSeconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function ensureTags(householdId: string, names: string[]): Promise<TagRow[]> {
  const clean = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0 && n.length <= 40))];
  if (clean.length === 0) return [];
  const { data, error } = await supabase
    .from('tags')
    .upsert(
      clean.map((name) => ({ household_id: householdId, name })),
      { onConflict: 'household_id,name', ignoreDuplicates: false },
    )
    .select();
  if (error) throw error;
  return (data ?? []) as TagRow[];
}

export async function setDocumentTags(documentId: string, householdId: string, tagIds: string[]): Promise<void> {
  const { error: delError } = await supabase.from('document_tags').delete().eq('document_id', documentId);
  if (delError) throw delError;
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('document_tags')
      .insert(tagIds.map((tag_id) => ({ document_id: documentId, tag_id, household_id: householdId })));
    if (error) throw error;
  }
}

export async function fetchReminders(householdId: string): Promise<ReminderRow[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('household_id', householdId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReminderRow[];
}
