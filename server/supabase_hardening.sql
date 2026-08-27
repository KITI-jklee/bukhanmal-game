-- Incremental patch for an EXISTING Supabase project — one that was created
-- before request_limits/the anon·authenticated Data API lockdown were added
-- to supabase_schema.sql. It brings such a deployment up to the same end
-- state that a fresh run of supabase_schema.sql already produces, WITHOUT
-- touching game_scores/game_events (those already exist and this file never
-- creates/drops them).
--
-- Relationship to supabase_schema.sql:
--   - supabase_schema.sql = full source of truth for a brand-new deployment.
--   - supabase_hardening.sql (this file) = the incremental subset of that
--     same source of truth, for a deployment that predates it.
-- Both files are idempotent, so it is always safe to run either one more
-- than once — including running this file against a database that was
-- already fully created via supabase_schema.sql (every statement below is a
-- no-op in that case: the table/index already exist, the privileges are
-- already revoked, and there are no legacy policies left to drop).
--
-- What this does, in order:
--   1. Create request_limits (+ its index, + RLS enabled) if it doesn't
--      exist yet — this table is a later addition than game_scores/game_events.
--   2. Defensively (re-)enable RLS on game_scores/game_events. supabase_schema.sql
--      has always enabled RLS on these two, so on any deployment created from
--      it this is a no-op — it only matters for a deployment old enough to
--      predate that. ENABLE ROW LEVEL SECURITY is idempotent either way.
--   3. Revoke anon/authenticated table privileges on all three tables. This
--      is the actual Data API lockdown; RLS alone does not block access —
--      FastAPI is the only intended caller, connecting with the Postgres
--      role directly rather than through PostgREST's anon/authenticated keys.
--   4. Drop legacy permissive policies that predate this lockdown, if a
--      pre-lockdown deployment still has them lying around.
begin;

create table if not exists public.request_limits (
  bucket_key varchar(64) primary key,
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 1)
);
alter table public.request_limits enable row level security;
create index if not exists idx_request_limits_window on public.request_limits (window_started_at);

alter table public.game_scores enable row level security;
alter table public.game_events enable row level security;

revoke all privileges on table public.game_scores from anon, authenticated;
revoke all privileges on table public.game_events from anon, authenticated;
revoke all privileges on table public.request_limits from anon, authenticated;

drop policy if exists "anon can insert scores" on public.game_scores;
drop policy if exists "anon can read scores" on public.game_scores;
drop policy if exists "anon can insert events" on public.game_events;

commit;