alter table public.subscriptions
  drop constraint if exists recurrence_check,
  drop constraint if exists subscriptions_recurrence_check;

alter table public.subscriptions
  add constraint subscriptions_recurrence_check
  check (
    recurrence in ('monthly', 'yearly', 'weekly', 'custom')
    or recurrence ~ '^[1-9][0-9]* months?$'
  );

create index if not exists idx_messages_user_phone_created_at
  on public.messages (user_phone, created_at desc);

create index if not exists idx_subscriptions_user_phone_created_at
  on public.subscriptions (user_phone, created_at desc);

create index if not exists idx_subscriptions_active_renewal
  on public.subscriptions (active, recurrence, renewal_day);

create index if not exists idx_reminders_subscription_id
  on public.reminders (subscription_id);

create index if not exists idx_reminders_status_trigger_at
  on public.reminders (status, trigger_at);

create index if not exists idx_reminders_user_phone_status
  on public.reminders (user_phone, status);
