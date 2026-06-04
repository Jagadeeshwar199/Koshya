-- Align pipeline observability tables with messages (RLS off for server-side inserts via anon key).
alter table public.message_logs disable row level security;
alter table public.detection_logs disable row level security;
alter table public.ai_detection_logs disable row level security;
alter table public.validation_logs disable row level security;
alter table public.execution_logs disable row level security;
alter table public.system_errors disable row level security;
