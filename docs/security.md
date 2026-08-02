# Paperkeep — Security & Privacy

This app stores highly sensitive personal documents. This document states
what is protected, how, and — just as importantly — what is *not* guaranteed.

## Threat model (MVP)

Protecting against: other users of the service (cross-tenant access), stolen
or replayed client credentials being used to reach other households, leaked
URLs to documents, malicious content embedded in uploaded documents (prompt
injection), accidental exposure via logs, runaway AI cost abuse.

Not protecting against (out of scope, stated honestly): a compromise of the
Supabase project itself or its service-role key, a malicious platform
operator, device-level compromise of the user's phone, or a subpoena of the
hosting provider. There is **no end-to-end encryption** in the MVP.

## Controls

### Authentication & session
- Supabase email OTP; no passwords stored by the app.
- Session tokens persisted via AsyncStorage through supabase-js with
  auto-refresh; sign-out revokes the session.
- Every Edge Function verifies the JWT with `auth.getUser()` before doing
  anything; no endpoint trusts a client-supplied user or household id.

### Authorisation (RLS + storage policies)
- RLS enabled on every user-owned table; policies use
  `is_household_member(household_id)` derived from `auth.uid()`.
- Separate policies for SELECT / INSERT / UPDATE / DELETE; INSERT policies
  re-check membership on the *new* row, so a forged `household_id` fails.
- Storage: private bucket only; policies parse the household id from the
  object path and require membership for read/write/delete.
- Signed URLs are short-lived (300 s) and minted with the user's JWT, so
  storage policies apply to their creation.
- Service role is used only inside Edge Functions, after JWT + membership
  verification, and never leaves the server.
- `scripts/rls-test.ts` proves: A cannot read/update/delete B's rows; A
  cannot get a signed URL for B's file; forged household ids fail.

### Input validation
- Client and server validate MIME type (JPEG/PNG/WebP/HEIC/PDF) and size
  (default 20 MB/file, 20 pages/document).
- Storage paths are constructed server-side/client-side from UUIDs only —
  no user-supplied filename ever becomes a path segment (path-traversal
  defence). Original filenames are stored as metadata columns.
- All Edge Function bodies are Zod-validated; unknown fields rejected.
- IDs are UUIDs; direct-object-reference attempts die at RLS.

### Prompt-injection defence
- Extraction and assistant prompts state that document content is untrusted
  data and must never be followed as instructions.
- Document text is delimited inside clearly-marked data blocks; system
  instructions never include interpolated document text.
- AI output is schema-validated; only whitelisted fields reach the database;
  answers must cite retrieved evidence, and citations are checked against
  the retrieval set server-side before being returned.
- The assistant retrieves with the caller's RLS-scoped client, so even a
  successful injection cannot widen data access.

### Secrets & environment
- Claude API key and service-role key exist only as Edge Function secrets.
- The client bundle contains only `EXPO_PUBLIC_SUPABASE_URL` and the anon
  key (designed to be public; RLS is the boundary).
- `src/config/env.ts` and each function validate env vars at startup.
- `.env` is gitignored; `.env.example` contains placeholders only.

### Abuse & cost control
- Table-based rate limiting on `process-document` and `ask-assistant`
  (per-user, per-hour caps).
- Page caps, file-size caps, image compression, no automatic re-analysis,
  idempotent processing jobs, checksum duplicate detection.
- Token usage logged per job (counts only — never prompt contents).

### Error handling & logging
- Errors returned to the client are generic; details stay server-side.
- No document text, extracted values, or personal data in logs or any
  analytics (there are no third-party analytics in the MVP).
- `audit_events` records security-relevant actions without sensitive
  payloads.

### Deletion
- Deleting a document removes: storage objects (original, pages, preview),
  pages/text, fields, tags links, reminders, jobs, and the row (FK CASCADE),
  plus an audit event.
- Account deletion (`delete-account` function) removes all household data,
  all storage objects, then the auth user. Confirmation is explicit and the
  UI explains exactly what is deleted. Deletion is immediate at the
  application layer; the platform's backups age out per Supabase's schedule
  — stated in the privacy screen.

### Encryption — honest statement
Data is encrypted in transit (TLS) and at rest by Supabase's infrastructure
(disk-level). The application does **not** add its own encryption layer, and
anyone with the service-role key or database access could read documents.
Custom crypto was deliberately not built for the MVP; if end-to-end
encryption becomes a requirement it needs a reviewed design (key management,
recovery, search trade-offs) — see next-steps.

### Dependencies & platform
- `npm audit` in CI checklist; dependency count kept deliberately small.
- CSP applied on web builds via app config where applicable; the primary
  target is native iOS where CSP does not apply.

## Manual security test checklist

See docs/test-plan.md §Security for the runnable checklist (cross-account
probes, forged household id, signed-URL expiry, injection payload document,
oversized/malformed uploads, rate-limit verification, log inspection).

## Privacy screen (in-app) covers
What is stored and where (Supabase, region chosen at project creation);
documents are sent to Anthropic's API for analysis; AI extraction may be
imperfect and critical details should be verified against the original; how
to delete a document or the whole account; no analytics or third-party
tracking.
