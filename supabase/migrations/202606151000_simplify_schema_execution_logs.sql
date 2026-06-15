-- Remove legacy expense tables (if present)
drop table if exists public.expense_participants cascade;
drop table if exists public.expenses_v2 cascade;
drop table if exists public.expenses cascade;
drop table if exists public.settlements cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;

alter table if exists public.parser_events drop constraint if exists parser_events_message_id_fkey;

-- Consolidate scattered pipeline logs into execution_logs
drop table if exists public.detection_logs cascade;
drop table if exists public.validation_logs cascade;
drop table if exists public.ai_detection_logs cascade;
drop table if exists public.message_logs cascade;
drop table if exists public.execution_logs cascade;

create table public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id text,
  phone_number text,
  message_id text,
  stage text not null,
  event text,
  status text not null,
  input_data jsonb,
  output_data jsonb,
  processing_time_ms integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_execution_logs_request on public.execution_logs (request_id, created_at);
create index if not exists idx_execution_logs_stage on public.execution_logs (stage, created_at desc);
create index if not exists idx_execution_logs_phone on public.execution_logs (phone_number, created_at desc);
create index if not exists idx_execution_logs_status on public.execution_logs (status, created_at desc);

alter table public.execution_logs disable row level security;
