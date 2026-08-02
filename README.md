# Paperkeep

A private, secure "household paperwork memory" for UK households.

Photograph a letter or import a PDF. Paperkeep keeps the original safe, reads
it, works out what it is, extracts the details that matter (policy numbers,
renewal dates, amounts, deadlines), and lets you ask for them later in plain
English — with every answer linked back to the original page.

> The product name is a working title. It is centralised in
> [`src/config/brand.ts`](src/config/brand.ts) and can be changed in one place.

## What it does

- **Capture** — photograph multi-page letters, pick photos, or import PDFs.
- **Preserve** — originals are stored in a private Supabase Storage bucket,
  scoped per household, accessed only through short-lived signed URLs.
- **Understand** — a server-side pipeline sends the document to Claude for
  classification and strict, schema-validated structured extraction
  (provider, category, reference numbers, dates, amounts, actions).
- **Review** — every extraction is presented for review and correction before
  it is trusted; each field records whether it was AI-extracted, corrected,
  or manually entered.
- **Find** — full-text and structured search across titles, providers,
  reference numbers and the extracted text itself.
- **Ask** — "What is my Aviva pension number?" gets an evidence-grounded
  answer with a citation and a control to open the source page. Missing
  evidence produces "not found", never a guess.
- **Act** — extracted deadlines, renewals and expiries surface as reminders
  with local notifications, always under user control.

## Stack

| Layer | Choice |
|---|---|
| App | Expo SDK 57 · React Native · TypeScript (strict) · Expo Router |
| Backend | Supabase (Auth, Postgres, private Storage, Edge Functions) |
| AI | Claude API behind a small provider interface (server-side only) |
| Search | Postgres full-text search (pgvector deferred until justified) |
| Validation | Zod on both client and Edge Functions |

## Repository layout

```
app/                  Expo Router routes (screens)
src/config/           Brand, env validation, categories
src/theme/            Design tokens and system components
src/components/       Reusable UI
src/features/         auth, documents, capture, analysis, assistant, reminders…
src/utils/            Pure helpers (dates, amounts, references, checksums)
supabase/migrations/  SQL migrations incl. RLS and storage policies
supabase/functions/   Edge Functions (process-document, ask-assistant, delete-account)
supabase/seed/        Synthetic, clearly-fictional demo data
docs/                 Product spec, architecture, security, setup, test plan
scripts/              RLS isolation test runner and helpers
```

## Getting started

See [docs/setup.md](docs/setup.md) for the full guide. Short version:

```bash
npm install
cp .env.example .env        # fill in your Supabase project values
npx supabase start          # local stack (Docker required)
npx supabase db reset       # applies migrations + seed
npm run start               # Expo dev server; open in Expo Go on iPhone
```

Run checks:

```bash
npm run typecheck
npm run lint
npm test
```

## Documentation

- [Product spec](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Security & privacy](docs/security.md)
- [Setup guide](docs/setup.md)
- [Test plan](docs/test-plan.md)
- [Implementation plan & status](docs/implementation-plan.md)

## Honest limitations

- AI extraction is imperfect; the review step exists because fields can be
  wrong. Critical details should be verified against the original document,
  which is always one tap away.
- Files are protected by Supabase's at-rest encryption, storage policies and
  RLS — not end-to-end encryption. See [docs/security.md](docs/security.md)
  for exactly what is and is not guaranteed.
- The MVP is single-household, single-user (the schema supports adding a
  second member later).
- No bank, pension-provider or email integrations, by design.
