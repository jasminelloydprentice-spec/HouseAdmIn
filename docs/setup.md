# Paperkeep — Setup Guide

## Prerequisites

- Node 20+ and npm
- Docker (for local Supabase) **or** a hosted Supabase project
- Supabase CLI (`npm i -g supabase` or `npx supabase`)
- An iPhone with Expo Go, or an iOS development build
- An Anthropic API key (only needed for real AI analysis — the mock
  provider works without one)

## 1. Install

```bash
git clone <repo>
cd HouseAdmIn
npm install
cp .env.example .env
```

## 2. Supabase (local)

```bash
npx supabase start          # boots Postgres, Auth, Storage, Edge runtime
npx supabase db reset       # applies supabase/migrations + supabase/seed/seed.sql
```

`supabase start` prints the API URL and anon key — put them in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

> On a real iPhone, replace `127.0.0.1` with your machine's LAN IP so the
> phone can reach the local stack.

### Hosted Supabase instead

Create a project at supabase.com, then:

```bash
npx supabase link --project-ref <ref>
npx supabase db push        # applies migrations
```

Use the project URL/anon key in `.env`.

**Required: make the sign-in email send a code, not a link.** The app uses
6-digit OTP codes, but Supabase's default Magic Link template sends a
clickable link with no code in it — sign-in will be impossible until you
change this. In the dashboard go to **Authentication → Emails → Magic
Link** and make sure the body includes `{{ .Token }}`, e.g.:

```html
<h2>Your sign-in code</h2>
<p>Enter this code in the app:</p>
<p style="font-size:28px;letter-spacing:4px;"><strong>{{ .Token }}</strong></p>
<p>This code expires in 10 minutes.</p>
```

> Supabase's built-in email sender is rate-limited to a couple of messages
> per hour on the free tier, and may only deliver to your own account's
> address. Configure a real SMTP provider (Auth → SMTP Settings) before
> anyone else uses the app.

## 3. Edge Function secrets

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase secrets set MOCK_ANALYSIS=false        # true = no AI calls
npx supabase secrets set ANALYSIS_MODEL=claude-sonnet-5
npx supabase functions deploy process-document ask-assistant delete-account
```

For local development the functions read `supabase/functions/.env` (see
`.env.example` keys prefixed FUNCTIONS_) via
`npx supabase functions serve --env-file supabase/functions/.env`.

**Development without an API key:** set `MOCK_ANALYSIS=true` — the pipeline
returns realistic canned results for the seeded fictional documents and any
upload, so the full loop is demonstrable offline.

## 4. Run the app

```bash
npm run start        # Expo dev server; scan the QR with Expo Go on iPhone
```

Useful:

```bash
npm run typecheck
npm run lint
npm test
npm run test:rls     # needs local Supabase running; see scripts/rls-test.ts
```

## 5. Seed / demo data

`npx supabase db reset` loads clearly-fictional demo documents (Aviva-style
pension statement, home-insurance renewal, council-tax letter, boiler
warranty, NHS appointment letter) owned by a demo user
`demo@paperkeep.test` (OTP login works for any address when using local
Supabase's inbucket mail viewer at http://127.0.0.1:54324).

## Troubleshooting

- **Phone can't reach Supabase** — use LAN IP, same Wi-Fi, or `npx supabase
  status` to confirm ports.
- **OTP email not arriving locally** — open inbucket (port 54324); codes are
  captured there, nothing is actually sent.
- **Processing stuck in `queued`** — Edge Functions not served/deployed;
  check `npx supabase functions serve` output.
- **`failed` documents** — open the document → processing history shows the
  stored error; retry from the same screen.

## Deployment (personal use)

1. Hosted Supabase project (free tier is fine to start).
2. `npx supabase db push` + `functions deploy` + `secrets set`.
3. Build the app with EAS: `npx eas build --platform ios --profile
   development` and install via TestFlight/dev build, or keep using Expo Go.
4. Set `.env` to the hosted values before building.
