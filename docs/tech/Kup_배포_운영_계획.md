# Kup — 배포 · 운영 계획

> **문서 성격**: "언제, 무엇을, 어디에 올릴 것인가"를 단계별로 확정하는 운영 문서. 개발 중에는 상시 서버를
> 띄우지 않고, 최종 출시 시점에만 예약발행·인사이트 워커를 켜는 전략을 정리한다.
> **기준일**: 2026-06-29 · **선행**: [기술스택_개발계획](Kup_기술스택_개발계획.md) · [데이터모델 §7](Kup_데이터모델.md) · [BullMQ cron 심층](Kup_BullMQ_cron_심층.md)
> **근거 코드**: `lib/env.ts`(env 검증) · `workers/queue.ts`(REDIS_URL 게이트) · `.github/workflows/ci.yml`(env 없이 빌드)

---

## 0. 핵심 원칙 두 가지

1. **배포 = 코드 변경 0, 환경변수 주입만.**
   프론트+API와 워커는 같은 레포·같은 `lib/`를 쓰고, 호스트별 시크릿(`REDIS_URL`·Supabase 키 등)만 다르게 꽂는다.
   `workers/queue.ts`는 `REDIS_URL`이 없으면 명시적 에러를 내고, 프론트+API는 Redis 없이도 빌드·동작한다(CI도 env 없이 통과).

2. **예약·인사이트는 "기록(record)"과 "실행(execute)"을 분리한다.**
   워커가 없어도 예약·자동수집의 **DB 기록은 되고, 실행만 멈춘다.** 워커를 켜는 순간 밀린 작업을 집어 처리한다.
   → 개발 중엔 화면·DB까지 검증하고, 출시 때 워커만 켜면 자연스럽게 동작한다. (이걸 안 해두면 워커 붙일 때 UI·DB를 다시 손봐야 한다.)

---

## 1. 왜 단계적으로 (개발 중 상시 서버 0)

- **베타 단계의 사용자는 우리 팀뿐**이다. 예약발행·새벽 인사이트 수집은 빈도가 낮아, 상시 워커를 몇 주씩 돌릴 이유가 없다.
- **Upstash Redis는 건당 과금** → 유휴 폴링이 비용을 샌다([queue.ts] 주석, [BullMQ 심층](Kup_BullMQ_cron_심층.md)). 상시 가동은 출시 시점에 켠다.
- **Vercel은 서버리스**(요청이 올 때만 실행)라 "상시 서버"가 아니다. 진짜 상시 프로세스는 **워커뿐**이고, 그것만 마지막에 켠다.

---

## 2. 3단계 배포 전략

| 단계 | 프론트+API | DB | 워커(예약·cron) + Redis | 상시 서버 | 비용 |
|---|---|---|---|---|---|
| **A. 개발** (지금~) | 로컬 `npm run dev` | 로컬 Supabase | **로컬 Redis**로 테스트만 (Docker / `spike-bullmq`) | 0개 | 0 |
| **B. 통합/검증** | **Vercel** (무료 티어) | Supabase 클라우드(무료) | 미가동 — 예약은 DB 기록까지만 | 0개 | ~0 |
| **C. 베타 출시** | Vercel (동일) | Supabase (동일) | **Railway 워커 + Upstash Redis 가동** → `REDIS_URL` 주입 | 1개(워커) | Railway ~$5/mo + Upstash |

> A·B 단계에선 상시 서버가 **0개**. 진짜 상시 프로세스(워커)는 **C에서 딱 한 번** 켜진다. 코드 변경 없이 시크릿 주입만으로.

---

## 3. 단계별 할 일

### A. 개발 (지금)
- [ ] 워커 로직(2단계 발행·insights cron)을 **로컬 Redis**로 구현·검증
- [ ] `spike-bullmq`의 delayed/cron 검증본을 `workers/`(TS)로 이식
- [ ] 예약·인사이트가 **DB에 기록**되는 흐름까지 확인 (실행은 로컬 워커로만)

### B. 통합/검증
- [ ] 프론트+API → Vercel 배포 (팀이 실제 URL로 사용)
- [ ] Supabase 클라우드 프로젝트 + 마이그레이션 0001~0003 적용
- [ ] 예약발행 UI는 **"예약됨(대기)"까지만** 표시 — 실제 발행은 C에서. 베타 안내 문구로 명시
- [ ] `/api/health` 로 배포 상태 확인

