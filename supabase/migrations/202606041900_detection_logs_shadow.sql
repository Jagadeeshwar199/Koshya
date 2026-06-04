alter table public.detection_logs
add column if not exists pipeline text default 'legacy',
add column if not exists message text,
add column if not exists domain text,
add column if not exists action text,
add column if not exists score numeric,
add column if not exists reasons jsonb default '[]'::jsonb,
add column if not exists can_execute boolean,
add column if not exists missing_fields jsonb default '[]'::jsonb,
add column if not exists used_ai boolean default false;
