-- Paperkeep 0004: full-text search.
-- Layered search: exact identifier match on document_fields, then FTS over
-- titles/providers/summaries/types, field values and page text.
-- SECURITY INVOKER everywhere so RLS scopes results to the caller.

alter table public.documents
  add column tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(provider, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(doc_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C')
  ) stored;
create index documents_tsv_idx on public.documents using gin (tsv);

alter table public.document_pages
  add column tsv tsvector generated always as (
    to_tsvector('english', coalesce(text, ''))
  ) stored;
create index document_pages_tsv_idx on public.document_pages using gin (tsv);

alter table public.document_fields
  add column value_normalised text generated always as (
    upper(regexp_replace(coalesce(value_text, ''), '[\s\-–]', '', 'g'))
  ) stored;
create index document_fields_value_normalised_idx
  on public.document_fields (value_normalised)
  where value_normalised <> '';

-- Ranked document search. RLS applies (SECURITY INVOKER): callers only ever
-- see their own household's documents.
create or replace function public.search_documents(q text, max_results integer default 30)
returns table (document_id uuid, rank real)
language sql
stable
security invoker
set search_path = public
as $$
  with
  query as (
    select
      websearch_to_tsquery('english', q) as tsq,
      upper(regexp_replace(q, '[\s\-–]', '', 'g')) as qnorm
  ),
  hits as (
    -- Exact/partial identifier match (policy numbers etc.) — highest rank.
    select f.document_id, 2.0::real as r
    from public.document_fields f, query
    where char_length(query.qnorm) >= 4
      and f.value_normalised <> ''
      and f.value_normalised like '%' || query.qnorm || '%'
    union all
    -- Tag match
    select dt.document_id, 1.2::real
    from public.document_tags dt
    join public.tags t on t.id = dt.tag_id, query
    where char_length(q) >= 2 and t.name ilike '%' || q || '%'
    union all
    -- Document metadata FTS
    select d.id, (ts_rank(d.tsv, query.tsq) * 1.0)::real
    from public.documents d, query
    where query.tsq @@ d.tsv
    union all
    -- Page text FTS
    select p.document_id, (ts_rank(p.tsv, query.tsq) * 0.8)::real
    from public.document_pages p, query
    where query.tsq @@ p.tsv
    union all
    -- Field value FTS (e.g. "boiler" appearing in a field label/value)
    select f.document_id, 0.9::real
    from public.document_fields f, query
    where char_length(q) >= 2
      and (f.value_text ilike '%' || q || '%' or f.label ilike '%' || q || '%')
  )
  select h.document_id, max(h.r)::real as rank
  from hits h
  group by h.document_id
  order by rank desc
  limit max_results;
$$;

grant execute on function public.search_documents(text, integer) to authenticated;
