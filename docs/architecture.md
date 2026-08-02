# Paperkeep — Architecture

## Principles

1. The original file is the source of truth; extracted data is editable
   metadata.
2. Every AI answer links to evidence (document + page).
3. Private by default; least privilege everywhere.
4. Useful even when AI fails (manual save path always exists).
5. Simple and maintainable over abstract; one deliberate abstraction: the
   document-analysis provider interface (avoids AI vendor lock-in).
6. No client-side secrets; ownership derived from JWT server-side.

## System overview

```
┌─────────────── iPhone (Expo / React Native) ───────────────┐
│ Expo Router UI · React Query · supabase-js (anon key only) │
└───────┬───────────────────────────┬────────────────────────┘
        │ Auth (OTP), Postgres      │ invoke (JWT)
        │ via RLS, Storage via      ▼
        │ storage policies   ┌─────────────────────────────┐
        ▼                    │ Supabase Edge Functions     │
┌──────────────────┐         │  process-document           │
│ Supabase         │◄────────│  ask-assistant              │
│  Postgres + RLS  │ service │  delete-account             │
│  Private Storage │  role   └──────────┬──────────────────┘
│  Auth            │                    │ server-side key
└──────────────────┘                    ▼
                             ┌─────────────────────┐
                             │ Claude API          │
                             │ (vision + text)     │
                             └─────────────────────┘
```

- The client talks to Postgres/Storage directly with the **anon key + user
  JWT**, so RLS and storage policies are the enforcement layer.
- Edge Functions hold the only privileged credentials (service role, Claude
  API key). Each function re-verifies the caller's JWT and household
  membership before touching anything.

## Data model (Postgres)

Core tables (all UUID PKs, `created_at`/`updated_at`, FKs, indexes, RLS):

- `profiles` — 1:1 with `auth.users`; display name.
- `households`, `household_members` — one per user at signup (trigger);
  schema ready for a second member.
- `people` — Me/Partner/Child/Household/Business/Custom, per household.
- `documents` — title, category, provider, doc type, dates, person, status,
  summary, action, sensitivity, importance, raw `analysis` JSONB (audit copy
  of the validated AI response), `checksum` of the original.
- `document_files` — original / preview / page-image objects: storage path,
  page number, MIME, size, SHA-256.
- `document_pages` — per-page extracted text + generated `tsvector`.
- `document_fields` — typed key/value rows (text/date/number + currency),
  confidence, provenance (`ai`/`user_corrected`/`manual`), evidence page +
  quote. Frequently-queried facts live here, not in a JSON blob.
- `tags`, `document_tags`.
- `reminders` — due date, lead offsets, status, `source`
  (`ai_suggested`/`user`), link to document; notification IDs stored
  client-side keyed by reminder.
- `processing_jobs` — status, attempt, error, model, token counts (no prompt
  contents) for idempotency, retry and cost estimation.
- `assistant_conversations`, `assistant_messages` — messages store citations
  JSONB (document id, page, quote).
- `audit_events` — security-relevant actions (deletes, exports, failures).

Status enums are Postgres enums. Every user-owned table carries
`household_id`; RLS uses a `is_household_member(uuid)` helper (SECURITY
DEFINER, checks `household_members`).

## Storage layout

Bucket `documents` (private):

```
{household_id}/{document_id}/original/{file_id}.{ext}
{household_id}/{document_id}/pages/{n}.jpg
{household_id}/{document_id}/preview.jpg
```

Storage policies parse the first path segment and require household
membership; signed URLs are short-lived (default 300 s) and created with the
user's JWT so policies still apply.

## Document lifecycle

```
uploading → uploaded → queued → processing → needs_review → ready
                          ↑           ↓ (validation/AI failure)
                          └──retry── failed
```

- Client uploads files, inserts `documents` + `document_files`, sets
  `queued`, invokes `process-document`.
- `process-document` (idempotent per job): validates ownership + file
  types/sizes, marks `processing`, sends original images/PDF to the analysis
  provider (Claude vision does OCR + structuring in one pass), validates the
  JSON against the strict schema (one repair retry), writes pages/fields/
  text, sets `needs_review` (or `failed` storing the error; raw text is kept
  if available).
- Review screen promotes `needs_review → ready` on save; user may save an
  unanalysed document at any time.
- Duplicate uploads are flagged by checksum before upload; repeated analysis
  requires an explicit user action.

## AI provider interface

```ts
interface DocumentAnalysisProvider {
  analyseDocument(input: AnalyseDocumentInput): Promise<DocumentAnalysisResult>;
}
```

Implementations: `claudeProvider` (Anthropic Messages API, PDF/image content
blocks) and `mockProvider` (deterministic canned results for development —
enabled by `MOCK_ANALYSIS=true`). The extraction prompt declares document
content untrusted, demands strict JSON, forbids guessing (null for absent),
requires page evidence, confidences, and distinguishes renewal vs document
date and reference numbers vs phone numbers vs amounts. All output is
Zod-validated before any database write.

## Search

Layer 1: exact identifier match on `document_fields` (normalised). Layer 2:
structured filters (category/provider/person/status/dates). Layer 3:
Postgres FTS via `search_documents(query)` RPC over title, provider,
summary, tags, field values and page text (`websearch_to_tsquery`,
`english`). pgvector is deferred: FTS + structured fields cover the target
queries; semantic search can be added behind the same RPC seam.

## Assistant grounding

`ask-assistant`: verify JWT → rate-limit → retrieve top documents using the
same layered search **with the caller's RLS-scoped client** → build an
evidence pack of structured fields (preferring user-confirmed) and page
excerpts, each wrapped in untrusted-data delimiters → Claude answers with a
strict JSON contract (`answer`, `citations[]`, `confidence`, `not_found`) →
validate → return. The function never uses the service role for retrieval,
so household isolation is enforced twice (RLS + explicit filter).

## Client architecture

- Expo Router: `(auth)` group and guarded `(app)` group with 5 tabs.
- React Query for server state (queries keyed per household; invalidation on
  mutations). Local component state elsewhere; no global state library.
- `src/config/env.ts` validates `EXPO_PUBLIC_*` vars at startup with Zod.
- Design tokens in `src/theme`; all screens use shared components.
- Uploads: `expo-image-manipulator` compression → SHA-256 via `expo-crypto`
  → dedupe check → Supabase Storage upload with progress → row inserts →
  invoke processing. Retry keeps the same document id (idempotent paths).

## Key decisions & trade-offs

| Decision | Rationale |
|---|---|
| Claude vision for OCR + extraction in one call | Avoids separate OCR infra; letters are short; cost controlled by page caps |
| Duplicated Zod schema (client + Deno) | Metro and Deno can't share modules cleanly; sync rule documented in CLAUDE.md |
| No pgvector in MVP | Target queries resolved by FTS + fields; seam exists to add it |
| Postgres enums for statuses | Type safety at the data layer |
| Trigger-provisioned household at signup | Keeps client free of privileged setup logic |
| Local notifications only | Server push is unnecessary complexity for personal MVP |
