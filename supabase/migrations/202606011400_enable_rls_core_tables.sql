-- Enable RLS on Koshya user-data tables and block anon/authenticated access.
-- The backend uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.

alter table public.messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.pending_drafts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.conversation_state enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'messages',
    'subscriptions',
    'reminders',
    'pending_drafts',
    'webhook_events',
    'conversation_state'
  ]
  loop
    execute format('drop policy if exists deny_anon_access on public.%I', tbl);
    execute format('drop policy if exists deny_authenticated_access on public.%I', tbl);

    execute format(
      'create policy deny_anon_access on public.%I for all to anon using (false) with check (false)',
      tbl
    );
    execute format(
      'create policy deny_authenticated_access on public.%I for all to authenticated using (false) with check (false)',
      tbl
    );
  end loop;
end $$;
