-- Run once in the Supabase SQL editor before deploying affiliate cash credits.
-- Each commission ID is unique, so a retry can never credit the same referral twice.

create table if not exists public.affiliate_cash_credits (
  commission_id text primary key,
  user_id uuid not null references public.member_accounts(id),
  cash_cents integer not null check (cash_cents > 0),
  created_at timestamptz not null default now()
);

create or replace function public.credit_affiliate_cash(
  p_user_id uuid,
  p_commission_id text,
  p_cash_cents integer
)
returns table(rblxtools_cash_cents integer, credited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_rows integer := 0;
  did_credit boolean := false;
  new_balance integer;
begin
  if p_cash_cents is null or p_cash_cents <= 0 then
    raise exception 'Cash credit must be positive';
  end if;

  insert into affiliate_cash_credits (commission_id, user_id, cash_cents)
  values (p_commission_id, p_user_id, p_cash_cents)
  on conflict (commission_id) do nothing;
  get diagnostics inserted_rows = row_count;
  did_credit := inserted_rows > 0;

  if did_credit then
    update member_accounts as account
    set rblxtools_cash_cents = coalesce(account.rblxtools_cash_cents, 0) + p_cash_cents,
        updated_at = now()
    where account.id = p_user_id
    returning account.rblxtools_cash_cents into new_balance;
    if not found then raise exception 'Account not found'; end if;
  else
    select coalesce(rblxtools_cash_cents, 0) into new_balance
    from member_accounts as account where account.id = p_user_id;
    if not found then raise exception 'Account not found'; end if;
  end if;

  rblxtools_cash_cents := new_balance;
  credited := did_credit;
  return next;
end;
$$;

revoke all on function public.credit_affiliate_cash(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.credit_affiliate_cash(uuid, text, integer) to service_role;
