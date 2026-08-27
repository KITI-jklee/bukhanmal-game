-- Canonical PostgreSQL schema — the full source of truth for a NEW
-- deployment. Run this once against a fresh Supabase/Postgres database
-- (every statement is idempotent — `create table/index if not exists` — so
-- re-running it later, e.g. after pulling schema changes, is also safe).
--
-- An EXISTING deployment that was created before request_limits/RLS/revoke
-- landed here should NOT re-run this whole file blindly — run
-- supabase_hardening.sql instead, which contains only the incremental
-- statements needed to bring such a deployment up to the same end state.
-- (supabase_hardening.sql is also idempotent, so running it again — even
-- against a database already fully created via this file — is a safe no-op.)
begin;

create table if not exists public.game_scores (
  score_id uuid primary key,
  player_key uuid not null,
  submission_key uuid not null unique,
  nickname varchar(10) not null,
  game_type varchar(20) not null,
  difficulty varchar(5) not null,
  score integer not null default 0,
  correct_count smallint not null default 0,
  no_hint_correct_count smallint,
  max_combo smallint not null default 0,
  stage_reached smallint,
  time_stop_uses smallint,
  time_stop_clears smallint,
  play_time_seconds integer,
  played_at timestamptz not null default now(),
  constraint ck_game_scores_nickname check (length(trim(nickname)) between 1 and 10),
  -- game_type 값 목록은 server/app/schemas.py의 GameType과 반드시 같아야 한다
  -- (SQL CHECK 문자열이라 그 타입에서 자동으로 뽑아낼 수 없다 — 값 목록이
  -- 바뀌면 여기·app/models.py·아래 game_events 제약을 모두 손으로 맞출 것).
  constraint ck_game_scores_game_type check (game_type in ('chosung', 'acid_rain')),
  constraint ck_game_scores_difficulty check (difficulty in ('쉬움', '보통', '어려움')),
  constraint ck_game_scores_nonnegative check (
    score >= 0 and correct_count >= 0 and max_combo >= 0
    and (no_hint_correct_count is null or no_hint_correct_count >= 0)
    and (time_stop_uses is null or time_stop_uses >= 0)
    and (time_stop_clears is null or time_stop_clears >= 0)
    and (play_time_seconds is null or play_time_seconds >= 0)
  ),
  constraint ck_game_scores_stage check (stage_reached is null or stage_reached between 1 and 3),
  constraint ck_game_scores_game_fields check (
    (game_type = 'chosung' and stage_reached is null and time_stop_uses is null
      and time_stop_clears is null and play_time_seconds is null)
    or
    (game_type = 'acid_rain' and no_hint_correct_count is null and stage_reached is not null)
  )
);

create index if not exists idx_game_scores_leaderboard
  on public.game_scores (game_type, difficulty, score, played_at);
create index if not exists idx_game_scores_player_recent
  on public.game_scores (player_key, played_at);

create table if not exists public.game_events (
  event_id uuid primary key,
  event_type varchar(20) not null,
  player_key uuid not null,
  game varchar(20),
  difficulty varchar(5),
  occurred_at timestamptz not null default now(),
  constraint ck_game_events_event_type check (event_type in ('game_start', 'page_view')),
  constraint ck_game_events_game check (game is null or game in ('chosung', 'acid_rain')),
  constraint ck_game_events_difficulty check (difficulty is null or difficulty in ('쉬움', '보통', '어려움')),
  constraint ck_game_events_type_fields check (
    (event_type = 'game_start' and game is not null and difficulty is not null)
    or (event_type = 'page_view' and game is null and difficulty is null)
  )
);

create index if not exists idx_game_events_type_time
  on public.game_events (event_type, occurred_at);

create table if not exists public.request_limits (
  bucket_key varchar(64) primary key,
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 1)
);

create index if not exists idx_request_limits_window
  on public.request_limits (window_started_at);

alter table public.game_scores enable row level security;
alter table public.game_events enable row level security;
alter table public.request_limits enable row level security;

revoke all privileges on table public.game_scores from anon, authenticated;
revoke all privileges on table public.game_events from anon, authenticated;
revoke all privileges on table public.request_limits from anon, authenticated;

commit;