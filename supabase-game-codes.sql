-- Run in Supabase before switching the Codes platform from its safe file store.
create table if not exists games (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  roblox_universe_id text unique, roblox_place_id text, roblox_url text, icon_url text,
  description text not null default '', codes_enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists game_codes (
  id uuid primary key default gen_random_uuid(), game_id uuid not null references games(id) on delete cascade,
  code text not null, normalized_code text not null, reward text not null default '',
  status text not null check (status in ('working','expired','unknown')),
  verification_status text not null check (verification_status in ('verified','community_confirmed','likely_working','unconfirmed','unknown')),
  source text not null default '', source_url text not null default '', added_at timestamptz,
  verified_at timestamptz, expired_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (game_id, normalized_code)
);
create index if not exists game_codes_game_status_idx on game_codes(game_id, status);
