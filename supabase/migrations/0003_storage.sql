-- Paperkeep 0003: private storage bucket + policies.
-- Object paths are always {household_id}/{document_id}/... — the first
-- path segment is the household and policies verify membership against it.
-- The bucket is PRIVATE; all reads happen through short-lived signed URLs
-- whose creation is itself governed by these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB per object
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: household id parsed from the object path (first folder).
create or replace function public.storage_object_household(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif((string_to_array(object_name, '/'))[1], '')::uuid;
$$;

create policy "documents bucket: members read"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.is_household_member(public.storage_object_household(name))
  );

create policy "documents bucket: members insert"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.is_household_member(public.storage_object_household(name))
  );

create policy "documents bucket: members update"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and public.is_household_member(public.storage_object_household(name))
  )
  with check (
    bucket_id = 'documents'
    and public.is_household_member(public.storage_object_household(name))
  );

create policy "documents bucket: members delete"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and public.is_household_member(public.storage_object_household(name))
  );
