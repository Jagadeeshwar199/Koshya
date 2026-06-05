alter table public.ai_detection_logs
add column if not exists rule_intent text,
add column if not exists rule_confidence numeric,
add column if not exists final_intent text;

create index if not exists idx_ai_detection_final_intent on public.ai_detection_logs (final_intent) where used_ai = true;
