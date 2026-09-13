-- Run after supabase-contributor-rewards.sql.
-- Stores the contact route and immutable selected denomination for manual rewards.
alter table contributor_reward_redemptions
  add column if not exists denomination_cents integer,
  add column if not exists contact_type text check (contact_type in ('email','phone')),
  add column if not exists contact_value text;

-- The API must call this RPC with the authenticated user id, never accept a price from the browser.
-- Product/denomination checks and point deduction must remain in one database transaction.
