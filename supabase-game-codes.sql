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

-- Community reports stay private until staff approve them into game_codes.
create table if not exists game_code_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  code text not null, reward text not null default '', source_url text not null default '',
  submitter_user_id uuid not null, submitter_name text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by_user_id uuid, reviewed_at timestamptz, review_note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists game_code_submissions_review_idx on game_code_submissions(status, created_at desc);

-- One account can change its vote, but cannot inflate a code's success rate.
create table if not exists game_code_votes (
  id uuid primary key default gen_random_uuid(),
  game_code_id uuid not null references game_codes(id) on delete cascade,
  voter_user_id uuid not null,
  worked boolean not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (game_code_id, voter_user_id)
);
create index if not exists game_code_votes_code_idx on game_code_votes(game_code_id);

-- A member can flag a code as expired once. Reports never automatically change a code.
create table if not exists game_code_expiry_reports (
  id uuid primary key default gen_random_uuid(),
  game_code_id uuid not null references game_codes(id) on delete cascade,
  reporter_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (game_code_id, reporter_user_id)
);
create index if not exists game_code_expiry_reports_code_idx on game_code_expiry_reports(game_code_id, created_at desc);

-- Community scores are intentionally permanent: one account gets one 1-5 rating per guide.
create table if not exists game_ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  voter_user_id uuid not null,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (game_id, voter_user_id)
);
create index if not exists game_ratings_game_idx on game_ratings(game_id);
