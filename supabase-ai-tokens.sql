-- Run once in Supabase SQL Editor before deploying the AI token system.
alter table public.member_accounts
  add column if not exists ai_token_balance integer not null default 0;

alter table public.member_accounts
  add constraint member_accounts_ai_token_balance_nonnegative
  check (ai_token_balance >= 0) not valid;
