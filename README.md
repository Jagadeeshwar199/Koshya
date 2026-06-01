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

See [`docs/mvp-flow.md`](docs/mvp-flow.md) for detailed flow documentation.

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
