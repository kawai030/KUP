# Kup — 데이터 모델 (DB 스키마)

> **문서 성격**: SPEC/IA/생성 파이프라인을 **Postgres(Supabase) 테이블 구조**로 확정하는 설계 문서. 개발 트랙 영속화(Phase 3)가 가장 먼저 가져다 쓸 자산.
> **기준일**: 2026-06-26 · **선행**: [SPEC §3](../product/Kup_SPEC.md) · [IA 0.2~0.5](../product/Kup_IA.md) · [생성 파이프라인 §1 데이터 계약](Kup_생성파이프라인_설계.md) · [개발계획 §9 Phase3 테이블 목록](Kup_기술스택_개발계획.md)
> **DB**: Supabase Postgres. 인증은 `auth.users`(Supabase Auth) 사용, 앱 데이터는 `public` 스키마.
> **표기**: PK=기본키, FK=외래키, 🔒=암호화/민감, ⏱=BullMQ 연결점.

---

## 0. 설계 원칙

1. **단일 콘텐츠 단위 = `decks`.** AI 기획 리스트의 한 행 = 칸반 카드 1장 = 생성된 카드뉴스 1건. 기획→제작→발행을 한 row의 상태 전이로 본다.
2. **민감 토큰은 별도 테이블 + 암호화.** IG 토큰은 `ig_tokens`에 격리 보관(평문 금지, SPEC 2.2).
3. **검수는 발행 액션에 내장된 게이트** → `reviews`가 발행 시도마다 1행(감사 추적, SPEC 3.3).
4. **예약 발행은 코드 스케줄러** → `schedules.bullmq_job_id`로 BullMQ delayed job과 1:1 연결(⏱).
5. **인사이트는 스냅샷.** 04:00 수집값을 누적 저장(계정 단위/게시물 단위 분리).
6. **RLS 전제.** 모든 테이블은 `channel → user` 소유권으로 Row Level Security 적용(본인 데이터만 접근).

---

## 1. 텍스트 ERD

```
auth.users (Supabase Auth)
   │ 1:1
profiles ──1:N── subscriptions          (요금제·결제주기·상태)
   │
   │ 1:N
channels (연동 IG 계정)
   ├──1:1── ig_tokens          🔒 (암호화 토큰, 만료)
   ├──1:1── channel_configs        (잠긴 컨셉 = persona/tone/pillars/cadence/visual)
   ├──1:N── decks                  (콘텐츠 단위 · 칸반 6상태 · deck JSON)
   │           ├──1:N── reviews        (검수 게이트 결과 + 승인 로그)
   │           ├──1:1── schedules   ⏱  (예약 발행 ↔ BullMQ job)
   │           └──1:1── posts          (발행 결과: ig_media_id·permalink)
   │                       └──1:N── post_insights   (게시물 단위 성과 스냅샷)
   ├──1:N── lead_magnets               (키워드 트리거 + 보낼 자료)
   │           └──1:N── dm_logs        (DM 발송 기록 · 요금제 한도 카운트)
   ├──1:N── channel_insights_daily     (계정 단위 성과 일별)
   └──1:N── challenge_logs             (발행 잔디: 날짜별 발행 확정 건수)

events (전역 감사/분석 로그, 선택)
```

---

## 2. 엔티티 정의

### 2.1 계정·요금제

#### `profiles` *(IA 0.3 마이페이지 / 0.4 회원가입)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` (1:1) |
| `email` | text | auth와 동기 |
| `nickname` | text | 10자 이내·중복 확인(앱단 검증) |
| `marketing_opt_in` | boolean | [선택] 광고성 정보 동의 |
| `created_at` | timestamptz | |

#### `subscriptions` *(IA 0.2.2 / 0.5 결제)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→profiles | |
| `plan` | enum `plan_tier` | `basic`·`pro`·`premium` |
| `billing_cycle` | enum `billing_cycle` | `monthly`·`yearly`(연 30% 할인) |
| `status` | enum `sub_status` | `beta_free`·`active`·`canceled`·`past_due` |
| `current_period_end` | timestamptz | 다음 결제일 |
| `auto_renew` | boolean | 자동결제 ON/OFF |

