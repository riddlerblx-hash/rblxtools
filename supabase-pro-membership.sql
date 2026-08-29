-- Run once in the Supabase SQL editor. premium_active remains true for Plus and Pro;
-- plus_active is only true for the lower Plus tier.
alter table public.member_accounts
  add column if not exists plus_active boolean not null default false;

update public.member_accounts
set plus_active = (lower(coalesce(plan, 'free')) = 'plus');