### C. 베타 출시 (상시 서버 ON)
- [ ] Upstash Redis 생성 → `REDIS_URL` 확보
- [ ] Railway 등에 워커 배포 (`npm run worker`) + 시크릿 주입
- [ ] Meta(인스타) 앱 검수 통과 (권한 4종)
- [ ] 예약발행·04:00 인사이트 cron 실가동 확인

---

## 4. 환경변수 — 어느 호스트에 무엇 (`.env.example` 기준)

| 변수 | 프론트+API (Vercel) | 워커 (Railway) | 비고 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | ✅ | ✅ | 공개값(브라우저 노출 OK) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅(서버 라우트) | ✅ | RLS 우회 — 브라우저 노출 금지 |
| `REDIS_URL` | — | ✅ (C단계) | 워커·예약 전용 |
| `TOKEN_ENCRYPTION_KEY` | — | ✅ | IG 토큰 봉인 |
| `IG_APP_ID` / `IG_APP_SECRET` / `IG_OAUTH_REDIRECT_URI` / `IG_WEBHOOK_VERIFY_TOKEN` | ✅(OAuth·웹훅) | ✅(발행) | Meta 앱 전역 자격 |
| `ANTHROPIC_API_KEY` 등 LLM 키 | ✅(생성) | — | 없으면 mock |
| `SENTRY_DSN` | ✅ | ✅ | 없으면 콘솔 no-op |

> 실제 키는 **호스트 시크릿**(Vercel·Railway)에만. `.env.local`·실 키는 절대 커밋 금지(`.gitignore`).

---

## 5. "기록 vs 실행" 분리 — 구현 가이드

- **예약발행**: 사용자가 예약 → `schedules` row 생성(`status='pending'`). 워커가 있으면 BullMQ delayed job 등록·실행, 없으면 **기록만 남고 대기**.
  - 워커 가동(C) 시 `status='pending'` 인 과거 예약을 스캔해 큐에 재투입하는 **부트스트랩 로직**을 둔다(누락 방지).
- **UI degradation**: 워커 미가동(B) 구간에선 예약 카드에 "예약됨 · 워커 가동 후 발행" 같은 상태를 명시. 사용자가 "발행 안 됨"으로 오해하지 않게.
- **인사이트 cron**: 동일 원칙. 수집 잡이 안 돌면 대시보드는 "데이터 수집 대기" 빈 상태로.

---

## 6. 인사이트 cron: 워커 vs 서버리스 (C단계 결정)

기본은 팀 결정대로 **BullMQ repeat 잡**(워커). 단, "상시 워커를 최대한 늦추고 싶다"면 04:00 인사이트 수집만 서버리스로 뺄 수 있다:

- **Vercel Cron** — 스케줄로 API 라우트를 호출 → 워커 없이 인사이트 수집 가능.
- **Supabase pg_cron + Edge Function** — DB 측 스케줄.

다만 **예약 "발행"**은 임의 시각 + 재시도·정확성이 중요해 BullMQ delayed job이 더 안전하다. → **발행은 BullMQ 고정, cron만 분리 여부는 C단계에서 재판단**(지금 정할 필요 없음).

---

## 7. C단계 출시 체크리스트

- [ ] Supabase 프로젝트 생성 + 마이그레이션 0001~0003
- [ ] Upstash Redis 생성, `REDIS_URL` 발급 (Fixed plan + `maxRetriesPerRequest:null` 권장)
- [ ] Railway 워커 배포 + 시크릿 주입, `npm run worker` 기동 확인
- [ ] Vercel 환경변수 세팅(§4 표)
- [ ] Meta 앱 검수 통과(권한 4종 데모영상)
- [ ] 예약발행 1건 end-to-end 확인 (예약→컨테이너→게시)
- [ ] 04:00 인사이트 잡 1회 수집 확인
- [ ] Sentry 실연결(스텁 → `@sentry/nextjs`)
- [ ] `main` branch protection ON (직접 push 차단·CI 필수·리뷰)

---

## 8. 운영 메모

- **워커 끄기 = 발행만 멈춤, 기록은 유지.** 비상시 워커만 내리면 안전하게 일시정지된다(킬 스위치).
- 워커는 stateless하게 — 상태는 전부 Redis(큐)·Postgres(`schedules`/`posts`)에 둔다. 재시작해도 큐가 살아 있으면 이어서 처리.
- 비용 모니터링: Upstash 명령 수 · Railway 가동시간. 베타 트래픽 기준 월 $5~10 내외 예상.
</content>
