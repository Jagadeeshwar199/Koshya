# Bug History — Koshya

## Template
| Date | Issue | Root cause | Fix | Tests |
|------|-------|------------|-----|-------|
| YYYY-MM-DD | … | … | … | `tests/…` |

---

## Fixed (major)

| Date | Issue | Root cause | Fix | Tests |
|------|-------|------------|-----|-------|
| 2026-06 | `remind me` treated as reschedule | Intent misclassification | `REMINDER_CREATE` for remind-me pattern | `intent.test.js` |
| 2026-06 | Reminder fired at wrong wall time (e.g. 9 AM) | Cron `0 9,21` + sparse poll | Minutely cron `* * * * *` | `reminder-schedule.test.js` |
| 2026-06 | Offset reminders ignored | Time-only default path | Offset from now in create follow-up | `reminder-schedule.test.js` |
| 2026-06 | Title showed "Remind" | Bad title extraction | Strip leading remind phrase | `reminder-title.test.js` |
| 2026-06 | Subscription follow-up lost | Router sent `UNKNOWN` to generic handler; parser merged poorly | `getPending` route + parser merge (`Prime 199`, day/month) | `subscription-pending.test.js` |
| 2026-06 | `renewls` / date as amount | Missing typo + amount filter | `applyTypoFixes`, exclude renewal day from amount | `subscription-display.test.js` |
| 2026-06 | Duplicate subscription 409 | Insert-only | Upsert in subscription service | — |
| 2026-06 | Webhook rejected valid Gupshup payload | Strict signature only | Parse alternate payload shapes; allow inbound when message present | `webhook-auth.test.js` |
