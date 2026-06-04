alter table detection_logs
add column if not exists match_details jsonb;
