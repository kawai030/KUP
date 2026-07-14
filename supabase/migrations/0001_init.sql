-- Kup 초기 스키마 — 데이터모델(Kup_데이터모델.md) §4·§5·§6 반영.
-- 적용: Task 6에서 `supabase db push`. 인증은 auth.users(Supabase Auth), 앱 데이터는 public.
-- 소유권 경로: channel.user_id = auth.uid() (RLS). 워커는 service_role로 우회.

-- ──────────────────────────────────────────────────────────────────────────
-- Enums (§4)
-- ──────────────────────────────────────────────────────────────────────────
create type plan_tier       as enum ('basic','pro','premium');
create type billing_cycle   as enum ('monthly','yearly');
create type sub_status      as enum ('beta_free','active','canceled','past_due');
create type channel_status  as enum ('connected','needs_setup');
create type deck_status     as enum ('planning','planned','producing','produced','scheduled','published');
create type deck_format     as enum ('cardnews','cardnews_photo');
create type risk_level      as enum ('low','high');
create type review_decision as enum ('approved','rejected');
create type schedule_status as enum ('pending','processing','done','failed','canceled');
create type post_status     as enum ('creating','published','failed');
create type dm_status       as enum ('sent','failed','skipped_quota');

-- ──────────────────────────────────────────────────────────────────────────
-- 계정·요금제 (§2.1)
-- ──────────────────────────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nickname text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan plan_tier not null default 'basic',
  billing_cycle billing_cycle not null default 'monthly',
  status sub_status not null default 'beta_free',
  current_period_end timestamptz,
  auto_renew boolean not null default true
);
create index on subscriptions (user_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 채널 (§2.2)
-- ──────────────────────────────────────────────────────────────────────────
create table channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ig_user_id text,
  ig_username text,
  status channel_status not null default 'needs_setup',
  connected_at timestamptz
);
create index on channels (user_id);

create table ig_tokens (
  channel_id uuid primary key references channels(id) on delete cascade,
  access_token_enc bytea not null,                 -- libsodium/KMS 봉인. 평문 금지(SPEC 2.2)
  token_type text not null default 'long_lived',
  expires_at timestamptz                           -- token-refresh 잡 트리거 기준 ⏱
);

create table channel_configs (
  channel_id uuid primary key references channels(id) on delete cascade,
  persona text not null,
  tone text not null,
  pillars text[] not null,
  cadence text,
  visual jsonb not null default '{}',
  survey_raw jsonb,
  locked_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────
-- 콘텐츠 코어 (§2.3) — decks.slides 는 deck-schema.ts(파이프라인 §1.2)와 1:1
-- ──────────────────────────────────────────────────────────────────────────
create table decks (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  status deck_status not null default 'planning',
  format deck_format not null default 'cardnews',
  topic text,
  strategy text,
  hook text,
  lead_keyword text,
  slides jsonb not null default '[]',
  caption text,
  hashtags text[] not null default '{}',
  ai_flags jsonb not null default '[]',
  risk_level risk_level,
  slide_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on decks (channel_id, status);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  ai_flags jsonb not null default '[]',
  risk_level risk_level,
  ai_label_applied boolean not null default true,
  decision review_decision not null,
  approved_by uuid references profiles(id),
  decided_at timestamptz not null default now()
);
create index on reviews (deck_id);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  scheduled_at timestamptz not null,
  bullmq_job_id text,                              -- ⏱ BullMQ delayed job id ↔ 이 row
  status schedule_status not null default 'pending',
  attempts int not null default 0,
  last_error text
);
create index on schedules (status, scheduled_at);

create table posts (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  ig_media_id text,
  ig_container_id text,
  permalink text,
  published_at timestamptz,                         -- 잔디 적립 기준
  status post_status not null default 'creating'
);
create index on posts (channel_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 그로스 (§2.4)
-- ──────────────────────────────────────────────────────────────────────────
create table lead_magnets (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  post_id uuid references posts(id) on delete set null,
  keyword text not null,                            -- = deck.lead_keyword (웹훅 매칭 키)
  dm_payload jsonb not null default '{}',
  active boolean not null default true
);
create index on lead_magnets (channel_id);

create table dm_logs (
  id uuid primary key default gen_random_uuid(),
  lead_magnet_id uuid not null references lead_magnets(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,  -- 한도 카운트 대상
  ig_recipient_id text,
  status dm_status not null,
  sent_at timestamptz not null default now()
);
-- 현재 청구주기 내 count(channel_id) vs subscriptions.plan 로 한도 검사
create index on dm_logs (channel_id, sent_at);

-- ──────────────────────────────────────────────────────────────────────────
-- 인사이트 & 게이미피케이션 (§2.5)
-- ──────────────────────────────────────────────────────────────────────────
create table channel_insights_daily (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  snapshot_date date not null,
  followers_count int,
  follows int,
  unfollows int,
  captured_at timestamptz,                          -- 04:00 기준
  unique (channel_id, snapshot_date)
);

create table post_insights (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views int, reach int, saved int, shares int,
  likes int, comments int, profile_visits int, follows int
);
create index on post_insights (post_id, captured_at);

create table challenge_logs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  log_date date not null,
  publish_count int not null default 0,            -- 칸 농도 5단계(0·1·2·3·4+)
  unique (channel_id, log_date)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on events (channel_id, created_at);

-- ──────────────────────────────────────────────────────────────────────────
-- decks.updated_at 자동 갱신
-- ──────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger decks_set_updated_at
  before update on decks
  for each row execute function set_updated_at();
