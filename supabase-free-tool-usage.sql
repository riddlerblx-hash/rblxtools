create table if not exists public.free_tool_usage (
  user_id uuid primary key references public.member_accounts(id) on delete cascade,
  used_count integer not null default 0 check (used_count >= 0 and used_count <= 5),
  last_ad_unlock_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.consume_free_tool_use(p_user_id uuid)
returns table (allowed boolean, used_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.free_tool_usage(user_id, used_count, updated_at)
  values (p_user_id, 0, now())
  on conflict (user_id) do nothing;

  update public.free_tool_usage
  set used_count = used_count + 1, updated_at = now()
  where user_id = p_user_id and used_count < 5
  returning free_tool_usage.used_count into next_count;

  if found then
    allowed := true;
    used_count := next_count;
  else
    select free_tool_usage.used_count into next_count
    from public.free_tool_usage
    where user_id = p_user_id;
    allowed := false;
    used_count := coalesce(next_count, 5);
  end if;
  return next;
end;
$$;

create or replace function public.reset_free_tool_usage(p_user_id uuid)
returns table (used_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.free_tool_usage(user_id, used_count, last_ad_unlock_at, updated_at)
  values (p_user_id, 0, now(), now())
  on conflict (user_id) do update
  set used_count = 0, last_ad_unlock_at = now(), updated_at = now()
  returning free_tool_usage.used_count into next_count;

  used_count := next_count;
  return next;
end;
$$;

grant execute on function public.consume_free_tool_use(uuid) to service_role;
grant execute on function public.reset_free_tool_usage(uuid) to service_role;
