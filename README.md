# Koshya

WhatsApp subscription and reminder bot backed by Node.js, Express, and Supabase.

## Features

- Natural-language subscription parsing over WhatsApp
- Intent-based routing for subscriptions, reminders, queries, and updates
- Scheduled reminder delivery via in-process cron worker
- REST API (`/api/v1`) for parse, subscription, and reminder management

## Quick start

```bash
cp .env.example .env
# Fill in Supabase, Gupshup, API_KEY, and WEBHOOK_VERIFY_TOKEN values

npm install
npm test
npm start
```

Health check: `GET /health` (includes database connectivity).

## Environment variables

See [`.env.example`](.env.example) for the full list. Required for production:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access |
| `GUPSHUP_API_KEY` | WhatsApp message delivery |
| `GUPSHUP_SOURCE_PHONE` | WhatsApp business number |
| `API_KEY` | REST API authentication |
| `WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook verification |

## API authentication

Send the API key on every REST request:

```sh
curl -H "x-api-key: $API_KEY" "$BASE_URL/api/v1/subscriptions/919999999999"
```

Legacy `/api/*` routes remain available and use the same authentication.

## Database setup

Apply migrations in order from `supabase/migrations/`:

1. `202605310000_base_schema.sql` — tables, indexes, RLS
2. `202605311850_mvp_flow_readiness.sql` — recurrence constraints
3. `202605312015_archive_cleanup_support.sql` — archive support
4. `202606010805_day13_reminder_cancel_support.sql` — cancel support
5. `202606011200_production_hardening.sql` — additional indexes

## Architecture

```
WhatsApp → POST /webhook → intent router → handlers → Supabase
                              ↓
                         Gupshup reply

Cron worker → generate reminders → deliver via WhatsApp
```

**Project knowledge (AI / contributors):** [AGENTS.md](AGENTS.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_RULES.md](AI_RULES.md) · [BUG_HISTORY.md](BUG_HISTORY.md) · [TESTING_RULES.md](TESTING_RULES.md) · [CURSOR_WORKFLOW.md](CURSOR_WORKFLOW.md)

See [`docs/mvp-flow.md`](docs/mvp-flow.md) for MVP flow notes.

## Testing

```bash
npm test          # all suites
npm run test:parser
npm run lint
```

## Production notes

- Run a **single instance** unless reminder delivery locking is moved to an external queue.
- Set `NODE_ENV=production` and configure all required secrets.
- Optional: set `WEBHOOK_SECRET` for POST webhook HMAC validation.
- Optional: set `CORS_ORIGINS` to restrict browser access.

## Deploy on Railway

### Option A — Railway dashboard (fastest)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select **Koshya** repo → branch **main**
2. Add a **public domain** (Settings → Networking)
3. Set environment variables (see table below)
4. Point Gupshup webhook to `https://YOUR-DOMAIN.up.railway.app/webhook`

### Option B — GitHub Actions auto-deploy

1. In Railway: **Project Settings → Tokens** → create a project token
2. Copy your **Service ID** from the service settings
3. In GitHub repo **Settings → Secrets → Actions**, add:
   - `RAILWAY_TOKEN` — project token from step 1
   - `RAILWAY_SERVICE_ID` — service ID from step 2
4. Push to `main` — CI runs tests then deploys automatically

### Railway environment variables

| Variable | Required |
| --- | --- |
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | Your Supabase project URL (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → Settings → API |
| `GUPSHUP_API_KEY` | Gupshup dashboard |
| `GUPSHUP_SOURCE_PHONE` | WhatsApp business number |
| `WEBHOOK_VERIFY_TOKEN` | Any secret string (same in Gupshup) |
| `API_KEY` | Any secret string for REST API auth |

Railway sets `PORT` automatically. Do **not** scale to multiple instances.
