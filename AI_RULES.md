# AI Rules — Koshya

## Core product
- WhatsApp bot for **subscriptions** (renewal tracking) and **reminders**.
- Natural-language in, structured actions out; confirm with clear UX copy.
- One user = one phone number (`user_phone`).

## Reminders
- `remind me …` → **create**, not reschedule (unless explicit update/cancel intent).
- Missing time → `awaiting_reminder_create_time` or `awaiting_reminder_time` in `conversation_state`.
- Offset times (`in 5 minutes`, `after 10 min`) schedule from **now**, not default 9 AM.
- Updates/reschedules/cancels match by title/service fuzzy match.
- Worker cron must run frequently enough for near-term reminders (default `* * * * *`).

## Subscriptions
- Parse via `parserCore.parseMessage` + `intentService` (`SUBSCRIPTION_CREATE`).
- Required: service name, amount (₹), recurrence, renewal date (day for monthly).
- Incomplete input → `pending_drafts` (Supabase); follow-ups merge, do not treat as `UNKNOWN`.
- `Prime 199` = service + amount when draft already has date/recurrence.
- Subscription save: upsert on conflict (409), not hard fail.
- Monthly subscriptions: store `renewal_day`; clear `renewal_month` for monthly recurrence in parser output.

## Conversation / drafts
- **Subscriptions:** `pending_drafts` table (`pendingSubscriptionService`).
- **Reminders:** `conversation_state` JSON (`conversationStateService`).
- **Deletes:** `confirm_delete` in conversation state.
- Router must check pending subscription **before** `handleUnknownIntent`.
- Multi-turn: `mergePendingDrafts` + `finalizeDraft` in flow service.

## Timezone
- Default: **Asia/Kolkata (IST)** (`REMINDER_TIMEZONE`, `reminderService` IST offset).
- Display/store reminder triggers in IST; worker uses configured timezone.

## Pitfalls (recurring)
- `detectIntent` can be `UNKNOWN` while `parseMessage` has partial fields; router must honor `conversation_state` / `pending_drafts` first.
- Day numbers vs ₹ amount: never use date/day digits as amount; use currency, `- 149`, or `N monthly` patterns only.
- Subscription follow-ups fail if `getPending` routing is skipped before `handleUnknownIntent`.

## UX
- Minimal replies: 2–4 lines; no post-action suggestion spam.
- `delete <name>` → unified resolver (reminder before subscription; clarify if ambiguous).
- Greetings: `hi`, `hello`, `start`, `help` → welcome (`HELP` intent).
- Ask only for **missing** fields; give one short example.
- Lists: paginate; `LIST_MORE` for next page.
- Typos tolerated in parser (`renewls`, `tomorw`, etc.) via `textUtils` / `parserCore`.
- `okay` / confirm acks where implemented; avoid duplicate list lines.

## Development
- **Minimal diffs**; no unrelated refactors.
- Read `AI_RULES.md`, `ARCHITECTURE.md`, `BUG_HISTORY.md` before changes.
- Every bug fix → test in `tests/`.
- **Before finish:** update knowledge docs in the **same commit** (see `CURSOR_WORKFLOW.md` final step).
- Deploy: push `main` → GitHub Action → Railway.
- Env: Supabase, Gupshup/WhatsApp, `SUPABASE_*`, webhook secrets.
