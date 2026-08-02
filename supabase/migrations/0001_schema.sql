-- Paperkeep 0001: core schema
-- Every user-owned table carries household_id for scoping; RLS in 0002.

create extension if not exists pgcrypto;

-- ── Enums ──────────────────────────────────────────────────────────────
create type public.document_status as enum
  ('uploading', 'uploaded', 'queued', 'processing', 'needs_review', 'ready', 'failed');

create type public.field_source as enum ('ai', 'user_corrected', 'manual');

create type public.file_kind as enum ('original', 'page_image', 'preview');

create type public.person_kind as enum ('me', 'partner', 'child', 'household', 'business', 'custom');

create type public.reminder_status as enum ('pending', 'completed', 'dismissed');

create type public.reminder_source as enum ('ai_suggested', 'user');

create type public.job_status as enum ('queued', 'processing', 'succeeded', 'failed');

create type public.message_role as enum ('user', 'assistant');

-- ── updated_at trigger helper ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Identity & household ──────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My household',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);
create index household_members_household_idx on public.household_members (household_id);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind public.person_kind not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index people_household_idx on public.people (household_id);
create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();

-- ── Documents ─────────────────────────────────────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled document',
  category text not null default 'other',
  provider text,
  doc_type text,
  document_date date,
  received_date date,
  person_id uuid references public.people (id) on delete set null,
  status public.document_status not null default 'uploading',
  summary text,
  summary_source public.field_source,
  action_required text,
  deadline_date date,
  renewal_date date,
  expiry_date date,
  appointment_at timestamptz,
  is_sensitive boolean not null default false,
  is_important boolean not null default false,
  supersedes_hint text,
  checksum text,
  original_filename text,
  page_count integer not null default 0,
  analysis jsonb,
  analysis_model text,
  analysed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_household_idx on public.documents (household_id, created_at desc);
create index documents_household_status_idx on public.documents (household_id, status);
create index documents_household_category_idx on public.documents (household_id, category);
create index documents_household_checksum_idx on public.documents (household_id, checksum);
create index documents_deadline_idx on public.documents (household_id, deadline_date);
create index documents_expiry_idx on public.documents (household_id, expiry_date);
create index documents_renewal_idx on public.documents (household_id, renewal_date);
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.file_kind not null,
  storage_path text not null unique,
  page_number integer,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  checksum text,
  original_filename text,
  created_at timestamptz not null default now()
);
create index document_files_document_idx on public.document_files (document_id);
create index document_files_household_idx on public.document_files (household_id);

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  text text not null default '',
  is_unreadable boolean not null default false,
  created_at timestamptz not null default now(),
  unique (document_id, page_number)
);
create index document_pages_document_idx on public.document_pages (document_id);
create index document_pages_household_idx on public.document_pages (household_id);

create table public.document_fields (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  key text not null,
  label text not null,
  value_text text,
  value_date date,
  value_number numeric,
  currency text,
  confidence real check (confidence >= 0 and confidence <= 1),
  source public.field_source not null default 'ai',
  page_number integer,
  evidence_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, key)
);
create index document_fields_document_idx on public.document_fields (document_id);
create index document_fields_household_key_idx on public.document_fields (household_id, key);
create trigger document_fields_updated_at before update on public.document_fields
  for each row execute function public.set_updated_at();

-- ── Tags ──────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);
create index tags_household_idx on public.tags (household_id);

create table public.document_tags (
  document_id uuid not null references public.documents (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id)
);
create index document_tags_household_idx on public.document_tags (household_id);
create index document_tags_tag_idx on public.document_tags (tag_id);

-- ── Reminders ─────────────────────────────────────────────────────────
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  title text not null,
  due_date date not null,
  lead_days integer[] not null default '{30,14,7,1}',
  status public.reminder_status not null default 'pending',
  source public.reminder_source not null default 'user',
  notes text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_household_due_idx on public.reminders (household_id, due_date);
create index reminders_document_idx on public.reminders (document_id);
create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

-- ── Processing jobs (idempotency, retries, cost logging) ──────────────
create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  status public.job_status not null default 'queued',
  attempt integer not null default 1,
  error text,
  model text,
  input_tokens integer,
  output_tokens integer,
  pages_processed integer,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index processing_jobs_document_idx on public.processing_jobs (document_id, created_at desc);
create index processing_jobs_household_idx on public.processing_jobs (household_id);
create trigger processing_jobs_updated_at before update on public.processing_jobs
  for each row execute function public.set_updated_at();

-- ── Assistant ─────────────────────────────────────────────────────────
create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_conversations_household_idx on public.assistant_conversations (household_id, updated_at desc);
create trigger assistant_conversations_updated_at before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  role public.message_role not null,
  content text not null,
  citations jsonb not null default '[]',
  not_found boolean not null default false,
  created_at timestamptz not null default now()
);
create index assistant_messages_conversation_idx on public.assistant_messages (conversation_id, created_at);
create index assistant_messages_household_idx on public.assistant_messages (household_id);

-- ── Audit & rate limiting ─────────────────────────────────────────────
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  entity text,
  entity_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_events_household_idx on public.audit_events (household_id, created_at desc);

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  unique (user_id, action, window_start)
);

-- ── Signup provisioning ───────────────────────────────────────────────
-- Creates profile, household, membership and a default "Me" person for
-- every new auth user. SECURITY DEFINER so it does not depend on policies.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''));

  insert into public.households (name, created_by)
  values ('My household', new.id)
  returning id into new_household;

  insert into public.household_members (household_id, user_id, role)
  values (new_household, new.id, 'owner');

  insert into public.people (household_id, name, kind)
  values (new_household, 'Me', 'me');

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
