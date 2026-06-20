create table if not exists public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  user_phone text not null,
  file_name text,
  file_type text not null check (file_type in ('csv', 'pdf', 'text')),
  raw_content text,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_statement_transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  txn_date date,
  description text not null,
  amount numeric not null,
  debit_credit text check (debit_credit in ('debit', 'credit', 'unknown')),
  raw_line text,
  row_index integer,
  txn_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_merchants (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  merchant_key text not null,
  normalized_name text not null,
  raw_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (statement_id, merchant_key)
);

create table if not exists public.bank_statement_detection_scores (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  merchant_id uuid not null references public.bank_statement_merchants (id) on delete cascade,
  confidence integer not null,
  breakdown jsonb not null default '{}'::jsonb,
  rule_result jsonb not null default '{}'::jsonb,
  used_ai boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_ai_calls (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  merchant_id uuid references public.bank_statement_merchants (id) on delete set null,
  model text not null,
  prompt text not null,
  response text,
  success boolean not null default false,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_detection_results (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  merchant_id uuid references public.bank_statement_merchants (id) on delete set null,
  service_name text not null,
  amount numeric,
  recurrence text,
  confidence integer not null,
  source text not null check (source in ('rule', 'ai')),
  shown_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_detection_logs (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  stage text not null,
  event text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_bank_statements_user_phone on public.bank_statements (user_phone, created_at desc);
create index if not exists idx_bank_statement_txn_statement on public.bank_statement_transactions (statement_id);
create index if not exists idx_bank_statement_merchants_statement on public.bank_statement_merchants (statement_id);
create index if not exists idx_bank_statement_logs_statement on public.bank_statement_detection_logs (statement_id, created_at);

alter table public.bank_statements enable row level security;
alter table public.bank_statement_transactions enable row level security;
alter table public.bank_statement_merchants enable row level security;
alter table public.bank_statement_detection_scores enable row level security;
alter table public.bank_statement_ai_calls enable row level security;
alter table public.bank_statement_detection_results enable row level security;
alter table public.bank_statement_detection_logs enable row level security;
