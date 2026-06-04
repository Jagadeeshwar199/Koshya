alter table public.detection_logs
add column if not exists planner_decision text;
