alter table public.ai_detection_logs
add column if not exists gemini_response text,
add column if not exists response_sent text;
