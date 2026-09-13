-- Run once in Supabase SQL Editor before enabling contributor rewards.
-- Point awards are deliberately performed only by the protected approval RPC below.

alter table member_accounts add column if not exists reward_points integer not null default 0 check (reward_points >= 0);
alter table member_accounts add column if not exists lifetime_reward_points integer not null default 0 check (lifetime_reward_points >= 0);
alter table member_accounts add column if not exists rblxtools_cash_cents integer not null default 0 check (rblxtools_cash_cents >= 0);

create table if not exists contributor_reward_catalog (
  id text primary key,
  title text not null,
  fulfillment_type text not null check (fulfillment_type in ('instant_internal','manual_external')),
  points_cost integer not null check (points_cost > 0),
  cash_cents integer not null default 0 check (cash_cents >= 0),
  ai_tokens integer not null default 0 check (ai_tokens >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contributor_reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references member_accounts(id),
  amount_points integer not null default 0,
  transaction_type text not null,
  source_id text,
  admin_user_id uuid references member_accounts(id),
  description text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists contributor_reward_source_once_idx on contributor_reward_transactions(transaction_type, source_id) where source_id is not null and transaction_type like 'contribution_%';
create index if not exists contributor_reward_transactions_user_idx on contributor_reward_transactions(user_id, created_at desc);

create table if not exists contributor_reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references member_accounts(id),
  reward_id text not null references contributor_reward_catalog(id),
  points_cost integer not null check (points_cost > 0),
  fulfillment_type text not null check (fulfillment_type in ('instant_internal','manual_external')),
  status text not null check (status in ('completed','pending_review','fulfilled','rejected_refunded')),
  cash_cents integer not null default 0,
  ai_tokens integer not null default 0,
  fulfilled_by_admin_id uuid references member_accounts(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists contributor_reward_redemptions_user_idx on contributor_reward_redemptions(user_id, created_at desc);

insert into contributor_reward_catalog (id,title,fulfillment_type,points_cost,cash_cents)
values
 ('cash-050','RBLXTools Cash — $0.50','instant_internal',500,50),
 ('cash-100','RBLXTools Cash — $1.00','instant_internal',1000,100),
 ('cash-250','RBLXTools Cash — $2.50','instant_internal',2500,250),
 ('cash-500','RBLXTools Cash — $5.00','instant_internal',5000,500)
on conflict (id) do nothing;

create or replace function redeem_contributor_reward(p_user_id uuid, p_reward_id text)
returns contributor_reward_redemptions
language plpgsql security definer set search_path = public
as $$
declare
  reward contributor_reward_catalog;
  account member_accounts;
  redemption contributor_reward_redemptions;
begin
  select * into reward from contributor_reward_catalog where id = p_reward_id and active = true for update;
  if not found then raise exception 'Reward is unavailable'; end if;
  select * into account from member_accounts where id = p_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  if account.reward_points < reward.points_cost then raise exception 'Not enough RBLX Points'; end if;

  update member_accounts set reward_points = reward_points - reward.points_cost,
    rblxtools_cash_cents = rblxtools_cash_cents + case when reward.fulfillment_type = 'instant_internal' then reward.cash_cents else 0 end,
    ai_token_balance = coalesce(ai_token_balance, 0) + case when reward.fulfillment_type = 'instant_internal' then reward.ai_tokens else 0 end,
    updated_at = now() where id = p_user_id;

  insert into contributor_reward_redemptions (user_id,reward_id,points_cost,fulfillment_type,status,cash_cents,ai_tokens,completed_at)
  values (p_user_id,reward.id,reward.points_cost,reward.fulfillment_type,
    case when reward.fulfillment_type = 'instant_internal' then 'completed' else 'pending_review' end,
    reward.cash_cents,reward.ai_tokens,case when reward.fulfillment_type = 'instant_internal' then now() else null end)
  returning * into redemption;

  insert into contributor_reward_transactions (user_id,amount_points,transaction_type,source_id,description)
  values (p_user_id,-reward.points_cost,'reward_redemption',redemption.id::text,'Redeemed ' || reward.title);
  return redemption;
end;
$$;