> **베타**: 전원 `status='beta_free'`. 결제 모듈(0.5)은 MVP 범위 밖이나 스키마는 미리 잡아 v1.1 충격 흡수.

### 2.2 채널 (연동 IG 계정)

#### `channels`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK→profiles | user 1:N channel (랜딩 "여러 계정 연동" 대비) |
| `ig_user_id` | text | Graph API IG 비즈니스 계정 ID |
| `ig_username` | text | 표시용 핸들 |
| `status` | enum `channel_status` | `connected`·`needs_setup`(전제 미충족) |
| `connected_at` | timestamptz | |

#### `ig_tokens` 🔒 *(SPEC 2.2)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `channel_id` | uuid PK,FK→channels | 1:1 |
| `access_token_enc` | bytea | **암호화 저장**(libsodium/KMS). 평문 금지 |
| `token_type` | text | `long_lived` |
| `expires_at` | timestamptz | 갱신 잡 트리거 기준 ⏱ |

#### `channel_configs` *(= 생성 파이프라인 §1.1 Concept, SPEC 3.1 컨셉 잠금)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `channel_id` | uuid PK,FK→channels | 1:1 |
| `persona` | text | 1문장 |
| `tone` | text | 카피 스타일 제약 |
| `pillars` | text[] | 3~5개 콘텐츠 기둥 |
| `cadence` | text | 발행 빈도 |
| `visual` | jsonb | `{primary, primary2, accent, light, font}` (렌더 입력) |
| `survey_raw` | jsonb | 온보딩 설문 원본(재생성·디버그용) |
| `locked_at` | timestamptz | 1회 확정 시각 |

### 2.3 콘텐츠 코어

#### `decks` *(콘텐츠 단위 = AI 기획 리스트 행 + 생성 deck JSON, IA 0.2.3 / 0.2.4 칸반)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `channel_id` | uuid FK→channels | |
| `status` | enum `deck_status` | **칸반 6상태**(§3) |
| `format` | enum `deck_format` | `cardnews`·`cardnews_photo`(사진 첨부형) |
| `topic` | text | ① 주제 |
| `strategy` | text | ② 전략(검수자용 설명) |
| `hook` | text | ② 후킹 앵글 |
| `lead_keyword` | text | outro cta ↔ 리드마그넷 운영 키(파이프라인 §4) |
| `slides` | jsonb | deck 스키마 slides[](cover/body/outro) |
| `caption` | text | ≤2200(권장 ≤300) |
| `hashtags` | text[] | 5~10개 |
| `ai_flags` | jsonb | 자가점검 플래그(없으면 `[]`) |
| `risk_level` | enum `risk_level` | `low`·`high` |
| `slide_count` | int | 3~10 |
| `created_at` / `updated_at` | timestamptz | |

> `slides`/`caption`/`hashtags`/`ai_flags`/`risk_level`는 [생성 파이프라인 §1.2 Deck 계약](Kup_생성파이프라인_설계.md)과 **1:1 일치**. Zod 스키마 검증 통과분만 저장.

#### `reviews` *(검수 게이트 결과 + 승인 감사로그, SPEC 3.3)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `deck_id` | uuid FK→decks | 발행 시도마다 1행(N:1) |
| `ai_flags` | jsonb | 검수 시점 스냅샷 |
| `risk_level` | enum `risk_level` | |
| `ai_label_applied` | boolean | 'AI 생성물' 라벨(편집 시 해제 규칙) |
| `decision` | enum `review_decision` | `approved`·`rejected` |
| `approved_by` | uuid FK→profiles | 누가 |
| `decided_at` | timestamptz | 언제 |

#### `schedules` ⏱ *(예약 발행 ↔ BullMQ, SPEC 3.5)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `deck_id` | uuid FK→decks | 1:1(활성 예약) |
| `scheduled_at` | timestamptz | 예약 시각 |
| `bullmq_job_id` | text | **BullMQ delayed job id ↔ 이 row**(취소·재스케줄 키) |
| `status` | enum `schedule_status` | `pending`·`processing`·`done`·`failed`·`canceled` |
| `attempts` | int | 재시도 횟수 |
| `last_error` | text | 실패 사유(Sentry 연동) |

