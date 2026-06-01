alter table public.reminders
  add column if not exists cancelled_at timestamp without time zone,
  add column if not exists updated_at timestamp without time zone;

alter table public.subscriptions
  add column if not exists updated_at timestamp without time zone;

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
        'archived'::text,
        'cancelled'::text
      ]
    )
  );

create index if not exists idx_reminders_cancelled_at
  on public.reminders (cancelled_at);
