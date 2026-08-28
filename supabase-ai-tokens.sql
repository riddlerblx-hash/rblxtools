-- Run once in Supabase SQL Editor before deploying the AI token system.
alter table public.member_accounts
  add column if not exists ai_token_balance integer not null default 0;

alter table public.member_accounts
  alter column ai_token_balance set default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'member_accounts_ai_token_balance_nonnegative'
  ) then
    alter table public.member_accounts
      add constraint member_accounts_ai_token_balance_nonnegative
      check (ai_token_balance >= 0) not valid;
  end if;
end;
$$;

create table if not exists public.ai_token_purchases (
  stripe_session_id text primary key,
  user_id uuid not null references public.member_accounts(id),
  token_amount integer not null check (token_amount > 0),
  created_at timestamptz not null default now()
);

create or replace function public.grant_ai_token_purchase(
  p_session_id text,
  p_user_id uuid,
  p_tokens integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_tokens <= 0 then
    raise exception 'AI token amount must be positive';
  end if;

  insert into public.ai_token_purchases (stripe_session_id, user_id, token_amount)
  values (p_session_id, p_user_id, p_tokens)
  on conflict (stripe_session_id) do nothing;

  if found then
    update public.member_accounts
    set ai_token_balance = ai_token_balance + p_tokens,
        updated_at = now()
    where id = p_user_id
    returning ai_token_balance into v_balance;
  else
    select ai_token_balance into v_balance
    from public.member_accounts
    where id = p_user_id;
  end if;

  if v_balance is null then
    raise exception 'Member account was not found';
  end if;

  return v_balance;
end;
$$;
