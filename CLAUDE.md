# CLAUDE.md

이 파일은 Claude Code 등 AI 코딩 도구가 이 레포에서 작업할 때 가장 먼저 읽는 안내서다.
**짧게 유지한다.** 상세 내용은 중복하지 말고 `docs/`를 가리킨다. (사람용 온보딩은 [README.md](README.md)·[CONTRIBUTING.md](CONTRIBUTING.md))

## 프로젝트

**Kup** — 갓 시작한 1인 인플루언서를 위한 인스타 카드뉴스 AI. AI가 카드뉴스를 기획·생성하고,
사람이 검수·승인한 뒤 예약 발행하며, 댓글 리드마그넷·성과까지 한 곳에서 돌린다.

데이터 흐름 한 줄: **컨셉(브랜드) → 생성 파이프라인 → deck(카피) → 렌더(PNG) → DB 저장 → (예약) 발행 워커**

현재 동작 범위 = **생성 파이프라인**(컨셉 → deck JSON → 카드 PNG). 기본 **mock LLM** 이라 API 키 없이 돈다.
이후 로드맵·다음 할 일은 **[GitHub Issues](https://github.com/KernelAcademy-AICamp/ai-camp-7th-main-project-gentlemen/issues)** 로 추적한다 (초기 로드맵 기록은 [docs/archive/작업트랙.md](docs/archive/작업트랙.md)).

## 스택

TypeScript · Next.js 15(App Router)+Tailwind · Supabase(Postgres·Auth·Storage) ·
BullMQ+Redis(예약/cron) · sharp+SVG(렌더). **프론트+API → Vercel / 워커 → Railway** (같은 레포·`lib/` 공유, 배포만 둘로).

## 디렉토리

```
app/         Next.js 프론트+API
lib/
  generate/  생성 엔진 generateDeck()
  llm/       LLM 어댑터(mock + 공급자 교체점)
  render/    카드 렌더(sharp+SVG)
  db/        decks 저장·복원·시드
  supabase/  client/server/admin 3종
  env.ts     환경변수 검증(zod)
  sentry.ts  에러추적(현재 스텁)
workers/     BullMQ 워커(발행·cron)
supabase/    config + 마이그레이션(0001~0003)
scripts/     CLI(생성 데모 등)
docs/        기획·기술 문서(설계 SoT)
```

## ⚠️ 공유 계약 — 바꾸기 전 반드시 팀에 공유

아래는 여러 영역이 함께 쓴다. 바꾸면 생성·렌더·DB·프론트가 동시에 깨질 수 있다:

- `lib/deck-schema.ts` · `lib/concept-schema.ts` — 생성·렌더·DB·프론트가 공유하는 데이터 계약
- `lib/db/database.types.ts` — DB 타입(자동 생성물). 직접 수정 X → 스키마 바꿨으면 `supabase gen types`로 재생성
- `supabase/migrations/*` — DB 스키마. 기존 파일 수정 금지, **새 번호로 추가만**

## 명령어

| 명령 | 용도 |
|---|---|
| `npm run dev` | 프론트+API 개발 서버 (http://localhost:3000) |
| `npm run gen` | 생성 파이프라인 데모 — deck JSON + 카드 PNG (out/). 키 불필요 |
| `npm run gen -- --save` | + 로컬 DB 영속화(왕복 검증). `supabase start` 필요 |
| `npm run worker:dev` | BullMQ 워커(REDIS_URL 필요) |
| `npm run typecheck` / `lint` / `build` | **PR 전 필수 3종 — CI도 이걸 검사** |

## 작업 규칙

- **PR 전 반드시** `npm run typecheck && npm run lint && npm run build` 통과. 빨간불이면 머지 금지.
- 브랜치: `dev`에서 따서 `feature/<영역>-<요약>` → `dev`로 PR → 리뷰 1명 승인 (CONTRIBUTING §1).
- LLM 기본값은 **mock**(키 없이 동작). 실 공급자는 Task 4에서 붙는다 — 지금 `lib/llm/`에서 `anthropic` 등을 부르면 "미구현" 에러가 정상이다.
- 미래 기능 자리는 **스텁 + `TODO(Phase5)`** 로 잡혀 있다(`workers/jobs/publish.ts`, `lib/sentry.ts` 등). 죽은 코드가 아니라 의도된 빈칸이다.
- 새 환경변수: `.env.example`에 빈 값 추가 + `lib/env.ts` 스키마 반영. 실제 키·`.env.local`은 **절대 커밋 금지**.

## 더 읽을 것 (설계 SoT)

- 무엇을 만드나: [docs/product/Kup_SPEC.md](docs/product/Kup_SPEC.md)
- 어떻게: [docs/tech/Kup_기술설계.md](docs/tech/Kup_기술설계.md) · 데이터: [docs/tech/Kup_데이터모델.md](docs/tech/Kup_데이터모델.md)
- 생성 파이프라인: [docs/tech/Kup_생성파이프라인_설계.md](docs/tech/Kup_생성파이프라인_설계.md)
- 작업 현황·다음 할 일: **[GitHub Issues](https://github.com/KernelAcademy-AICamp/ai-camp-7th-main-project-gentlemen/issues)**
- 팀 개발 규칙: [CONTRIBUTING.md](CONTRIBUTING.md)
