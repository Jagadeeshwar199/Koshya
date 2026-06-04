alter table parser_events
add column if not exists message_id uuid references public.message_logs (id) on delete set null,
add column if not exists selected_intent text,
add column if not exists confidence numeric,
add column if not exists matched_rule text;
