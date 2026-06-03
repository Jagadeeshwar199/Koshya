create table if not exists public.parser_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id text not null,
  raw_message text not null,
  normalized_message text not null,
  detected_intents jsonb not null default '[]'::jsonb,
  confidence_scores jsonb not null default '{}'::jsonb,
  extracted_entities jsonb not null default '{}'::jsonb,
  selected_route text,
  action_taken text,
  success boolean not null default true,
  failure_reason text,
  response_sent text
);

create index if not exists idx_parser_events_created_at on public.parser_events (created_at desc);
create index if not exists idx_parser_events_success on public.parser_events (success, created_at desc);
create index if not exists idx_parser_events_route on public.parser_events (selected_route);
create index if not exists idx_parser_events_failure on public.parser_events (failure_reason) where failure_reason is not null;

alter table public.parser_events enable row level security;

drop policy if exists deny_anon_access on public.parser_events;
drop policy if exists deny_authenticated_access on public.parser_events;
create policy deny_anon_access on public.parser_events for all to anon using (false) with check (false);
create policy deny_authenticated_access on public.parser_events for all to authenticated using (false) with check (false);
