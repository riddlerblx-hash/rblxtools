-- Run this in the Supabase SQL editor before deploying the reward-point workflow.
-- Point balances only change through the atomic function below; every attempted award
-- remains visible in the member's history.
alter table member_accounts
  add column if not exists reward_points integer not null default 0;

update member_accounts
  set reward_points = 0
  where reward_points is null;

create table if not exists reward_point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_type text not null check (source_type in ('working_code','expired_code_report','gift_card_request')),
  source_id uuid,
  title text not null,
  points_delta integer not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists reward_point_transactions_source_unique
  on reward_point_transactions(source_type, source_id) where source_id is not null;
create index if not exists reward_point_transactions_user_history_idx
  on reward_point_transactions(user_id, created_at desc);

-- The application checks this before allowing an admin approval. That means a
-- code action can never be approved without the matching reward being able to
-- be recorded atomically.
create or replace function reward_points_ready() returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'member_accounts' and column_name = 'reward_points')
    and exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reward_point_transactions')
    and to_regprocedure('public.award_reward_points(uuid,text,uuid,text,integer,uuid,text)') is not null;
$$;

alter table game_code_expiry_reports add column if not exists status text not null default 'pending'
  check (status in ('pending','approved','rejected'));
alter table game_code_expiry_reports add column if not exists reviewed_by_user_id uuid;
alter table game_code_expiry_reports add column if not exists reviewed_at timestamptz;
alter table game_code_expiry_reports add column if not exists review_note text not null default '';

create or replace function award_reward_points(
  p_user_id uuid, p_source_type text, p_source_id uuid, p_title text,
  p_points integer, p_admin_user_id uuid, p_note text default ''
) returns reward_point_transactions
language plpgsql security definer set search_path = public as $$
declare entry reward_point_transactions;
begin
  insert into reward_point_transactions (user_id, source_type, source_id, title, points_delta, status, reviewed_by_user_id, reviewed_at, note)
  values (p_user_id, p_source_type, p_source_id, p_title, greatest(0, p_points), 'approved', p_admin_user_id, now(), coalesce(p_note, ''))
  on conflict (source_type, source_id) where source_id is not null do update set
    status = 'approved', reviewed_by_user_id = excluded.reviewed_by_user_id,
    reviewed_at = excluded.reviewed_at, note = excluded.note, updated_at = now()
  where reward_point_transactions.status = 'pending'
  returning * into entry;
  if entry.id is null then
    raise exception 'This point award was already reviewed';
  end if;
  update member_accounts set reward_points = greatest(0, coalesce(reward_points, 0) + entry.points_delta), updated_at = now() where id = p_user_id;
  if not found then
    raise exception 'The member account for this reward no longer exists';
  end if;
  return entry;
end;
$$;

-- Repair approvals made before the reward function was available. This credits
-- only new/pending ledger rows, so it is safe to run more than once.
with approved_sources as (
  select id as source_id, submitter_user_id as user_id, 'working_code'::text as source_type,
    'Working code approved'::text as title, 20::integer as points, reviewed_by_user_id, reviewed_at, review_note as note
  from game_code_submissions where status = 'approved'
  union all
  select id as source_id, reporter_user_id as user_id, 'expired_code_report'::text as source_type,
    'Inactive code report approved'::text as title, 3::integer as points, reviewed_by_user_id, reviewed_at, review_note as note
  from game_code_expiry_reports where status = 'approved'
), inserted as (
  insert into reward_point_transactions (user_id, source_type, source_id, title, points_delta, status, reviewed_by_user_id, reviewed_at, note)
  select user_id, source_type, source_id, title, points, 'approved', reviewed_by_user_id, coalesce(reviewed_at, now()), coalesce(note, '')
  from approved_sources
  on conflict (source_type, source_id) where source_id is not null do nothing
  returning user_id, points_delta
), promoted as (
  update reward_point_transactions ledger
  set status = 'approved', reviewed_at = coalesce(source.reviewed_at, now()), reviewed_by_user_id = source.reviewed_by_user_id,
    note = coalesce(source.note, ''), updated_at = now()
  from approved_sources source
  where ledger.source_type = source.source_type and ledger.source_id = source.source_id and ledger.status = 'pending'
  returning ledger.user_id, ledger.points_delta
), credits as (
  select user_id, points_delta from inserted
  union all
  select user_id, points_delta from promoted
), totals as (
  select user_id, sum(points_delta)::integer as points from credits group by user_id
)
update member_accounts account
set reward_points = greatest(0, coalesce(account.reward_points, 0) + totals.points), updated_at = now()
from totals where account.id = totals.user_id;
