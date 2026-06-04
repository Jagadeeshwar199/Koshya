alter table public.detection_logs
  add column if not exists raw_message text,
  add column if not exists normalized_message text;
