-- Paperkeep 0005: security hardening (from security review).
--
-- Closes a cross-household file-read path: child-table INSERT policies
-- previously checked only household membership, so a member of household A
-- could attach a row referencing a document (or storage object) belonging
-- to household B by stamping household_id = A. We now require, at the DB
-- layer, that:
--   (a) the referenced document actually belongs to the stamped household;
--   (b) document_files.storage_path lives under {household_id}/{document_id}/.
-- The Edge Function adds a matching runtime check, but RLS is the boundary.

-- Helper: does this document belong to this household?
-- SECURITY DEFINER so the policy can see the document row regardless of the
-- inserting user's own read policy (it still only returns a boolean).
create or replace function public.document_in_household(doc uuid, h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.documents d where d.id = doc and d.household_id = h
  );
$$;

revoke all on function public.document_in_household(uuid, uuid) from public;
grant execute on function public.document_in_household(uuid, uuid) to authenticated;

-- ── document_files: bind to document + enforce path prefix ────────────
drop policy if exists "document_files: members insert" on public.document_files;
create policy "document_files: members insert" on public.document_files
  for insert with check (
    public.is_household_member(household_id)
    and public.document_in_household(document_id, household_id)
    and storage_path like household_id::text || '/' || document_id::text || '/%'
  );

-- ── document_pages ────────────────────────────────────────────────────
drop policy if exists "document_pages: members insert" on public.document_pages;
create policy "document_pages: members insert" on public.document_pages
  for insert with check (
    public.is_household_member(household_id)
    and public.document_in_household(document_id, household_id)
  );

-- ── document_fields ───────────────────────────────────────────────────
drop policy if exists "document_fields: members insert" on public.document_fields;
create policy "document_fields: members insert" on public.document_fields
  for insert with check (
    public.is_household_member(household_id)
    and public.document_in_household(document_id, household_id)
  );

-- ── document_tags ─────────────────────────────────────────────────────
drop policy if exists "document_tags: members insert" on public.document_tags;
create policy "document_tags: members insert" on public.document_tags
  for insert with check (
    public.is_household_member(household_id)
    and public.document_in_household(document_id, household_id)
  );

-- ── processing_jobs ───────────────────────────────────────────────────
drop policy if exists "processing_jobs: members insert" on public.processing_jobs;
create policy "processing_jobs: members insert" on public.processing_jobs
  for insert with check (
    public.is_household_member(household_id)
    and public.document_in_household(document_id, household_id)
  );

-- ── assistant_conversations: UPDATE must keep user_id = auth.uid() ─────
drop policy if exists "conversations: members update" on public.assistant_conversations;
create policy "conversations: members update" on public.assistant_conversations
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id) and user_id = auth.uid());

-- ── assistant_messages: bind to a conversation in the same household ──
drop policy if exists "messages: members insert" on public.assistant_messages;
create policy "messages: members insert" on public.assistant_messages
  for insert with check (
    public.is_household_member(household_id)
    and exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.household_id = household_id
    )
  );

-- ── Atomic rate limiting ──────────────────────────────────────────────
-- Replaces the read-modify-write limiter, which under-counted concurrent
-- requests. Returns the post-increment count so the caller can compare.
create or replace function public.bump_rate_limit(p_user_id uuid, p_action text, p_window timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.rate_limits as rl (user_id, action, window_start, count)
  values (p_user_id, p_action, p_window, 1)
  on conflict (user_id, action, window_start)
  do update set count = rl.count + 1
  returning rl.count into new_count;
  return new_count;
end $$;

-- Only the service role (Edge Functions) may call it; no client access.
revoke all on function public.bump_rate_limit(uuid, text, timestamptz) from public;
revoke all on function public.bump_rate_limit(uuid, text, timestamptz) from authenticated;
grant execute on function public.bump_rate_limit(uuid, text, timestamptz) to service_role;
