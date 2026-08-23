-- Run once in the Supabase SQL Editor to remove the retired free-tool-use experiment.
drop function if exists public.consume_free_tool_use(uuid);
drop function if exists public.reset_free_tool_usage(uuid);
drop table if exists public.free_tool_usage;