#### `posts` *(발행 결과, SPEC 3.5 Graph API 2단계)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `deck_id` | uuid FK→decks | 1:1 |
| `channel_id` | uuid FK→channels | |
| `ig_media_id` | text | 게시 후 미디어 ID |
| `ig_container_id` | text | 2단계 발행 컨테이너 ID |
| `permalink` | text | |
| `published_at` | timestamptz | 실제 발행 시각(잔디 적립 기준) |
| `status` | enum `post_status` | `creating`·`published`·`failed` |

### 2.4 그로스 (리드마그넷)

#### `lead_magnets` *(IA 0.2.5 자동화 설정, SPEC 3.6)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `channel_id` | uuid FK→channels | |
| `post_id` | uuid FK→posts NULL | 특정 게시물 한정 트리거(선택) |
| `keyword` | text | 댓글 트리거 키워드(= deck.lead_keyword) |
| `dm_payload` | jsonb | 보낼 자료(정리본 링크 등) |
| `active` | boolean | |

#### `dm_logs` *(발송 기록 + 요금제 한도, SPEC 3.6)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `lead_magnet_id` | uuid FK→lead_magnets | |
| `channel_id` | uuid FK→channels | 한도 카운트 대상 |
| `ig_recipient_id` | text | 댓글 작성자 |
| `status` | enum `dm_status` | `sent`·`failed`·`skipped_quota` |
| `sent_at` | timestamptz | |

> **요금제 한도**(베이직 100 / 프로 1,000 / 프리미엄 ∞)는 별도 컬럼이 아니라 **현재 청구주기 내 `dm_logs` count vs `subscriptions.plan`** 으로 발송 직전 검사. 한도 초과 시 `skipped_quota` 기록.

### 2.5 인사이트 & 게이미피케이션

#### `channel_insights_daily` *(계정 단위, SPEC 3.7)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `channel_id` | uuid FK→channels | |
| `snapshot_date` | date | (channel_id, snapshot_date) UNIQUE |
| `followers_count` | int | 호출 시점값 |
| `follows` | int | 유입(100명 이상부터 제공) |
| `unfollows` | int | 이탈 |
| `captured_at` | timestamptz | `04:00:00` 기준 |

#### `post_insights` *(게시물 단위 누적값, SPEC 3.7)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `post_id` | uuid FK→posts | |
| `captured_at` | timestamptz | 스냅샷 시각 |
| `views` `reach` `saved` `shares` `likes` `comments` `profile_visits` `follows` | int | Graph API 지표 |

#### `challenge_logs` *(발행 잔디, SPEC 3.7 / IA 0.2.6)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `channel_id` | uuid FK→channels | |
| `log_date` | date | (channel_id, log_date) UNIQUE |
| `publish_count` | int | 그날 발행 확정 건수 → 칸 농도 5단계(0·1·2·3·4+) |

> `posts.published_at` 집계로 파생 가능하나, 잔디 렌더 성능·예약 적립 규칙(실제 발행일) 명료화를 위해 **일별 집계 테이블로 분리**. 발행 성공 시 upsert.

#### `events` *(전역 감사/분석, 선택)*
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` / `channel_id` | uuid FK NULL | |
| `type` | text | `deck_generated`·`published`·`dm_sent`·`review_decided`… |
| `payload` | jsonb | |
| `created_at` | timestamptz | |

---

## 3. 칸반 6상태 매핑 (`deck_status`)

| 칸반 (IA 0.2.4) | enum | 진입 트리거 |
|---|---|---|
| 기획 중 | `planning` | 기획 행 생성 |
| 기획 완료 | `planned` | 주제·전략 확정(②) |
| 제작 중 | `producing` | 카피 생성 시작(③) |
| 제작 완료 | `produced` | deck JSON+렌더 완료, 편집 가능 |
| 예약 업로드 | `scheduled` | 검수 승인 + 예약 등록(`schedules`) |
| 업로드 완료 | `published` | Graph API 발행 성공(`posts`) |

> **하드 게이트**: `produced`→`scheduled`/`published` 전이는 **`reviews.decision='approved'` 행 존재가 전제**(SPEC 3.3, 무승인 발행 MUST NOT).

---

## 4. Enum 정의

```sql
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
```

---

## 5. Supabase 마이그레이션 초안 (핵심 테이블)

> 전체가 아니라 **코어 흐름(channel→config→deck→review→schedule→post)** 우선. 나머지는 위 정의대로 동일 패턴. RLS 정책은 §6.

```sql
-- profiles (auth.users 1:1)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nickname text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

