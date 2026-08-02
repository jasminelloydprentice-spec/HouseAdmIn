-- Paperkeep 0002: row-level security.
-- RLS is mandatory on every user-owned table. Ownership is derived from
-- auth.uid() via household membership — never from client-supplied ids.

-- Helper: is the current user a member of this household?
-- SECURITY DEFINER so it can read household_members without recursive RLS.
create or replace function public.is_household_member(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ── profiles ──────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── households ────────────────────────────────────────────────────────
alter table public.households enable row level security;
create policy "households: members read" on public.households
  for select using (public.is_household_member(id));
create policy "households: members update" on public.households
  for update using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- ── household_members ────────────────────────────────────────────────
alter table public.household_members enable row level security;
create policy "members: read own memberships" on public.household_members
  for select using (user_id = auth.uid() or public.is_household_member(household_id));
-- No insert/update/delete policies: membership changes happen via the
-- signup trigger (SECURITY DEFINER) or trusted server code only.

-- ── people ────────────────────────────────────────────────────────────
alter table public.people enable row level security;
create policy "people: members read" on public.people
  for select using (public.is_household_member(household_id));
create policy "people: members insert" on public.people
  for insert with check (public.is_household_member(household_id));
create policy "people: members update" on public.people
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "people: members delete" on public.people
  for delete using (public.is_household_member(household_id));

-- ── documents ─────────────────────────────────────────────────────────
alter table public.documents enable row level security;
create policy "documents: members read" on public.documents
  for select using (public.is_household_member(household_id));
create policy "documents: members insert" on public.documents
  for insert with check (
    public.is_household_member(household_id) and created_by = auth.uid()
  );
create policy "documents: members update" on public.documents
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "documents: members delete" on public.documents
  for delete using (public.is_household_member(household_id));

-- ── document_files ────────────────────────────────────────────────────
alter table public.document_files enable row level security;
create policy "document_files: members read" on public.document_files
  for select using (public.is_household_member(household_id));
create policy "document_files: members insert" on public.document_files
  for insert with check (public.is_household_member(household_id));
create policy "document_files: members delete" on public.document_files
  for delete using (public.is_household_member(household_id));

-- ── document_pages ────────────────────────────────────────────────────
alter table public.document_pages enable row level security;
create policy "document_pages: members read" on public.document_pages
  for select using (public.is_household_member(household_id));
create policy "document_pages: members insert" on public.document_pages
  for insert with check (public.is_household_member(household_id));
create policy "document_pages: members delete" on public.document_pages
  for delete using (public.is_household_member(household_id));

-- ── document_fields ───────────────────────────────────────────────────
alter table public.document_fields enable row level security;
create policy "document_fields: members read" on public.document_fields
  for select using (public.is_household_member(household_id));
create policy "document_fields: members insert" on public.document_fields
  for insert with check (public.is_household_member(household_id));
create policy "document_fields: members update" on public.document_fields
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "document_fields: members delete" on public.document_fields
  for delete using (public.is_household_member(household_id));

-- ── tags & document_tags ──────────────────────────────────────────────
alter table public.tags enable row level security;
create policy "tags: members read" on public.tags
  for select using (public.is_household_member(household_id));
create policy "tags: members insert" on public.tags
  for insert with check (public.is_household_member(household_id));
create policy "tags: members delete" on public.tags
  for delete using (public.is_household_member(household_id));

alter table public.document_tags enable row level security;
create policy "document_tags: members read" on public.document_tags
  for select using (public.is_household_member(household_id));
create policy "document_tags: members insert" on public.document_tags
  for insert with check (public.is_household_member(household_id));
create policy "document_tags: members delete" on public.document_tags
  for delete using (public.is_household_member(household_id));

-- ── reminders ─────────────────────────────────────────────────────────
alter table public.reminders enable row level security;
create policy "reminders: members read" on public.reminders
  for select using (public.is_household_member(household_id));
create policy "reminders: members insert" on public.reminders
  for insert with check (
    public.is_household_member(household_id) and created_by = auth.uid()
  );
create policy "reminders: members update" on public.reminders
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "reminders: members delete" on public.reminders
  for delete using (public.is_household_member(household_id));

-- ── processing_jobs ───────────────────────────────────────────────────
-- Clients may read job history and enqueue; only server code (service
-- role, bypasses RLS) transitions processing state.
alter table public.processing_jobs enable row level security;
create policy "processing_jobs: members read" on public.processing_jobs
  for select using (public.is_household_member(household_id));
create policy "processing_jobs: members insert" on public.processing_jobs
  for insert with check (public.is_household_member(household_id));

-- ── assistant ─────────────────────────────────────────────────────────
alter table public.assistant_conversations enable row level security;
create policy "conversations: members read" on public.assistant_conversations
  for select using (public.is_household_member(household_id));
create policy "conversations: members insert" on public.assistant_conversations
  for insert with check (
    public.is_household_member(household_id) and user_id = auth.uid()
  );
create policy "conversations: members update" on public.assistant_conversations
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "conversations: members delete" on public.assistant_conversations
  for delete using (public.is_household_member(household_id));

alter table public.assistant_messages enable row level security;
create policy "messages: members read" on public.assistant_messages
  for select using (public.is_household_member(household_id));
create policy "messages: members insert" on public.assistant_messages
  for insert with check (public.is_household_member(household_id));
create policy "messages: members delete" on public.assistant_messages
  for delete using (public.is_household_member(household_id));

-- ── audit_events ──────────────────────────────────────────────────────
-- Append-only from the client's perspective; no update/delete policies.
alter table public.audit_events enable row level security;
create policy "audit: members read" on public.audit_events
  for select using (public.is_household_member(household_id));
create policy "audit: members insert" on public.audit_events
  for insert with check (
    public.is_household_member(household_id) and user_id = auth.uid()
  );

-- ── rate_limits ───────────────────────────────────────────────────────
-- Managed exclusively by Edge Functions with the service role; no client
-- policies at all (RLS enabled with no policies = deny).
alter table public.rate_limits enable row level security;
