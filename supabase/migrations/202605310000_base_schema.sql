-- Base schema for Koshya (bootstrap from migrations)

create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null,
  service_name text not null,
  amount numeric not null,
  renewal_day integer,
  renewal_month text,
  recurrence text not null,
  active boolean not null default true,
  reminder_days_before integer not null default 1,
  last_reminded_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  user_phone text not null,
  message text not null,
  status text not null default 'pending',
  trigger_at timestamptz not null,
  sent_at timestamptz,
  retry_count integer not null default 0,
  archived_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pending_drafts (
  user_phone text primary key,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  message_id text primary key,
  user_phone text,
  processed_at timestamptz not null default now()
);

create table if not exists public.conversation_state (
  user_phone text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_subscriptions_active_unique
  on public.subscriptions (user_phone, lower(service_name))
  where active = true;

alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.pending_drafts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.conversation_state enable row level security;
