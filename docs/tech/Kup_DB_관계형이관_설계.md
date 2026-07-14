# Kup DB 관계형 이관 설계 (B안) — 초안

> 상태: **설계 초안(검토 대기)**. 구현 착수 전 팀 검토용.
> 관련: 통짜 blob 동시쓰기 유실은 [A안 CAS 안전망](../../lib/workspace/db.ts)(PR #54)으로 우선 봉합됨.
> 이 문서는 그 위에 올릴 **정식 해법**을 다룬다.

## 1. 왜 이관하나 (배경)

현재 워크스페이스 데이터 **전체**(users·sessions·strategies·cards·publishJobs·metrics·dmRules)가
`app_state` **단일 행(id=1)** 에 통짜 JSONB blob으로 저장된다. `mutateDB`는 "통짜 읽고 → 고치고 → 통짜 덮어쓰기".

문제:
1. **동시 쓰기 유실** — 두 요청이 겹치면 last-write-wins. A안(version CAS)으로 유실은 막았지만, **모든 write가 한 행을 놓고 경쟁** → 재시도 폭증·전역 병목. 확장 불가.
2. **읽기 비효율** — 카드 1건 조회에도 전체 blob을 읽어 역직렬화.
3. **부분 인덱싱 불가** — "발행 예정 job", "이번 주 metric" 같은 쿼리를 인덱스로 못 탄다.
4. **크기 상한** — blob이 커질수록 매 write마다 전체 재직렬화.

베타 동시 사용자를 받을 서비스엔 부적합. **행 단위 저장**으로 가야 한다.

## 2. 목표 스키마

원칙:
- **최상위 엔티티 = 테이블 1개.** 독립적으로 읽고 쓰이는 것(카드·세션·job·metric·rule).
- **항상 부모와 함께 읽고 쓰이는 값 객체 = 부모 행의 JSONB 컬럼.** 과도 정규화 회피
  (예: `cards.pages`, `cards.review_flags`, `cards.approval_log`, `users.survey`).
- **RLS = service_role 전용** (기존 `app_state`와 동일). 프론트는 서버 API 경유만 → anon/authenticated 차단.
- id는 앱이 생성하는 문자열 그대로(`uid()`) PK. epoch ms(number) 타임스탬프는 `bigint`.

| 테이블 | PK | 핵심 컬럼 | 인덱스 | JSONB로 접는 것 |
|---|---|---|---|---|
| `users` | id | email(unique), name, password_hash, password_salt, guest, auth_provider, marketing_consent, plan, billing_cycle, subscribed_at, onboarded, active_ig_account_id, created_at | email unique | `survey` |
| `ig_accounts` | id | user_id(FK), handle, mode, login_type, ig_user_id, access_token(봉인), token_expires_at, connected_at, followers, weekly_* , niche | user_id | — (토큰이 독립 갱신돼 별도 테이블) |
| `sessions` | token | user_id(FK), created_at, **expires_at** | user_id | — |
| `strategies` | user_id | stage, diagnosis, weekly_goal, recommended_count, generated_by, created_at | — (user당 1행) | `focus`, `topics` |
| `cards` | id | user_id(FK), ig_account_id, title, format, topic_source, objective, page_count, key_message, caption, cta, ai_label, ai_edited, status, generated_by, has_video, theme, brand_color, photo_style, ratio, created_at, updated_at | (user_id), (user_id,status) | `pages`, `review_flags`, `approval_log`, `hashtags` |
| `publish_jobs` | id | user_id(FK), card_id(FK), card_title, ig_handle, scheduled_at, immediate, status, published_at, ig_permalink, created_at | **(status, scheduled_at)** ← 스케줄러 | — |
| `metrics` | id | user_id(FK), card_id, media_id, source, date, views, reach, saves, shares, likes, comments, profile_visits, follows, new_followers, created_at | (user_id,date), **unique(user_id, media_id)** ← 자동수집 중복방지 | — |
| `dm_rules` | id | user_id(FK), enabled, opt_in, trigger_keyword, post_reference, media_id, dm_message, resource_link, sent_count, created_at | user_id | — |

부수 효과로 해결되는 QA 항목:
- **항목5(세션 TTL)** — `sessions.expires_at` 추가 + 만료 검사·정리로 자연 해결.
- **metrics 중복** — `unique(user_id, media_id)`로 자동수집 중복이 DB 레벨에서 차단.

## 3. 인터페이스 진화 (핵심 난제)

현재 계약은 `readDB()`(통짜) / `mutateDB(fn)`(통짜 변형)이다. 관계형은 "전체 로드"와 안 맞는다.
→ **엔티티별 리포지토리 레이어**로 진화:

```ts
// lib/workspace/repo/cards.ts (예)
cards.listByUser(userId): Promise<CardNews[]>
cards.get(id): Promise<CardNews | null>
cards.create(card): Promise<void>
cards.update(id, patch): Promise<CardNews>   // 행 단위 UPDATE — 카드끼리 충돌 없음
cards.remove(id): Promise<void>
```

- 이게 **작업량의 대부분** — `mutateDB`를 쓰는 **26개 파일**을 리포지토리 호출로 교체.
- 좋은 소식: 지금 호출부가 전부 `mutateDB((db)=>db.cards.push(...))` 식으로 **좁게 통일**돼 있어, 컬렉션별로 기계적으로 바꿀 수 있다.
- `db.ts`의 좁은 인터페이스가 **이관용 seam** 역할.

## 4. 이관 전략 — 점진(Strangler), 컬렉션 단위

빅뱅(전부 한 번에) 금지 — 마이그레이션 중 유실 위험. **한 컬렉션씩** 교체:

각 컬렉션마다:
1. 마이그레이션으로 **테이블 생성**(위 스키마)
2. **데이터 이관 스크립트** — `app_state.data.<collection>` blob → 새 테이블 행 INSERT(id 기준 upsert, 멱등)
3. 그 컬렉션의 **호출부를 리포지토리로 교체**
4. 검증(읽기/쓰기 왕복 + 3종) 후 다음 컬렉션

**권장 순서**(경합·가치 높은 순):
1. `cards` (write 최다 — 생성·검수·상태변경)
2. `sessions` (+ TTL, 항목5 동시 해결)
3. `metrics` (+ 중복 unique, 자동수집 대비)
4. `publish_jobs` (스케줄러 인덱스)
5. `dm_rules` → `strategies` → `users`/`ig_accounts` (users는 로그인 경로라 마지막에 신중히)

이관 동안 **나머지 컬렉션은 계속 app_state blob** 에 남고, `app_state`는 **컷오버 완료 전까지 삭제 금지**(롤백 자산).

## 5. 로컬 개발 / 백엔드 (항목2 연계)

- 관계형은 Postgres 필요 → 로컬은 `supabase start`(이미 지원)로 실 DB 사용.
- 현재 파일 백엔드(`.data/db.json`)는 blob 전제 → 관계형 전환 후 **로컬도 Supabase로 통일** 권장.
  (또는 파일 백엔드는 `npm run gen` 데모 전용으로 축소.)
- **항목2 가드**(별개 작업): `lib/env.ts`에 "프로덕션인데 `KUP_DB_BACKEND!=supabase` 면 throw" 추가 → 파일 백엔드로 조용히 폴백하는 배포 사고 차단.

## 6. 리스크 & 롤백

| 리스크 | 완화 |
|---|---|
| 이관 스크립트 데이터 누락/변형 | 멱등 upsert + 이관 후 count·샘플 대조. `app_state` 원본 보존 |
| 컷오버 중 이중 소스 불일치 | 컬렉션 단위로 "한쪽만 정본" — 교체 순간 이후엔 테이블이 정본, blob은 안 읽음 |
| users 이관 중 로그인 장애 | users를 **마지막**에, 별도 세션에서 신중히 |
| 마이그 번호 충돌 | 현재 dev=0006, A안=0008 점유. B안은 **0009+** 부터, `feature/dm-dedup-cron`(0007)과 조율 |
| RLS 오설정으로 데이터 노출 | 모든 새 테이블 `enable row level security` + 정책 없음(service_role 전용), `app_state`와 동일 패턴 |

롤백 = 해당 컬렉션 호출부를 다시 `mutateDB`(blob)로 포인팅 + 테이블 무시. app_state가 남아있어 가능.

## 7. 작업 분할(제안)

- **P0 (이 문서)**: 설계 확정 + 스키마 리뷰
- **P1**: `cards` 테이블 + 리포지토리 + 이관 스크립트 + 호출부 교체 (첫 수직 슬라이스로 패턴 확립)
- **P2**: `sessions`(+TTL) · `metrics`(+unique)
- **P3**: `publish_jobs` · `dm_rules` · `strategies`
- **P4**: `users` · `ig_accounts` (신중) → `app_state` blob 경로 제거 → 파일 백엔드 정리
- **병행 가능(독립)**: 항목2 env 가드, 항목5는 P2(sessions)에 흡수

## 8. 열린 질문 (검토 때 결정)

1. `ig_accounts`를 별도 테이블 vs `users.ig_accounts` JSONB — 토큰 독립 갱신 때문에 테이블 권장하나, 초기엔 JSONB로 두고 나중에 승격도 가능. 어느 쪽?
2. 로컬 개발을 Supabase로 완전 통일할지, 파일 백엔드를 데모용으로 남길지.
3. 리포지토리 레이어 형태 — 컬렉션별 모듈(`repo/cards.ts`) vs 단일 `repo.ts` 네임스페이스.
4. P1(cards)만 먼저 붙여보고 패턴 검증 후 나머지 진행할지, 전체 일정을 미리 확정할지.
