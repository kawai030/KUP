-- 0005_app_state — 워크스페이스 파일DB(.data/db.json)의 서버리스 영속화.
-- 임시 방식(C안): 전체 앱 상태를 단일 행(id=1)에 통짜 JSONB로 저장.
-- 서버리스(Vercel)는 로컬 파일시스템이 휘발이므로 .data/ 를 못 쓴다 → 이 테이블로 대체.
-- service_role(admin 클라이언트)만 접근한다. 프론트(anon/authenticated) 차단.
-- TODO: 관계형 테이블(A안: cards/publish_jobs/metrics/dm_rules …)로 정식 이관 시 폐기.

create table if not exists app_state (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);

-- RLS on + 정책 없음 → service_role(BYPASSRLS)만 읽고 쓴다.
alter table app_state enable row level security;

-- 단일 행 시드
insert into app_state (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;
