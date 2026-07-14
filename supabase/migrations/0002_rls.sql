-- RLS — 데이터모델 §6. 소유권 경로: channel.user_id = auth.uid().
-- service_role(워커)은 BYPASSRLS 이므로 정책 불필요. 프론트는 anon+authenticated.

-- 모든 앱 테이블 RLS on
alter table profiles               enable row level security;
alter table subscriptions          enable row level security;
alter table channels               enable row level security;
alter table ig_tokens              enable row level security;
alter table channel_configs        enable row level security;
alter table decks                  enable row level security;
alter table reviews                enable row level security;
alter table schedules              enable row level security;
alter table posts                  enable row level security;
alter table lead_magnets           enable row level security;
alter table dm_logs                enable row level security;
alter table channel_insights_daily enable row level security;
alter table post_insights          enable row level security;
alter table challenge_logs         enable row level security;
alter table events                 enable row level security;

-- ── 본인 = auth.uid() ────────────────────────────────────────────────────
create policy own_profile on profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy own_subscription on subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_channel on channels
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── channel 소유 테이블 ──────────────────────────────────────────────────
create policy own_channel_rows_ig_tokens on ig_tokens
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_configs on channel_configs
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_decks on decks
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_posts on posts
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_lead_magnets on lead_magnets
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_dm_logs on dm_logs
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_insights_daily on channel_insights_daily
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

create policy own_channel_rows_challenge on challenge_logs
  for all to authenticated
  using (channel_id in (select id from channels where user_id = auth.uid()))
  with check (channel_id in (select id from channels where user_id = auth.uid()));

-- ── deck 소유 테이블(deck → channel → user) ─────────────────────────────
create policy own_deck_rows_reviews on reviews
  for all to authenticated
  using (deck_id in (
    select d.id from decks d
    join channels c on c.id = d.channel_id
    where c.user_id = auth.uid()))
  with check (deck_id in (
    select d.id from decks d
    join channels c on c.id = d.channel_id
    where c.user_id = auth.uid()));

create policy own_deck_rows_schedules on schedules
  for all to authenticated
  using (deck_id in (
    select d.id from decks d
    join channels c on c.id = d.channel_id
    where c.user_id = auth.uid()))
  with check (deck_id in (
    select d.id from decks d
    join channels c on c.id = d.channel_id
    where c.user_id = auth.uid()));

-- ── post 소유 테이블(post → deck → channel → user) ──────────────────────
create policy own_post_rows_post_insights on post_insights
  for all to authenticated
  using (post_id in (
    select p.id from posts p
    join channels c on c.id = p.channel_id
    where c.user_id = auth.uid()))
  with check (post_id in (
    select p.id from posts p
    join channels c on c.id = p.channel_id
    where c.user_id = auth.uid()));

-- ── events: 본인 user 또는 본인 channel ─────────────────────────────────
create policy own_events on events
  for all to authenticated
  using (
    user_id = auth.uid()
    or channel_id in (select id from channels where user_id = auth.uid()))
  with check (
    user_id = auth.uid()
    or channel_id in (select id from channels where user_id = auth.uid()));
