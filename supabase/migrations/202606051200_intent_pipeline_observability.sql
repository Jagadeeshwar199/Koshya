create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  raw_message text not null,
  normalized_message text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_message_logs_user on public.message_logs (user_id, created_at desc);

create table if not exists public.detection_logs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message_logs (id) on delete cascade,
  detected_intent text not null,
  confidence numeric not null,
  extracted_entities jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  failure_reason text,
  processing_time_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_detection_logs_message on public.detection_logs (message_id);
create index if not exists idx_detection_logs_intent on public.detection_logs (detected_intent);

create table if not exists public.ai_detection_logs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message_logs (id) on delete cascade,
  prompt_sent text,
  ai_response text,
  ai_intent text,
  confidence numeric,
  token_usage jsonb,
  success boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_detection_message on public.ai_detection_logs (message_id);

create table if not exists public.validation_logs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message_logs (id) on delete cascade,
  intent text not null,
  validation_passed boolean not null,
  validation_error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_validation_logs_message on public.validation_logs (message_id);

create table if not exists public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.message_logs (id) on delete cascade,
  action_type text not null,
  success boolean not null default true,
  error_message text,
  execution_time_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_execution_logs_message on public.execution_logs (message_id);

create table if not exists public.system_errors (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  error_message text not null,
  stack_trace text,
  request_payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_system_errors_stage on public.system_errors (stage, created_at desc);

alter table public.message_logs enable row level security;
alter table public.detection_logs enable row level security;
alter table public.ai_detection_logs enable row level security;
alter table public.validation_logs enable row level security;
alter table public.execution_logs enable row level security;
alter table public.system_errors enable row level security;

do $$ declare t text; begin
  foreach t in array array['message_logs','detection_logs','ai_detection_logs','validation_logs','execution_logs','system_errors'] loop
    execute format('drop policy if exists deny_anon_access on public.%I', t);
    execute format('drop policy if exists deny_authenticated_access on public.%I', t);
    execute format('create policy deny_anon_access on public.%I for all to anon using (false) with check (false)', t);
    execute format('create policy deny_authenticated_access on public.%I for all to authenticated using (false) with check (false)', t);
  end loop;
end $$;
