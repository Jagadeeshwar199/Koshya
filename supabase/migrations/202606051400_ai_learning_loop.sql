alter table public.ai_detection_logs
add column if not exists message text,
add column if not exists intent text,
add column if not exists entities jsonb not null default '{}'::jsonb,
add column if not exists used_ai boolean not null default false;

create index if not exists idx_ai_detection_intent on public.ai_detection_logs (intent) where used_ai = true;
create index if not exists idx_ai_detection_used_ai on public.ai_detection_logs (used_ai, created_at desc);
