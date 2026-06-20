alter table public.bank_statements
  add column if not exists file_hash text,
  add column if not exists bank_name text,
  add column if not exists user_response jsonb;

create unique index if not exists idx_bank_statements_file_hash
  on public.bank_statements (user_phone, file_hash)
  where file_hash is not null;

alter table public.bank_statement_transactions
  add column if not exists raw_description text,
  add column if not exists normalized_merchant text;

alter table public.bank_statement_detection_scores
  add column if not exists confidence_before integer,
  add column if not exists confidence_after integer;

alter table public.bank_statement_ai_calls
  add column if not exists confidence_before integer,
  add column if not exists confidence_after integer;

alter table public.bank_statement_detection_results
  add column if not exists user_confirmed boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;

create table if not exists public.bank_statement_rejections (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  merchant_id uuid references public.bank_statement_merchants (id) on delete set null,
  merchant_name text not null,
  confidence integer,
  rejection_reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_feedback (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  result_id uuid references public.bank_statement_detection_results (id) on delete set null,
  user_phone text not null,
  correction jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bank_statement_rejections_statement on public.bank_statement_rejections (statement_id);
create index if not exists idx_bank_statement_feedback_statement on public.bank_statement_feedback (statement_id);

alter table public.bank_statement_rejections enable row level security;
alter table public.bank_statement_feedback enable row level security;
