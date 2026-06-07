alter table public.reminders
  add column if not exists task_text text,
  add column if not exists schedule_text text,
  add column if not exists item_type text,
  add column if not exists rule_intent text,
  add column if not exists rule_score integer,
  add column if not exists ai_intent text,
  add column if not exists ai_confidence integer,
  add column if not exists final_intent text,
  add column if not exists escalated_to_ai boolean default false;

alter table public.subscriptions
  add column if not exists task_text text,
  add column if not exists schedule_text text,
  add column if not exists item_type text,
  add column if not exists rule_intent text,
  add column if not exists rule_score integer,
  add column if not exists ai_intent text,
  add column if not exists ai_confidence integer,
  add column if not exists final_intent text,
  add column if not exists escalated_to_ai boolean default false;

alter table public.ai_detection_logs
  add column if not exists task_text text,
  add column if not exists schedule_text text,
  add column if not exists item_type text,
  add column if not exists escalated_to_ai boolean default false;
