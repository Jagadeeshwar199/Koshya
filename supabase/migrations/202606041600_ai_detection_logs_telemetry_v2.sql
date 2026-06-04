alter table ai_detection_logs
add column if not exists raw_message text,
add column if not exists normalized_message text,
add column if not exists model text,
add column if not exists ai_intent text,
add column if not exists ai_confidence numeric,
add column if not exists success boolean,
add column if not exists error_message text;
