-- Run this once in Supabase SQL Editor before deploying the threaded code-post comments feature.
alter table game_code_comments add column if not exists parent_comment_id uuid references game_code_comments(id) on delete cascade;
alter table game_code_comments add column if not exists author_avatar_url text not null default '';
alter table game_code_comments add column if not exists updated_at timestamptz not null default now();
create index if not exists game_code_comments_parent_idx on game_code_comments(parent_comment_id, created_at asc);

create table if not exists game_code_comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references game_code_comments(id) on delete cascade,
  voter_user_id uuid not null,
  reaction text not null check (reaction in ('heart', 'x')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comment_id, voter_user_id)
);
create index if not exists game_code_comment_reactions_comment_idx on game_code_comment_reactions(comment_id);

alter table games add column if not exists pinned_game_code_comment_id uuid;