-- channels
create table channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ig_user_id text,
  ig_username text,
  status channel_status not null default 'needs_setup',
  connected_at timestamptz
);

-- ig_tokens (암호화 토큰 격리)
create table ig_tokens (
  channel_id uuid primary key references channels(id) on delete cascade,
  access_token_enc bytea not null,
  token_type text not null default 'long_lived',
  expires_at timestamptz
);

-- channel_configs (잠긴 컨셉)
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

-- decks (콘텐츠 단위 · 칸반)
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

-- reviews (검수 게이트 + 승인 로그)
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

-- schedules (예약 ↔ BullMQ)
create table schedules (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  scheduled_at timestamptz not null,
  bullmq_job_id text,
  status schedule_status not null default 'pending',
  attempts int not null default 0,
  last_error text
);
create index on schedules (status, scheduled_at);

-- posts (발행 결과)
create table posts (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  ig_media_id text,
  ig_container_id text,
  permalink text,
  published_at timestamptz,
  status post_status not null default 'creating'
);
```

---

## 6. 보안 (RLS · 토큰)

- **RLS**: 모든 앱 테이블 `enable row level security`. 정책 골자 = `channel.user_id = auth.uid()` 경로로 소유권 확인. 워커(서버)는 `service_role` 키로 우회.
- **토큰 암호화**: `ig_tokens.access_token_enc`는 앱단에서 libsodium 봉인 후 bytea 저장. 복호화 키는 DB 밖(KMS/env). Postgres에 평문 토큰 금지(SPEC 2.2).
- **service_role 분리**: 발행·웹훅·인사이트 수집 워커만 service_role 사용. 프론트는 anon 키 + RLS.

---

## 7. BullMQ 연결점 (⏱ 개발 트랙 인계)

| DB | BullMQ Job | 흐름 |
|---|---|---|
| `schedules.bullmq_job_id` | `publish` (delayed) | 예약 시각 → 컨테이너 생성 → FINISHED 폴링 → 게시 → `posts` 기록 |
| `ig_tokens.expires_at` | `token-refresh` (repeat) | 만료 임박 토큰 갱신 |
| `channel_insights_daily` / `post_insights` | `insights-collect` (cron 04:00) | Graph API 수집 → 스냅샷 upsert |
| `lead_magnets`+webhook | `dm-send` | 댓글 키워드 매칭 → Private Reply → `dm_logs`(한도 검사) |

→ Task 6(영속화) 착수 시 이 표가 워커-DB 계약. `spike/bullmq`의 검증 결과를 `publish` 잡에 이식.

---

## 8. 미결정 / 다음 단계

- **다중 채널 vs 단일 채널**: 스키마는 user 1:N channel로 열어둠. SPEC §0은 "채널=1개"라 MVP UI는 1개로 시작 가능 — **UI 정책 확정 필요**.
- **변형안(variants)**: 카피 N개 재생성을 `decks` 행 N개로 둘지, `deck_variants` 자식 테이블로 둘지 — [파이프라인 §6 정책 미정](Kup_생성파이프라인_설계.md)과 함께 결정.
- **결제 상세**(0.5): `payment_methods`·`invoices`는 베타 이후(v1.1). 본 문서는 `subscriptions`까지만.
- **임시저장/관련 게시물 토글**(IA 0.2.4): `decks.status='planning'` + 별도 플래그로 충분한지 검토.
- **다음 액션**: 이 스키마 리뷰 확정 → Task 6에서 Supabase 마이그레이션으로 적용 → Zod 타입을 `decks.slides`(파이프라인 계약)와 공유.
