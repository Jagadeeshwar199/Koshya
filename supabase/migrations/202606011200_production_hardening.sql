-- Production hardening: indexes and reminder status guard

create index if not exists idx_webhook_events_processed_at
  on public.webhook_events (processed_at desc);

create index if not exists idx_conversation_state_updated_at
  on public.conversation_state (updated_at desc);

create index if not exists idx_pending_drafts_updated_at
  on public.pending_drafts (updated_at desc);

create index if not exists idx_reminders_pending_delivery
  on public.reminders (status, trigger_at, retry_count)
  where status in ('pending', 'failed');
