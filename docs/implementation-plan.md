# Paperkeep — Implementation Plan & Status

Repository started empty (fresh git repo, no commits). Everything below is
built from scratch on branch `claude/paperkeep-mvp-build-cpq8d3`.

## Phase 1 — Foundation

**Goal:** compiling Expo app with brand config, validated env, design
system, navigation shell, Supabase auth (OTP), full database migrations
with RLS and private storage policies.

Scope: `src/config`, `src/theme`, `src/components`, `app/` route skeleton,
`src/features/auth`, `supabase/migrations`, `.env.example`.

Risks: Expo SDK 57 API changes (new expo-file-system API); local Supabase
unavailable in CI container (mitigated: migrations reviewed + RLS test
script for local run).

**Status: complete.** Auth flow, guarded routing, tokens/components,
migrations 0001–0004 (schema, RLS, storage, search RPC), signup trigger.

## Phase 2 — Capture & library

**Goal:** camera/image/PDF capture with page management, compression,
checksum dedupe, resilient upload with progress, library with filters/
search/pull-to-refresh, document detail with signed-URL preview, delete and
download.

**Status: complete.** Scan tab (camera capture, picker, PDF import, page
reorder/retake/rotate, blur warning), upload pipeline with retry keeping
document id, library + filters + badges, detail screen, delete/download/
metadata export.

## Phase 3 — AI extraction

**Goal:** `process-document` Edge Function; provider interface with Claude
and mock implementations; strict Zod schema (client + Deno copies);
page-level evidence; statuses incl. needs_review/failed/retry; review-
before-save screen with provenance tracking.

**Status: complete.** One repair-retry on invalid AI JSON; raw text kept on
partial failure; review screen edits title/category/provider/fields/tags/
person/sensitive; per-field provenance stored.

## Phase 4 — Search & assistant

**Goal:** layered search (identifiers → structured → FTS RPC); Ask tab with
grounded answers, citations, view-source; prompt-injection defences;
rate limiting.

**Status: complete.** `search_documents` RPC; `ask-assistant` function
retrieving with caller-scoped client, evidence pack with untrusted-data
delimiters, JSON answer contract validated server-side, citations checked
against retrieval set. pgvector deferred (documented seam).

## Phase 5 — Actions & polish

**Goal:** reminders + local notifications with confirmation of AI dates,
Home actions/expiring sections, settings (people, privacy, developer cost
estimator, account deletion), synthetic seed data, unit + RLS tests,
accessibility pass, docs final.

**Status: complete.** 30/14/7/1-day defaults, notification scheduling
separate from extracted fields, delete-account function, fictional seed
set, jest suite green, RLS test script, typecheck/lint green.

## Verification snapshot (latest run)

- `npm run typecheck` ✅ (strict, zero errors)
- `npm run lint` ✅ (zero errors/warnings)
- `npm test` ✅ 52 tests / 7 suites passing — the suite caught and fixed
  two real bugs during development (month-name prefix guessing in
  `parseUkDateInput`; date rollover `2026-02-30` passing schema validation)
- `deno check` ✅ on all three Edge Functions
- `expo export --platform ios` ✅ full app bundles through Metro
- `npm run test:rls` — code-complete but NOT executed in the build
  container (no Docker for local Supabase). Run it against a local stack
  before trusting the policies — see docs/test-plan.md.
- On-device run — requires the user's iPhone; not verifiable here.

## Known limitations

- RLS tests need a local/hosted Supabase to execute; they are code-complete
  but were not executed in the build environment (no Docker).
- Blur detection is a lightweight heuristic (file-size/dimension based), not
  a CV model.
- HEIC images are converted to JPEG on capture; direct HEIC import relies on
  the picker's conversion.
- Web build works for the library/ask/settings flows; camera capture is
  iOS-first.
- Semantic (pgvector) retrieval deferred; FTS covers the target queries.
- Local notifications fire only while the app is installed; no server push.

## Prioritised next steps

1. Run RLS test suite against a real Supabase project; fix any policy gaps.
2. On-device pass on iPhone (camera ergonomics, Dynamic Type, VoiceOver).
3. Maestro E2E for the happy path.
4. Household sharing (schema is ready; needs invite flow + policy widening).
5. pgvector semantic retrieval behind `search_documents`.
6. iOS Share Extension + Files import.
7. Recurring reminders; superseded-document linking.
8. Evidence-pack export; encrypted backup design review.
