-- Run once in the Supabase SQL editor before enabling production cashback.
-- This RPC is service-role only and makes the cash credit idempotent: the same
-- cashback ledger entry can never increase a member balance twice.

create table if not exists public.rewards_cashback_credits (
  cashback_id uuid primary key,
  user_id uuid not null references public.member_accounts(id),
  cash_cents integer not null check (cash_cents > 0),
  created_at timestamptz not null default now()
);

create or replace function public.credit_rewards_cashback(
  p_user_id uuid,
  p_cashback_id uuid,
  p_cash_cents integer
)
returns table(rblxtools_cash_cents integer, credited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_rows integer := 0;
  new_balance integer;
begin
  if p_user_id is null or p_cashback_id is null or p_cash_cents is null or p_cash_cents <= 0 then
    raise exception 'A positive cashback credit and valid member are required';
  end if;

  insert into public.rewards_cashback_credits (cashback_id, user_id, cash_cents)
  values (p_cashback_id, p_user_id, p_cash_cents)
  on conflict (cashback_id) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows > 0 then
    update public.member_accounts as account
    set rblxtools_cash_cents = coalesce(account.rblxtools_cash_cents, 0) + p_cash_cents,
        updated_at = now()
    where account.id = p_user_id
    returning account.rblxtools_cash_cents into new_balance;
  else
    select coalesce(account.rblxtools_cash_cents, 0)
    into new_balance
    from public.member_accounts as account
    where account.id = p_user_id;
  end if;

  if new_balance is null then raise exception 'Account not found'; end if;
  rblxtools_cash_cents := new_balance;
  credited := inserted_rows > 0;
  return next;
end;
$$;

revoke all on function public.credit_rewards_cashback(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.credit_rewards_cashback(uuid, uuid, integer) to service_role;
