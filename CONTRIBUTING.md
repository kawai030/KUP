# 개발 규칙 (CONTRIBUTING)

3~4인이 서로 안 부딪히고 일하기 위한 최소 규칙. 처음이라도 이대로만 하면 안전하다.

## 1. 브랜치 전략

```
main      배포 가능한 안정 상태. 직접 push 금지. PR로만 머지.
dev       통합 브랜치. feature 들이 모이는 곳.
feature/* 각자 작업. dev에서 따고, dev로 PR.
```

- 새 작업: `git switch dev && git pull && git switch -c feature/<영역>-<요약>`
  - 예: `feature/backend-publish-worker`, `feature/front-review-ui`, `feature/quality-prompt-tuning`
- 작업 끝 → `dev`로 **PR** → 리뷰 1명 승인 → 머지.
- `spike/*` 는 버리는 실험용(머지 안 함).

> ℹ️ 지금 실제 상태: `dev`가 최신(`main`보다 앞섬). **브랜치는 항상 `dev`에서 따고 PR도 `dev`로.** `main`은 리드가 가끔 한 번에 올린다 — 개인은 직접 안 건드린다.

## 1.5 작업 흐름 (동시 개발 5단계)

동시 개발에서 충돌은 "동시에 작업해서"가 아니라 **"오래 안 합쳐서(drift)"** 생긴다. 아래 5단계, 특히 3번을 지키면 머지가 거의 항상 깨끗하다.

```bash
# 1. 시작 — 항상 최신 dev에서 브랜치 따기
git switch dev && git pull
git switch -c feature/<영역>-<요약>

# 2. 작업 중 — 자주 커밋 + 자주 push (push는 "올려두기", 아무것도 안 합쳐짐)
git add . && git commit -m "<영역>: <한 일>"
git push -u origin feature/<영역>-<요약>

# 3. 작업 중 하루 1회+ — dev 최신을 내 브랜치로 끌어오기 (drift 방지의 핵심)
git fetch origin && git merge origin/dev

# 4. PR 직전 — dev 한 번 더 끌어오기 + 3종 검사
git fetch origin && git merge origin/dev
npm run typecheck && npm run lint && npm run build

# 5. PR — dev로 올리기 → 리뷰어 1명 승인 → Merge
```

- **push ≠ merge.** push는 내 브랜치를 GitHub에 백업/공유하는 것(자주 OK). dev에 실제로 합쳐지는 건 오직 **PR이 머지될 때**.
- **방향 주의**: 작업 중엔 `dev → 내 브랜치`(끌어오기), 끝나면 `내 브랜치 → dev`(PR). 같은 "합치기"인데 방향이 반대다.
- **3번을 잘 하면 5번이 안 아프다.** 매일 조금씩 합치면 충돌도 매일 조금씩. 안 하고 모으면 한 번에 터진다.

### merge로 통일 (rebase 쓰지 말 것)

`dev`를 내 브랜치로 가져오는 방법은 `merge`와 `rebase` 둘인데, **팀 전체가 `merge`로 통일한다.**
- `merge`: 안전하다. 커밋이 안 바뀌고 force push가 필요 없다.
- `rebase`: 히스토리는 깔끔하지만 커밋을 다시 써서(`--force` push 필요) 초보가 쓰면 작업이 날아갈 수 있다.
- 섞어 쓰면 그 자체가 충돌·혼란의 원인. **무조건 merge.**

### 충돌이 났을 때 (당황 금지)

`git merge origin/dev` 했는데 충돌이 나면:
```bash
# 1. 충돌난 파일을 연다 → <<<<<<< ======= >>>>>>> 마커가 보인다
#    위(<<<)는 내 코드, 아래(>>>)는 dev 코드. 올바른 쪽으로 직접 정리하고 마커 3줄 다 지운다.
git add <고친 파일>
git commit                     # 합치기 마무리
npm run typecheck && npm run lint && npm run build   # 합친 게 진짜 되는지 확인
```
- 충돌 = 고장이 아니라 "둘이 같은 줄을 고쳐서 git이 누구 걸 쓸지 모른다"는 뜻. 직접 골라주면 된다.
- 막히면 혼자 끙끙대지 말고 그 줄을 고친 팀원에게 물어본다.

## 2. 커밋 메시지

`<영역>: <한 일>` 형식. 한국어 OK.
```
backend: 예약 발행 잡 BullMQ 이식
front: 검수 화면 ai_flags 바인딩
quality: 디저트 고위험 프롬프트 보강
```
- 작게 자주 커밋. 한 커밋 = 한 가지 일.

## 3. PR 규칙

- PR 전 **로컬에서 반드시 통과**: `npm run typecheck && npm run lint && npm run build`
- PR 본문에 **무엇을·왜·어떻게 테스트했는지** 적기 (템플릿 자동 제공).
- **리뷰어 1명 승인** 후 머지. 본인 PR 셀프 머지 금지(급하면 구두 합의).
- CI(자동 검사)가 빨간불이면 머지 금지.

## 4. ⚠️ 공유 계약 (바꿀 땐 반드시 사전 공유)

아래 파일은 여러 영역이 함께 쓴다. 바꾸면 남의 코드가 깨질 수 있으니 **변경 전 팀에 알리고 PR 리뷰 필수**:
- `lib/deck-schema.ts` · `lib/concept-schema.ts` — 생성·렌더·DB·프론트 공유 데이터 계약
- `lib/db/database.types.ts` — DB 타입(스키마 변경 시 `supabase gen types`로 재생성)
- `supabase/migrations/*` — DB 스키마(추가만, 기존 마이그레이션 수정 금지 → 새 번호로)

## 5. 시크릿 / 환경변수

- **절대 커밋 금지**: `.env.local`, 실제 키. `.gitignore`로 막혀 있다.
- 새 환경변수 추가 시 **`.env.example`에 빈 값으로 추가** + `lib/env.ts` 스키마 반영.
- 실 키는 각자 로컬 `.env.local` / 호스트 시크릿(Vercel·Railway)에만.

## 6. 트러블슈팅

| 증상 | 해결 |
|---|---|
| `[env] 환경변수 검증 실패` | `.env.local` 에 Supabase 키 채웠는지 (`supabase start` 출력) |
| `permission denied for table ...` | `npx supabase db reset` (0003 권한 마이그레이션 적용) |
| 워커가 `REDIS_URL 미설정` | `.env.local`에 REDIS_URL, 또는 `spike-bullmq`에서 `npm run redis:up` |
| supabase 안 뜸 | Docker Desktop 켜졌는지 확인 |
| 타입 에러(DB) | 스키마 바꿨으면 `supabase gen types ... > lib/db/database.types.ts` |
