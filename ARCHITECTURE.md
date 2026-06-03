# Architecture — Koshya

## Components
| Layer | Files |
|-------|--------|
| Entry | `server.js` |
| Webhook | `webhookRoutes` → `webhookController` |
| Router | `messageRouterService` |
| Intents | `intentService` → `src/intent/*` (semantic + fuzzy + entities + confidence) |
| Parse | `parserCore`, `parserService` |
| Subscriptions | `subscriptionFlowService`, `subscriptionService`, `pendingSubscriptionService` |
| Reminders | `reminderController`, `reminderService`, `reminderJobService`, `reminderWorker` |
| WhatsApp | `whatsappService`, `webhookMessage` |
| Format | `subscriptionFormatter`, `reminderFormatter`, `uxMessages` |
| API | `subscriptionRoutes`, `reminderRoutes`, `parseRoutes` |

## Intent detection (`src/intent/`)
- `semanticDictionaries.js` — reminder/subscription/expiry/payment/action/query/delete/update term groups
- `fuzzyMatcher.js` — Levenshtein similarity, `groupScore` (env `INTENT_FUZZY_THRESHOLD`, default 0.34)
- `entityExtractor.js` — service, date/time, amount, recurrence, actionText
- `serviceCatalog.js` — seed + dynamic `registerService`
- `intentDetector.js` — multi-signal scoring, `pickBestIntent` (env `INTENT_MIN_CONFIDENCE`, default 0.45)
- `SUBSCRIPTION_EXPIRY` maps to `SUBSCRIPTION_QUERY` + `queryType: 'expiry'` for backward-compatible routing

## Router order (`messageRouterService`)
1. `conversation_state` (delete confirm, reminder time follow-ups)
2. `detectIntent` → intent handlers
3. `pending_drafts` → subscription flow (even if `UNKNOWN`)
4. `handleUnknownIntent`

## Request flow
```
Gupshup webhook → webhookAuth → webhookController
  → idempotency (webhookIdempotencyService)
  → routeWhatsAppMessage(sender, text)
  → intent-specific handler → sendWhatsAppMessage
```

## Reminder flow
1. `detectIntent` → `REMINDER_CREATE` | `UPDATE` | `CANCEL` | `QUERY`
2. `reminderController` builds/schedules via `reminderService`
3. Missing time → `setState` (`awaiting_reminder_*`) → follow-up message completes
4. `reminderWorker` (cron) → `reminderJobService` → sends due reminders

## Subscription flow
1. `SUBSCRIPTION_CREATE` or pending draft → `handleSubscriptionMessage`
2. `parseMessage(text, pending)` → complete | incomplete
3. Incomplete → `savePending` / `askForMissing`
4. Complete → `subscriptionService` → Supabase `subscriptions`
5. Follow-up with `getPending` routes even if intent `UNKNOWN`

## Draft / session flow
| Use case | Storage | Key |
|----------|---------|-----|
| Subscription fields | `pending_drafts` | draft JSON |
| Reminder time follow-up | `conversation_state` | `action`, `draftMessage` |
| Delete confirm | `conversation_state` | `confirm_delete` |

## Data (Supabase)
- `subscriptions` — user renewals
- `reminders` — scheduled reminders
- `pending_drafts` — subscription multi-turn
- `conversation_state` — reminder/delete flows
- `messages` — inbound log / first-message welcome
- (idempotency table via `webhookIdempotencyService`)

## Deploy
- CI: `.github/workflows/ci.yml`
- Prod: `.github/workflows/deploy-railway.yml` on `main`
