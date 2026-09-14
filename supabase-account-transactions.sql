-- Run this once in the Supabase SQL editor before deploying the account
-- transaction history update. This is an activity ledger only: balances remain
-- controlled by their existing, atomic point/token flows.
create table if not exists public.account_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_accounts(id),
  category text not null check (category in ('ai_tokens', 'purchases', 'sales', 'affiliate')),
  source_type text not null,
  source_id text not null,
  title text not null,
  amount_delta integer not null,
  unit text not null check (unit in ('tokens', 'points', 'usd_cents')),
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'rejected')),
  note text not null default '',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists account_transactions_source_once_idx
  on public.account_transactions (user_id, source_type, source_id);
create index if not exists account_transactions_user_history_idx
  on public.account_transactions (user_id, created_at desc);
