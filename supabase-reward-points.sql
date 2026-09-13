-- Run this in the Supabase SQL editor before deploying the reward-point workflow.
-- Point balances only change through the atomic function below; every attempted award
-- remains visible in the member's history.
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
  return entry;
end;
$$;
