# Paperkeep — Product Specification (MVP)

*Working name "Paperkeep"; all branding centralised in `src/config/brand.ts`.*

## Problem

UK households receive important paperwork on paper and as PDFs — pensions,
insurance, HMRC, NHS, council, warranties. People lose track of policy
numbers, renewal dates and required actions. Existing tools are either dumb
file drives or heavyweight document-management systems.

## Product idea

A private "household paperwork memory". The user photographs a letter or
imports a PDF; the app preserves the original, extracts and structures the
important details, and answers plain-English questions later — with every
answer linked to the exact page of the original document.

**Core loop:** capture/upload → analyse → review extracted details → save →
search or ask → open supporting document.

## Target user

A normal UK household member who wants a calm, trustworthy, simple mobile
experience; not a power user. May later share selected records with a
partner (schema supports it; MVP is single-user).

## MVP features

### A. Authentication
Email OTP (one-time code) via Supabase Auth; persistent session; sign out;
account settings; full account-deletion flow with confirmation; clear
loading/error states. One household + one user initially; `households` /
`household_members` tables allow a second member later.

### B. Capture & import
Photograph one or more pages (with framing guidance, review, retake,
rotate, reorder, delete); pick existing images; import PDFs; basic
client-side compression; upload progress; retry after interruption; blurry-
image warning (heuristic, non-blocking); save without AI analysis if
analysis fails.

### C. Secure storage
Private bucket only; paths scoped `household_id/document_id/...`; short-lived
signed URLs for viewing; storage policies preventing cross-household access;
original always preserved; MIME/size/checksum/timestamp recorded; SHA-256
duplicate detection; ownership always verified server-side from the JWT.

### D. Processing pipeline
Statuses: `uploading → uploaded → queued → processing → needs_review/ready`,
`failed` with retry. Pipeline validates the file, extracts text and structure
via the AI provider, validates output against a strict Zod schema, stores raw
text + typed fields + page-level evidence, marks low confidence, fails
safely. No indefinite spinners: status is visible and the user can leave.

### E. Structured extraction
Fields: title, provider, category, document type, document date, received
date, people, address, reference/account/policy/pension/claim/NHS numbers,
amounts with meaning, renewal/expiry/deadline/appointment dates, action
required, contact phone/email, summary, tags, importance, supersedes-hint,
per-field confidence, supporting page + quotation. UK date display; ISO
storage. **Null for absent data — never guessed.**

### F. Review before save
Preview + editable title, category, provider, type, key fields, tags,
deadline/reminder confirmation, person assignment, sensitive flag. Save
allowed even when extraction is incomplete. Provenance recorded per field:
`ai` / `user_corrected` / `manual`; AI summary visually distinct from
extracted facts and user-confirmed data.

### G. Categories
Pensions, Insurance, Home and property, Mortgage, Tax and HMRC, Banking,
Utilities, Medical and NHS, Childcare and school, Work and employment,
Business, Vehicle, Warranties and purchases, Legal, Identity and
certificates, Other. Free-form tags; no folder hierarchy.

### H. Library
List with title/provider/category/date/person/status/action & expiry badges/
thumbnail; recents; filters (category, provider, person, action-needed,
expiring-soon); sort; keyword search; empty states; pull-to-refresh.

### I. Document detail
Preview, structured facts with confidence indicators and provenance,
summary, dates, action, reminders, extracted text, processing history, edit,
delete, download; tap a fact → jump to its supporting page/quote.

### J. Search
Layered: exact identifiers first, then structured fields, then Postgres
full-text over titles/providers/tags/extracted text. Semantic (pgvector)
only when it demonstrably improves discovery — deferred from MVP.

### K. Ask-my-documents assistant
Conversational Q&A over the household's documents only. Retrieval prefers
user-confirmed structured fields and exact identifiers; answers cite source
document + page, offer "View document", state uncertainty, explain
conflicts, and say "not found" rather than invent. Document text is treated
as untrusted data (prompt-injection defence). Answer format:

> Your Aviva pension number appears to be AV12345678.
> Source: Aviva Annual Statement, dated 14 June 2026, page 1.
> [View document]

### L. Deadlines & reminders
Detected deadlines/renewals/expiries/appointments/payments shown in-app
("Action needed", "Expiring soon"); user creates/edits/completes/dismisses
reminders; local notifications; AI-detected dates require confirmation
before scheduling; default offsets 30/14/7/1 days before; no automatic noise.

### M. Household people
Me / Partner / Child / Household / Business / Custom. Documents assignable
to a person; no sharing permissions in MVP.

### N. Export & deletion
Download original; export metadata (JSON); delete one document; delete
account + all data (storage, text, fields, reminders, metadata); destructive
confirmations; plain explanation of what deletion does.

## Design direction

Calm, premium, reassuring, domestic. Warm off-white background, deep
charcoal-navy text, muted blue-green accent, generous spacing, soft rounded
cards, restrained icons, strong contrast, large touch targets. No neon AI
styling, purple gradients, glassmorphism, dashboards or enterprise tables.

Accessibility: Dynamic Type support where possible, screen-reader labels,
contrast, no colour-only signalling, visible focus states, ≥44pt targets,
helpful validation messages.

Navigation: bottom tabs — Home, Documents, Scan, Ask, Settings.

Onboarding: four short value slides, then auth; camera/notification
permissions requested only at first use of the feature.

## Definition of MVP complete

1. Open dev app on iPhone. 2. Sign in. 3. Photograph multipage letter or
upload PDF. 4. See upload/processing progress. 5. Review extracted info.
6. Correct it. 7. Save. 8. Find by provider/category/words. 9. Ask "What is
my Aviva pension number?" 10. Get evidence-grounded answer. 11. Open cited
page. 12. See extracted deadline. 13. Create reminder. 14. Delete document
and data. 15. Tests prove another account cannot access it.

## Explicitly out of scope (documented, not built)

Household sharing; email forwarding address; Gmail/Outlook integration; iOS
Share Extension; Files import; recurring reminders; version linking;
superseded-policy detection; evidence packs; life-event checklists; form
filling; encrypted backup/export; App Store subscriptions; Android release;
bank/pension/email integrations.
