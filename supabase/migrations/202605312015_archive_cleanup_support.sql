alter table public.subscriptions
  add column if not exists archived_at timestamp without time zone;

alter table public.reminders
  add column if not exists archived_at timestamp without time zone;

alter table public.reminders
  drop constraint if exists reminders_status_check;

alter table public.reminders
  add constraint reminders_status_check
  check (
    status = any (
      array[
        'pending'::text,
        'processing'::text,
        'sent'::text,
        'failed'::text,
        'archived'::text
      ]
    )
  );

create index if not exists idx_subscriptions_archived_at
  on public.subscriptions (archived_at);

create index if not exists idx_reminders_archived_at
  on public.reminders (archived_at);
