-- Run once in the Supabase SQL Editor to enable AI Thumbnail Studio chat history.
create table if not exists public.ai_thumbnail_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_accounts(id) on delete cascade,
  prompt text not null,
  reference_images jsonb not null default '[]'::jsonb,
  image_data_url text not null,
  download_filename text not null default 'rblxtools-ai-thumbnail.png',
  feedback text check (feedback in ('like', 'dislike')),
  created_at timestamptz not null default now()
);

create index if not exists ai_thumbnail_history_user_created_idx
  on public.ai_thumbnail_history (user_id, created_at desc);
